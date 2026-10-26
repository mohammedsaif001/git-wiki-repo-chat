import { Router } from "express";
import { inngest } from "../inngest/client.js";
import { parseRepo } from "../service/github.js";

const router = Router();



async function startChatJob(repo, question) {
  const { repoKey } = parseRepo(repo);

  await inngest.send({
    name: "chat/question.requested",
    data: {repo: repoKey, question },
  });

  return "check your inngest "
}


router.post("/", async (req, res) => {
  const { repo, question } = req.body ?? {};

  if (!repo || !question) {
    return res.status(400).json({ error: "repo and question are required" });
  }

  res.status(202).json(await startChatJob(repo, question));
});



export default router;
