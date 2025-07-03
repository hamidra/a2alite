import {
  Task,
  TaskNotFoundError,
  TaskNotCancelableError,
} from "../../types/types.ts";
import { AgentExecutionContext } from "./context.ts";
import type { AgentExecutionResult } from "./types.ts";

/**
 * Interface for implementing agent execution logic within the A2A protocol
 * 
 * The IAgentExecutor defines the contract for processing agent requests and managing
 * task lifecycle. Implementations of this interface contain the core business logic
 * for handling messages, executing tasks, and managing agent behavior.
 */
interface IAgentExecutor {
  /**
   * Executes an agent request within the provided execution context
   * 
   * This method is called by the A2A server to process incoming messages and tasks.
   * The implementation should handle the request appropriately and return one of:
   * - A completed Task
   * - A Message response
   * - A StreamResult for long-running operations
   * - An A2AError for error conditions
   * 
   * @param context - The execution context containing request data, task information, and utilities
   * @returns Promise resolving to the execution result
   */
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;

  /**
   * Attempts to cancel an active task
   * 
   * This method is called when a client requests task cancellation. The implementation
   * should attempt to stop the task execution gracefully and return the updated task
   * with appropriate status, or return an error if cancellation is not possible.
   * 
   * @param task - The task to cancel
   * @returns Promise resolving to the updated task or an error indicating why cancellation failed
   */
  cancel(
    task: Task
  ): Promise<Task | TaskNotFoundError | TaskNotCancelableError>;
}

export type { IAgentExecutor };
