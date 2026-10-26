import { Octokit } from "@octokit/rest";

const MAX_FILES_TO_INDEX = 200;
const MAX_FILE_SIZE_BYTES = 200_000;
const CONCURRENT_FETCH_LIMIT = 8;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  "vendor",
  "target",
  "__pycache__",
  ".gradle",
  ".vscode",
  ".idea",
  "bin",
  "obj",
  ".turbo",
  ".cache",
]);

const SKIP_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "ico",
  "webp",
  "bmp",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "otf",
  "mp3",
  "mp4",
  "mov",
  "wav",
  "webm",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "wasm",
  "class",
  "jar",
  "war",
  "ear",
  "zip",
  "tar",
  "gz",
  "tgz",
  "7z",
  "rar",
  "pdf",
  "lock",
  "map",
  "pyc",
  "sqlite",
  "db",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "composer.lock",
  "go.sum",
  ".DS_Store",
  "Thumbs.db",
]);

function shouldSkipFile(path, size) {
  if (!path || typeof path !== "string") return true;

  const parts = path.split("/");
  const fileName = parts[parts.length - 1];

  if (parts.some((part) => SKIP_DIRS.has(part))) return true;
  if (SKIP_FILES.has(fileName)) return true;
  if (typeof size === "number" && size > MAX_FILE_SIZE_BYTES) return true;

  const dotIndex = fileName.lastIndexOf(".");
  const ext = dotIndex !== -1 ? fileName.slice(dotIndex + 1).toLowerCase() : "";

  if (SKIP_EXTENSIONS.has(ext)) return true;
  if (fileName.endsWith(".min.js") || fileName.endsWith(".min.css")) return true;

  return false;
}

export function parseRepo(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Repository URL or 'owner/repo' string is required.");
  }

  const clean = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");

  const parts = clean.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Invalid repository format: "${input}". Expected "owner/repo" or a valid GitHub URL.`
    );
  }

  const owner = parts[0];
  const repo = parts[1];

  return { owner, repo, repoKey: `${owner}/${repo}` };
}

export async function fetchRepoFiles(token, owner, repo) {
  const octokit = new Octokit(token ? { auth: token } : {});

  let repoInfo;
  try {
    const res = await octokit.rest.repos.get({ owner, repo });
    repoInfo = res.data;
  } catch (err) {
    if (err.status === 404) {
      throw new Error(
        `GitHub repository "${owner}/${repo}" was not found or is private. Make sure the repository exists and your GITHUB_TOKEN has permission to read it.`
      );
    }
    if (err.status === 403 && err.message?.toLowerCase().includes("rate limit")) {
      throw new Error(
        "GitHub API rate limit exceeded. Please provide a valid GITHUB_TOKEN in your environment or request."
      );
    }
    throw err;
  }

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: repoInfo.default_branch,
    recursive: "true",
  });

  const candidates = [];
  for (const item of tree.tree) {
    if (item.type !== "blob") continue;
    if (shouldSkipFile(item.path, item.size)) continue;
    candidates.push(item);
    if (candidates.length >= MAX_FILES_TO_INDEX) break;
  }

  const files = [];

  // Fetch file blobs in concurrent batches for optimal speed
  for (let i = 0; i < candidates.length; i += CONCURRENT_FETCH_LIMIT) {
    const batch = candidates.slice(i, i + CONCURRENT_FETCH_LIMIT);
    const results = await Promise.all(
      batch.map(async (item) => {
        try {
          const { data: blob } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: item.sha,
          });

          let content = "";
          if (blob.encoding === "base64") {
            content = Buffer.from(blob.content, "base64").toString("utf8");
          } else {
            content = String(blob.content || "");
          }

          return {
            path: item.path,
            content,
          };
        } catch {
          // If a single file fails to fetch, skip it gracefully
          return null;
        }
      })
    );

    for (const file of results) {
      if (file && file.content.trim().length > 0) {
        files.push(file);
      }
    }
  }

  return files;
}
