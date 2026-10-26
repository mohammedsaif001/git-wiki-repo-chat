import { ChatOpenAI } from "@langchain/openai";
import { search } from "./vectorStore.js";
import { config, validateOpenAIConfig } from "../config/env.js";

function toText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part.text ?? ""))
      .join("");
  }
  return String(content ?? "");
}

let chatModel = null;
function getChatModel() {
  validateOpenAIConfig();
  if (!chatModel) {
    chatModel = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: config.openaiApiKey,
      temperature: 0.2,
    });
  }
  return chatModel;
}

export async function askQuestion(repo, question, topK = 5) {
  if (!repo || !question) {
    throw new Error("Repository and question must be provided.");
  }

  const docs = await search(repo, question, topK);

  if (!docs.length) {
    return {
      answer: `No indexed content found for repository "${repo}". Please index the repository first.`,
      sources: [],
      repo,
      question,
    };
  }

  const context = docs
    .map((doc) => `File: ${doc.metadata?.path || "Unknown"}\n${doc.pageContent}`)
    .join("\n\n---\n\n");

  const prompt = [
    "You are a technical documentation and codebase assistant.",
    "Answer the user's question accurately using ONLY the repository context provided below.",
    "If the answer cannot be determined from the context, clearly state that the provided files do not contain enough information.",
    "",
    "=== REPOSITORY CONTEXT ===",
    context,
    "=== END CONTEXT ===",
    "",
    `Question: ${question}`,
  ].join("\n");

  const llm = getChatModel();
  const response = await llm.invoke(prompt);

  const sources = [
    ...new Set(
      docs
        .map((doc) => doc.metadata?.path)
        .filter((path) => Boolean(path && typeof path === "string"))
    ),
  ];

  return {
    answer: toText(response.content),
    sources,
    repo,
    question,
  };
}
