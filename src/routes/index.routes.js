import { Router } from "express";
import { inngest } from "../inngest/client.js";
import { parseRepo } from "../service/github.js";
import { config } from "../config/env.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { repo, githubToken } = req.body || {};

    if (!repo || typeof repo !== "string" || !repo.trim()) {
      return res.status(400).json({
        success: false,
        error: "Field 'repo' is required (e.g. 'owner/repo' or GitHub repository URL).",
      });
    }

    const { owner, repo: repoName, repoKey } = parseRepo(repo);
    const token = githubToken || config.githubToken;

    await inngest.send({
      name: "repo/index.requested",
      data: {
        githubToken: token,
        owner,
        repo: repoName,
        repoKey,
      },
    });

    return res.status(202).json({
      success: true,
      message: "Repository indexing job queued successfully.",
      data: {
        repo: repoKey,
        owner,
        repoName,
      },
    });
  } catch (error) {
    if (error.message?.includes("Invalid repository format")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    return next(error);
  }
});

export default router;