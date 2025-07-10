# 🤖 A2A SDK Developer Guide

**A2ALite** is a lightweight, modular SDK designed to make building **A2A-compliant servers** as simple as building HTTP servers. Inspired by familiar patterns from frameworks like Hono and Express, it offers a minimal, intuitive interface for rapid development.

A2ALite handles the complexity of messaging, streaming, context and task management, and the JSON-RPC protocol, so you can focus entirely on your **agent’s execution logic**. It provides high-level primitives for managing A2A requests and responses, background tasks, and streaming data with ease.

For comprehensive examples of how to implement an A2A-compliant server, explore the [examples](examples) directory.

## Installation

```bash
// using npm
npm install @a2alite/sdk

// using pnpm
pnpm add @a2alite/sdk
```

## Key Features and Benefits

- Simplest way to build A2A-compliant servers.
- Minimal interface, abstracting away A2A protocol complexity.
- Modular, allowing you to easily swap out implementations of components.

## What Needs to Be Implemented

The only thing that needs to be implemented ro enable an agent to process A2A requests is the `IAgentExecutor` interface:

```ts
import { taskNotCancelableError } from "@a2a/sdk/utils/errors";
import {
  MessageHandler,
  ArtifactHandler,
  createTextPart,
} from "@a2a/sdk/utils";

interface IAgentExecutor {
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;
  cancel(task: Task): Promise<Task | JSONRPCError>;
}

class MyAgentExecutor implements IAgentExecutor {
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    // Read the input text message from the request
    const messageText = MessageHandler(
      context.request.params.message
    ).getText();
    const echoCount = 5;

    // return an stream to stream the response
    return context.stream(async (stream) => {
      for (let i = 0; i < echoCount; i++) {
        await stream.writeArtifact({
          artifact: ArtifactHandler.fromText(
            `echo ${i}: ${messageText}`
          ).getArtifact(),
        });
      }
      // complete the task
      await stream.complete();
    });
  }

  cancel(task: Task): Promise<Task | JSONRPCError> {
    return taskNotCancelableError("Task is not cancelable");
  }
}
```

Your implementation gets invoked automatically by the SDK when a message is received.

## Start the A2A server

```ts
import { A2AServer, createHonoApp } from "@a2a/sdk/server";
import { serve } from "@hono/node-server";

// your implementation of IAgentExecutor
import { MyAgentExecutor } from "./myAgent.ts";

const server = new A2AServer({
  agentExecutor: new MyAgentExecutor(),
  agentCard: {
    name: "My Agent",
    description: "A helpful AI assistant that can summarize documents",
    version: "1.0.0",
    url: "http://localhost:3000/a2a",
    skills: [
      {
        id: "doc_summarize",
        name: "document summarization",
        description: "Summarize a document",
      },
    ],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
  },
});

const app = await createHonoApp({ a2aServer: server });

serve(app);
```

---

## Core Concepts

Understanding these four key concepts is essential for building A2A-compatible agents using A2ALite:

### **A2AServer** - Main server orchestrator

The `A2AServer` is the central component that orchestrates all A2A protocol operations:

```ts
const server = new A2AServer({
  agentExecutor: new MyAgent(), // Your agent logic
  agentCard: {
    /* metadata */
  }, // Agent capabilities
  taskStoreFactory, // Optional factory method to create a custom storage
  queueFactory, // Optional factory method to create a custom queuing used by streams
});
```

**Key responsibilities:**

- Handles JSON-RPC protocol communication
- Manages task lifecycle and state transitions
- Provides agent discovery endpoint (`/.well-known/agent.json`)
- Coordinates streaming and real-time updates

### **IAgentExecutor** - Your agent implementation

This is the only interface you need to implement. Your agent logic goes here:

```ts
interface IAgentExecutor {
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;
  cancel(task: Task): Promise<Task | JSONRPCError>;
}
```

**The `execute()` method can return:**

- **Message** - Immediate replies (`context.message()`)
- **Task** - Operations with final or pending results (`context.complete(), context.reject(), context.authRequired(), context.inputRequired()`)
- **Stream** - Long-running operations that stream results and artifacts (`context.stream()`)
- **Error** - possible A2A errors during execution (e.g. `invalidAgentResponseError()`)

### **AgentExecutionContext** - Provided Execution Environment

The `AgentExecutionContext` provides all necessary tools for processing requests and managing responses. It includes methods to create different types of responses, automatically handling the association of context and task IDs. This means you don't need to manually track these IDs, they're automatically handled based on the current context and task when using the context's response methods:

```ts
async execute(context: AgentExecutionContext) {
  // Access request data
  const userMessage = context.request.params.message;
  const currentTask = context.currentTask;  // Continuing a task?

  // process and generate the result artifact
  // ...

  // Create different response types
  return context.complete({
    artifacts: [...resultArtifacts]
  });
}
```

**Available response methods:**

- [`context.message()`](packages/sdk/src/server/agent/context.ts#L274) - return an immediate message response
- [`context.complete()`](packages/sdk/src/server/agent/context.ts#L262) - return a completed task with results
- [`context.reject()`](packages/sdk/src/server/agent/context.ts#L226) - return a rejected task
- [`context.authRequired()`](packages/sdk/src/server/agent/context.ts#L238) - return a task requiring authentication
- [`context.inputRequired()`](packages/sdk/src/server/agent/context.ts#L250) - return a task requiring additional input
- [`context.stream()`](packages/sdk/src/server/agent/context.ts#L206) - return a streaming task allowing for incremental updates (e.g. progress updates, artifacts)

### **AgentTaskStream** - Real-time streaming

For long-running operations, use streaming to provide real-time updates to the client, this is decoupled from how the client receives the updates. If the client has initiated the request as streaming, the updates will be streamed to the client as they are generated. If the client has not initiated the request as streaming, the updates will get aggregated in taskStore allowing the client to either resubscribe to the task or poll for updates.

```ts
return context.stream(async (stream) => {
  // Optional: Set initial state to working,
  await stream.start({
    message: { parts: [createTextPart("Processing...")] },
  });

  // Stream progress updates and artifacts as they are generated ...
  await stream.writeArtifact({
    artifact: ArtifactHandler.fromText(
      "some generated artifact ..."
    ).getArtifact(),
  });

  // check if more input is required
  if (moreInputRequired) {
    // Ask for more input
    await stream.inputRequired({
      message: { parts: [createTextPart("Please provide more input.")] },
    });
  } else {
    // Finalize the stream as the task is completed
    await stream.complete({
      message: { parts: [createTextPart("Complete!")] },
      artifacts: [finalResults],
    });
  }
});
```

**Stream capabilities:**

- Stream artifact updates with `writeArtifact()`
- Handle task state transitions (working → completed/failed/canceled/rejected/input-required/auth-required)
- Automated task lifecycle management with real-time streaming of status updates to clients on state changes.
- Flexible response handling: Clients can choose between streaming responses or polling for updates, regardless of if the agent returns or streams results.

---

## Implementing `execute()`

The `execute(context)` method is called when a new message is received.
Use the `context.stream(callback)` to emit streaming task updates. the callback function is passed an `AgentTaskStream` instance that can be used to stream progress updates and artifacts as they are generated.

---

## `AgentExecutionContext` Cheatsheet

```ts
// access the request context
context.request; // Incoming AgentRequest
context.currentTask; // Possible existing task in this context
context.referenceTasks; // Possible referenced tasks in this context

// generate execution result to return as response
context.complete(params); // Mark task as complete
context.reject(params); // Mark task as rejected
context.authRequired(params); // Request user auth
context.inputRequired(params); // Request user input

// generate the result as a task stream to stream artifacts as they are generated
context.stream(callback); // Begin a task stream
```

---

## Streaming with `AgentTaskStream`

Inside your stream callback, use the stream to emit task events or stream artifacts as they are generated:

```ts
await stream.writeArtifact(...);   // Send one or more artifacts
await stream.complete(...);        // Mark the task as complete
```

if any input is required, use `stream.inputRequired(params)` to request input.

```ts
await stream.inputRequired({
  message: { parts: [createTextPart("Please provide input.")] },
});
```

similarly if authentication is required, use `stream.authRequired(params)` to request authentication.

```ts
await stream.authRequired({
  message: { parts: [createTextPart("Please provide authentication.")] },
});
```

The SDK handles:

- Finalizing the stream
- Aborting if needed
- Managing subscribers
- Updating the task status in the task store
- Keeping the Task, Message, Artifacts context and task id's consistent with the current task and context

---

## Recommended Utilities

Use these helpers to avoid manual object construction.

### Parts

Use [`createTextPart`](packages/sdk/src/utils/part.ts#L12), [`createFilePart`](packages/sdk/src/utils/part.ts#L26), and [`createDataPart`](packages/sdk/src/utils/part.ts#L52) to create parts for messages and artifacts.

```ts
createTextPart("Hello");
createFilePart({ name: "report.pdf", uri: "..." });
createDataPart({ name: "John Doe", age: 42 });
```

### MessageHandler

Use [`MessageHandler`](packages/sdk/src/utils/message.ts#L17) to create messages or parse message parts.

```ts
// create message
const message = new MessageHandler()
  .withRole("agent")
  .addTextPart("Hi there")
  .addFilePart({ name: "report.pdf", uri: "..." })
  .addDataPart({ name: "John Doe", age: 42 })
  .getMessage();

// parse message parts
const text = new MessageHandler(message).getText();
const files = new MessageHandler(message).getFiles();
const data = new MessageHandler(message).getData();
```

### ArtifactHandler

Use [`ArtifactHandler`](packages/sdk/src/utils/artifact.ts#L13) to create artifacts or parse artifact parts.

```ts
// create artifact
const artifact = ArtifactHandler.fromText("Hello")
  .addFilePart({ name: "report.pdf", uri: "..." })
  .addDataPart({ name: "John Doe", age: 42 })
  .getArtifact();

// parse artifact parts
const text = new ArtifactHandler(artifact).getText();
const files = new ArtifactHandler(artifact).getFiles();
const data = new ArtifactHandler(artifact).getData();
```

### TaskHandler (for advanced logic)

Use [`TaskHandler`](packages/sdk/src/utils/task.ts#L13) to create tasks.

```ts
new TaskHandler().withStatus({ state: "working", ... })
```

### Error Builders

Use [error builders](packages/sdk/src/utils/errors.ts) to create A2A errors.

```ts
import { taskNotFoundError } from "@a2a/sdk/utils";

return taskNotFoundError("No such task");
```

---

## Testing Tips

- Use `/a2a` endpoint to POST A2A messages (JSON-RPC).
- Use the `.well-known/agent.json` endpoint to advertise the agent card.
- If streaming, use SSE or re-subscribe via `tasks/resubscribe`.

## Acknowledgments

- [A2A Specification](https://google.github.io/A2A/specification/)
- Inspired by various http server frameworks and communication protocols (express, hono)
