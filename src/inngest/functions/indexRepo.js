import { inngest } from "../client.js";
import { fetchRepoFiles } from "../../service/github.js";
import { chunkFiles } from "../../service/chunker.js";
import { saveChunks } from "../../service/vectorStore.js";

export const indexRepo = inngest.createFunction(
  {
    id: "index-repo",
    triggers: [{ event: "repo/index.requested" }],
  },
  async ({ event, step }) => {
    const { githubToken, owner, repo, repoKey } = event.data || {};

    if (!owner || !repo) {
      throw new Error("Missing owner or repo in repo/index.requested event data");
    }

    const repoName = repo.replace(/\.git$/, "");
    const resolvedRepoKey = repoKey || `${owner}/${repoName}`;

    const files = await step.run("fetch-github-files", async () => {
      return fetchRepoFiles(githubToken, owner, repoName);
    });

    const documents = await step.run("chunk-files", async () => {
      return chunkFiles(files, resolvedRepoKey);
    });

    const saveResult = await step.run("save-to-pinecone", async () => {
      return saveChunks(resolvedRepoKey, documents);
    });

    return {
      repo: resolvedRepoKey,
      fileCount: files.length,
      chunkCount: documents.length,
      saved: saveResult.saved,
      status: "completed",
    };
  }
);