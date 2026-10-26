import { Router } from "express";
import { inngest } from "../inngest/client.js";
import { parseRepo } from "../service/github.js";
import { askQuestion } from "../service/rag.js";

const router = Router();

// Asynchronous question processing via Inngest
router.post("/", async (req, res, next) => {
  try {
    const { repo, question } = req.body || {};

    if (!repo || typeof repo !== "string" || !repo.trim()) {
      return res.status(400).json({
        success: false,
        error: "Field 'repo' is required (e.g. 'owner/repo' or GitHub repository URL).",
      });
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: "Field 'question' is required.",
      });
    }

    const { repoKey } = parseRepo(repo);

    await inngest.send({
      name: "chat/question.requested",
      data: {
        repo: repoKey,
        question: question.trim(),
      },
    });

    return res.status(202).json({
      success: true,
      message: "Chat question queued successfully.",
      data: {
        repo: repoKey,
        question: question.trim(),
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

// Synchronous question answering endpoint for direct API responses
router.post("/query", async (req, res, next) => {
  try {
    const { repo, question, topK } = req.body || {};

    if (!repo || typeof repo !== "string" || !repo.trim()) {
      return res.status(400).json({
        success: false,
        error: "Field 'repo' is required.",
      });
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: "Field 'question' is required.",
      });
    }

    const { repoKey } = parseRepo(repo);
    const result = await askQuestion(repoKey, question.trim(), topK || 5);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
