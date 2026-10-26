import { createHash } from "node:crypto";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { config, validatePineconeConfig, validateOpenAIConfig } from "../config/env.js";

const UPSERT_BATCH_SIZE = 100;
const DEFAULT_TOP_K = 5;

let pineconeClient = null;
let embeddingsClient = null;

export function getPineconeClient() {
  validatePineconeConfig();
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: config.pineconeApiKey,
    });
  }
  return pineconeClient;
}

export function getEmbeddingsClient() {
  validateOpenAIConfig();
  if (!embeddingsClient) {
    embeddingsClient = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey: config.openaiApiKey,
    });
  }
  return embeddingsClient;
}

export function repoToNamespace(repo) {
  if (!repo || typeof repo !== "string") {
    throw new Error("Repository identifier is required to create a namespace.");
  }
  // Pinecone namespace: sanitize to alphanumeric, dashes, and underscores
  return repo.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function getIndex(namespace) {
  const pc = getPineconeClient();
  const indexName = config.pineconeIndex;
  return pc.index({ name: indexName }).namespace(namespace);
}

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents
    .map((doc) => ({
      pageContent: typeof doc.pageContent === "string" ? doc.pageContent : "",
      metadata: doc.metadata ?? {},
    }))
    .filter((doc) => doc.pageContent.trim().length > 0);
}

function buildRecordId(repo, metadata, content) {
  return createHash("sha256")
    .update(`${repo}:${metadata?.path ?? ""}:${content}`)
    .digest("hex");
}

export async function saveChunks(repo, documents) {
  const chunks = normalizeDocuments(documents);

  if (!chunks.length) {
    return { saved: false, chunkCount: 0 };
  }

  const namespace = repoToNamespace(repo);
  const index = getIndex(namespace);
  const embeddings = getEmbeddingsClient();

  const texts = chunks.map((doc) => doc.pageContent);
  const vectors = await embeddings.embedDocuments(texts);

  const records = chunks.map((doc, i) => ({
    id: buildRecordId(repo, doc.metadata, doc.pageContent),
    values: vectors[i],
    metadata: {
      text: doc.pageContent,
      path: doc.metadata.path ?? "",
      repo: doc.metadata.repo ?? repo,
    },
  }));

  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    await index.upsert({
      records: records.slice(i, i + UPSERT_BATCH_SIZE),
    });
  }

  return { saved: true, chunkCount: chunks.length };
}

function toSearchDocument(match) {
  const metadata = match.metadata ?? {};

  return {
    pageContent: metadata.text ?? "",
    metadata: {
      path: metadata.path,
      repo: metadata.repo,
    },
    score: match.score,
  };
}

export async function search(repo, question, topK = DEFAULT_TOP_K) {
  if (!repo || !question) {
    throw new Error("Both repo and question are required for search.");
  }

  const namespace = repoToNamespace(repo);
  const index = getIndex(namespace);
  const embeddings = getEmbeddingsClient();

  const vector = await embeddings.embedQuery(question);

  const response = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });

  return (response.matches ?? [])
    .map(toSearchDocument)
    .filter((doc) => doc.pageContent.trim().length > 0);
}