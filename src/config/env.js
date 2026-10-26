import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  pineconeApiKey: process.env.PINECONE_API_KEY || "",
  pineconeIndex: process.env.PINECONE_INDEX || "git-wiki-repo-chat",
  githubToken: process.env.GITHUB_TOKEN || "",
};

export function validatePineconeConfig() {
  if (!config.pineconeApiKey) {
    throw new Error(
      "PINECONE_API_KEY is not set. Please add it to your .env file."
    );
  }
}

export function validateOpenAIConfig() {
  if (!config.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please add it to your .env file."
    );
  }
}
