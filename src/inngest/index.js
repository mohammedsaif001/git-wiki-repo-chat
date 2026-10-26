import { inngest } from "./client.js";
import { helloWorld } from "./functions/helloWorld.js";
import {indexRepo} from "./functions/indexRepo.js"
import {askQuestionFn} from "./functions/askQuestions.js"
export {inngest}

export const functions = [helloWorld , indexRepo , askQuestionFn]