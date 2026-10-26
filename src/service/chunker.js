import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 150;

export async function chunkFiles(
  files,
  repo,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP
) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const documents = [];

  for (const file of files) {
    if (!file?.content || typeof file.content !== "string") continue;
    const trimmed = file.content.trim();
    if (!trimmed) continue;

    const chunks = await splitter.createDocuments(
      [file.content],
      [{ path: file.path, repo }]
    );

    documents.push(...chunks);
  }

  return documents;
}