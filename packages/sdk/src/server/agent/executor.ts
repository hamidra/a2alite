import {
  Task,
  TaskNotFoundError,
  TaskNotCancelableError,
} from "../../types/types.ts";
import { AgentExecutionContext } from "./context.ts";
import type { AgentExecutionResult } from "./types.ts";

interface IAgentExecutor {
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;
  cancel(
    task: Task
  ): Promise<Task | TaskNotFoundError | TaskNotCancelableError>;
}

export type { IAgentExecutor };
