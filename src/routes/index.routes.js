import { Router } from "express";
import { inngest } from "../inngest/client.js";
import { parseRepo } from "../service/github.js";

const router = Router();

router.post("/", async (req, res) => {
  const githubToken = req.body.githubToken || process.env.GITHUB_TOKEN;
  const { owner, repo, repoKey } = parseRepo(req.body.repo);


  await inngest.send({
    name: "repo/index.requested",
    data: {githubToken, owner, repo, repoKey },
  });

  res.json("Repo Indexing");
});

export default router;