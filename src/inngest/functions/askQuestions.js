import { inngest } from "../client.js";
import { askQuestion } from "../../service/rag.js";

export const askQuestionFn = inngest.createFunction(
  {
    id: "ask-question",
    triggers: [{ event: "chat/question.requested" }],
  },
  async ({ event, step }) => {
    const { repo, question } = event.data || {};

    if (!repo || !question) {
      throw new Error("Missing repo or question in chat/question.requested event data");
    }

    const result = await step.run("retrieve-and-answers", async () => {
      return askQuestion(repo, question);
    });

    return {
      repo,
      question,
      status: "completed",
      answer: result.answer,
      sources: result.sources,
    };
  }
);
