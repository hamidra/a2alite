import {
  JSONRPCServer,
  type HandlerResponse,
} from "../shared/jsonRpcServer.ts";
import type { IStore } from "./providers/storage/index.ts";
import type {
  TaskStoreFactory,
  StreamQueueFactory,
  AgentStreamEvent,
  AgentExecutionResult,
  AgentRequest,
} from "./agent/types.ts";
import type { IAgentExecutor } from "./agent/executor.ts";
import { AgentExecutionContext } from "./agent/context.ts";
import { InMemoryStore } from "./providers/storage/in_memory.ts";
import { InMemoryQueue } from "./providers/queue/in_memory.ts";
import {
  internalError,
  invalidAgentResponseError,
  pushNotificationNotSupportedError,
  taskNotFoundError,
} from "../utils/errors.ts";
import {
  CancelTaskRequest,
  GetTaskPushNotificationConfigRequest,
  isJSONRPCError,
  JSONRPCRequest,
  JSONRPCResponse,
  SetTaskPushNotificationConfigRequest,
  Task,
  TaskPushNotificationConfig,
  TaskResubscriptionRequest,
  AgentCard,
} from "../types/types.ts";
import { TaskStreamManager } from "./taskStreamConsumer.ts";
import {
  SendMessageRequest,
  SendStreamingMessageRequest,
} from "../types/types.ts";
import { isEndOfStream } from "./agent/stream.ts";

// Placeholder types for telemetry and logging
// Replace with actual implementations when available
interface TelemetryProvider {
  // Placeholder for telemetry integration
}
interface Logger {
  // Placeholder for logger integration
}

interface A2AServerParams {
  agentExecutor: IAgentExecutor;
  agentCard: AgentCard;
  taskStoreFactory?: TaskStoreFactory;
  queueFactory?: StreamQueueFactory;
  telemetryProvider?: TelemetryProvider;
  logger?: Logger;
}

export class A2AServer {
  private readonly _jsonRpcServer = new JSONRPCServer();
  private readonly _taskStreamManager = new TaskStreamManager();
  private readonly _taskStore: IStore<Task>;
  private readonly _queueFactory: StreamQueueFactory; // Factory for creating new queues
  private readonly _agentExecutor: IAgentExecutor;
  private readonly _telemetryProvider?: TelemetryProvider;
  private readonly _logger?: Logger;
  private _isRunning: boolean = false;
  private readonly _agentCard: AgentCard;

  constructor({
    agentExecutor,
    agentCard,
    taskStoreFactory = () => new InMemoryStore<Task>(),
    queueFactory = () => new InMemoryQueue<AgentStreamEvent>(),
    telemetryProvider,
    logger,
  }: A2AServerParams) {
    this._taskStore = taskStoreFactory();
    this._queueFactory = queueFactory;
    this._agentExecutor = agentExecutor;
    this._telemetryProvider = telemetryProvider;
    this._logger = logger;
    this.registerHandlers();
    this._agentCard = agentCard;
  }

  private async _handleMessage(
    request: SendMessageRequest | SendStreamingMessageRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<AgentExecutionResult> {
    // Retrieve  and resolve any existing task
    let task: Task | undefined;
    if (request.params.message.taskId) {
      task = await this._taskStore.get(request.params.message.taskId);
      if (!task) {
        return taskNotFoundError(
          `Task ${request.params.message.taskId} not found`
        );
      }
    }

    // Retrieve and resolve any referenced tasks
    let referencedTasks: Task[] | undefined;
    if (request.params.message.referenceTaskIds) {
      referencedTasks = (
        await Promise.all(
          request.params.message.referenceTaskIds.map((taskId) =>
            this._taskStore.get(taskId)
          )
        )
      ).filter((task) => task !== undefined);
    }

    // Create AgentExecutionContext
    const agentRequest: AgentRequest = {
      params: request.params,
      extension,
    };
    const agentExecutionContext = new AgentExecutionContext(
      agentRequest,
      this._queueFactory,
      task,
      referencedTasks
    );

    // Call agentExecutor.execute and handle AgentExecutionResult
    const result = await this._agentExecutor.execute(agentExecutionContext);
    return result;
  }

  private async _handleMessageSend(
    request: SendMessageRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<JSONRPCResponse> {
    try {
      // Handle the message
      const result = await this._handleMessage(
        request,
        requestAbortSignal,
        extension
      );

      // If JSONRPCError respond with the error
      if (isJSONRPCError(result)) {
        // return an error
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: result,
        };
      }

      // If Task or Message respond with the result
      if (result.kind === "task" || result.kind === "message") {
        // Store the task in the store if it is a task
        if (result.kind === "task") {
          await this._taskStore.set(result.id, result);
        }
        // Respond with the result
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: result,
        };
      }

      // If stream: respond with initial task, consume EventQueue and stream updates
      if (result.kind === "stream") {
        let { taskStream, currentTask } = result;
        if (
          taskStream.getTask().id !== currentTask.id ||
          taskStream.getTask().contextId !== currentTask.contextId
        ) {
          throw new Error(
            "Task mismatch. The task in stream does not match the current task"
          );
        }
        // run the consumer
        const ongoingConsumer = this._taskStreamManager.getConsumer(
          taskStream.getTask().id
        );
        if (!ongoingConsumer) {
          // if there is no consumer, create one and start it
          let consumer = this._taskStreamManager.createConsumer(
            taskStream,
            isEndOfStream,
            requestAbortSignal
          );
          consumer.consume();
        }

        // return the current task as initial response
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: currentTask,
        };
      }
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: invalidAgentResponseError("Unknown result type"),
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: isJSONRPCError(error)
          ? error
          : invalidAgentResponseError(
              error instanceof Error ? error.message : undefined
            ),
      };
    }
  }

  private async *_handleMessageStream(
    request: SendStreamingMessageRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): AsyncGenerator<JSONRPCResponse> {
    try {
      const result = await this._handleMessage(
        request,
        requestAbortSignal,
        extension
      );
      if (isJSONRPCError(result)) {
        // return an error
        yield {
          jsonrpc: "2.0",
          id: request.id,
          error: result,
        };
        return;
      }

      // If Task or Message yield the only result
      if (result.kind === "task" || result.kind === "message") {
        // Store the task in the store if it is a task
        if (result.kind === "task") {
          await this._taskStore.set(result.id, result);
        }
        // return the result
        yield {
          jsonrpc: "2.0",
          id: request.id,
          result: result,
        };
        return;
      }

      // If stream: yield the current task, consume EventQueue and stream updates
      if (result.kind === "stream") {
        let { taskStream, currentTask } = result;
        // yield the current task as initial response
        yield {
          jsonrpc: "2.0",
          id: request.id,
          result: currentTask,
        };

        // if there is no consumer, create one and consume otherwise tap into the existing consumer
        const eventConsumer = this._taskStreamManager.tapOrConsume(
          taskStream,
          isEndOfStream,
          requestAbortSignal
        );

        // yield the events as they come
        for await (const event of eventConsumer) {
          yield {
            jsonrpc: "2.0",
            id: request.id,
            result: event,
          };
        }
      }
    } catch (error) {
      yield {
        jsonrpc: "2.0",
        id: request.id,
        error: isJSONRPCError(error)
          ? error
          : invalidAgentResponseError(
              error instanceof Error ? error.message : undefined
            ),
      };
    }
  }

  private async _handleTaskPushNotificationGet(
    request: GetTaskPushNotificationConfigRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<JSONRPCResponse> {
    try {
      // Check if the task exists
      const taskId = request.params.id;
      const task = await this._taskStore.get(taskId);
      if (!task) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: taskNotFoundError(`Task with ID ${taskId} not found`),
        };
      }

      // This is a placeholder implementation
      // TODO: Implement actual push notification configuration retrieval logic
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: pushNotificationNotSupportedError(),
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: isJSONRPCError(error)
          ? error
          : internalError(error instanceof Error ? error.message : undefined),
      };
    }
  }

  private async _handleTaskPushNotificationSet(
    request: SetTaskPushNotificationConfigRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<JSONRPCResponse> {
    try {
      // Check if the task exists
      const task = await this._taskStore.get(request.params.taskId);
      if (!task) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: taskNotFoundError(
            `Task with ID ${request.params.taskId} not found`
          ),
        };
      }

      // This is a placeholder implementation
      // TODO: Implement actual push notification configuration logic

      // Return the received config as a confirmation
      const result: TaskPushNotificationConfig = {
        taskId: request.params.taskId,
        pushNotificationConfig: {
          ...request.params.pushNotificationConfig,
          // Mask any sensitive credentials in the response
          authentication: request.params.pushNotificationConfig.authentication
            ? {
                schemes:
                  request.params.pushNotificationConfig.authentication.schemes,
                // Omit credentials from response
                credentials: undefined,
              }
            : undefined,
        },
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: result,
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: isJSONRPCError(error)
          ? error
          : internalError(error instanceof Error ? error.message : undefined),
      };
    }
  }

  private async _handleTaskCancel(
    request: CancelTaskRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<JSONRPCResponse> {
    try {
      // Get the task ID from the request params
      const taskId = request.params?.id;

      // Get the task from the store
      const task = await this._taskStore.get(taskId);
      if (!task) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: taskNotFoundError(`Task with ID ${taskId} not found`),
        };
      }

      // Call the agent executor's cancel method
      const result = await this._agentExecutor.cancel(task);

      // Check if the result is an error
      if (isJSONRPCError(result)) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: result,
        };
      }

      // Return the updated task
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: result,
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: isJSONRPCError(error)
          ? error
          : invalidAgentResponseError(
              error instanceof Error ? error.message : undefined
            ),
      };
    }
  }

  private async *_handleTaskResubscribe(
    request: TaskResubscriptionRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): AsyncGenerator<JSONRPCResponse> {
    try {
      // Retrieve  and resolve any existing task
      let task: Task | undefined;

      task = await this._taskStore.get(request.params.id);
      if (!task) {
        yield {
          jsonrpc: "2.0",
          id: request.id,
          error: taskNotFoundError(`Task ${request.params.id} not found`),
        };
        return;
      } else {
        const ongoingConsumer = this._taskStreamManager.getConsumer(task.id);
        // if there is no consumer, fail since the task is not active
        if (!ongoingConsumer) {
          yield {
            jsonrpc: "2.0",
            id: request.id,
            error: taskNotFoundError(`Task ${request.params.id} is not active`),
          };
          return;
        }

        // tab into the ongoing consumer and yield the events as they come
        for await (const event of ongoingConsumer.tap()) {
          yield {
            jsonrpc: "2.0",
            id: request.id,
            result: event,
          };
        }
      }
    } catch (error) {
      yield {
        jsonrpc: "2.0",
        id: request.id,
        error: isJSONRPCError(error)
          ? error
          : internalError(error instanceof Error ? error.message : undefined),
      };
    }
  }

  private registerHandlers() {
    // 1. message/send
    this._jsonRpcServer.setRequestHandler(
      "message/send",
      async (request, requestAbortSignal, extension) => {
        const result = await this._handleMessageSend(
          request,
          requestAbortSignal,
          extension
        );
        return { response: result };
      }
    );

    // 2. message/stream
    this._jsonRpcServer.setRequestHandler(
      "message/stream",
      async (request, requestAbortSignal, extension) => {
        const result = await this._handleMessageStream(
          request,
          requestAbortSignal,
          extension
        );
        return { stream: result };
      }
    );

    // 3. tasks/cancel
    this._jsonRpcServer.setRequestHandler(
      "tasks/cancel",
      async (request, requestAbortSignal, extension) => {
        const result = await this._handleTaskCancel(
          request,
          requestAbortSignal,
          extension
        );
        return { response: result };
      }
    );

    // 4. tasks/pushNotification/set
    this._jsonRpcServer.setRequestHandler(
      "tasks/pushNotificationConfig/set",
      async (request, requestAbortSignal, extension) => {
        const result = await this._handleTaskPushNotificationSet(
          request,
          requestAbortSignal,
          extension
        );
        return { response: result };
      }
    );

    // 5. tasks/pushNotification/get
    this._jsonRpcServer.setRequestHandler(
      "tasks/pushNotificationConfig/get",
      async (request, requestAbortSignal, extension) => {
        const result = await this._handleTaskPushNotificationGet(
          request,
          requestAbortSignal,
          extension
        );
        return { response: result };
      }
    );

    // 6. tasks/resubscribe
    this._jsonRpcServer.setRequestHandler(
      "tasks/resubscribe",
      async (request, requestAbortSignal, extension) => {
        const result = await this._handleTaskResubscribe(
          request,
          requestAbortSignal,
          extension
        );
        return { stream: result };
      }
    );
  }

  /**
   * Starts the A2A server. Registers all handlers and performs any startup logic.
   * Extend this method to start HTTP/SSE servers as needed.
   */
  public async start() {
    // Placeholder: Startup logic for server, e.g., HTTP/SSE server initialization
    // Placeholder: Register additional event listeners, health checks, etc.
    // Placeholder: Logging and telemetry
    this.registerHandlers();
    this._isRunning = true;
  }

  /**
   * Expose the JSONRPCServer handleRequest for integration with HTTP layer
   */
  public async handleRequest(
    request: JSONRPCRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<HandlerResponse> {
    if (!this._isRunning) {
      throw new Error("Server is not running");
    }
    // parse request
    return this._jsonRpcServer.handleRequest(
      request,
      requestAbortSignal,
      extension
    );
  }

  public get agentCard(): AgentCard {
    return this._agentCard;
  }
}
