# 🤖↔️🤖 A2A SDK Developer Guide

A2ALite is minimal modular SDK that simplifies building an **A2A-compliant server** by implementing a minimal interface. The SDK handles messaging, streaming, context and task management, and JSON-RPC protocol; to develop your agent, you only need to define your **agent's execution logic**.

---

## 📦 What Needs to Be Implemented

The only thing you implement is the `IAgentExecutor` interface:

```ts
interface IAgentExecutor {
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;
  cancel(task: Task): Promise<Task | JSONRPCError>;
}
```

Your implementation gets invoked automatically by the SDK when a message is received.

---

## 🚀 Quick Start

```ts
import { A2AServer } from "@a2a/sdk/server";
import { createHonoApp } from "@a2a/sdk/server/http/hono";
import { MyAgentExecutor } from "./myAgent.ts";

const server = new A2AServer({
  agentExecutor: new MyAgentExecutor(),
  agentCard: {
    id: "my-agent",
    name: "My Agent",
    version: "1.0.0",
  },
});

const app = await createHonoApp({ a2aServer: server });

app.fire(); // or equivalent for your server runtime
```

---

## 🧠 Core Concepts

Understanding these four key concepts is essential for building A2A-compatible agents using A2ALite:

### 🚀 **A2AServer** - Main server orchestrator

The `A2AServer` is the central component that orchestrates all A2A protocol operations:

```ts
const server = new A2AServer({
  agentExecutor: new MyAgent(), // Your agent logic
  agentCard: {
    /* metadata */
  }, // Agent capabilities
  taskStoreFactory, // Optional: Custom storage
  queueFactory, // Optional: Custom queuing
});
```

**Key responsibilities:**

- Handles JSON-RPC protocol communication
- Manages task lifecycle and state transitions
- Provides agent discovery endpoint (`/.well-known/agent.json`)
- Coordinates streaming and real-time updates

### 🎯 **IAgentExecutor** - Your agent implementation

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
- **Stream** - Long-running operations (`context.stream()`)
- **Error** - possible A2A erros during execution (e.g. `invalidAgentResponseError()`)

### 📋 **AgentExecutionContext** - Rich execution environment

The `AgentExecutionContext` provides all necessary tools for processing requests and managing responses. It includes methods to create different types of responses, automatically handling the association of context and task IDs. This means you don't need to manually track these IDs - they're automatically handled based on the current context and task when using the context's response methods:

```ts
async execute(context: AgentExecutionContext) {
  // Access request data
  const userMessage = context.request.params.message;
  const currentTask = context.currentTask;  // Continuing a task?

  // process and generate the result artifact
  // ...

  // Create different response types
  return context.complete({
    message: { parts: [{ kind: 'text', text: 'Done!' }] },
    artifacts: [results]
  });
}
```

**Available response methods:**

- `context.message()` - return an immediate message response
- `context.complete()` - return a completed task with results
- `context.reject()` - return a rejected task
- `context.authRequired()` - return a task requiring authentication
- `context.inputRequired()` - return a task requiring additional input
- `context.stream()` - return a streaming task allowing for incremental updates (e.g. progress updates, artifacts)

### 🌊 **AgentTaskStream** - Real-time streaming

For long-running operations, use streaming to provide real-time updates to the client, this is decoupled from how the client receives the updates. If the client has initiated the request as streaming, the updates will be sent as they are generated. If the client has not initiated the request as streaming, the updates will aggregated in taskStore allowing the client to either resubscribe to the task or poll for updates.

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

  // Finalize the stream as the task is completed, requested more input or reached to any final or pending state
  await stream.complete({
    message: { parts: [createTextPart("Complete!")] },
    artifacts: [finalResults],
  });
});
```

**Stream capabilities:**

- stream progress updates with `writeArtifact()`
- Automatic stream lifecycle management
- Task state transitions (working → completed/failed/canceled/rejected/input-required/auth-required)
- Decoupled streaming from how the client receives the updates (Client can subscribe/resubscribe to ongoing streams)

---

## 🧩 Implementing `execute()`

The `execute(context)` method is called when a new message is received.

Use the `context.stream(callback)` to emit streaming task updates. the callback function is passed an `AgentTaskStream` instance that can be used to stream progress updates and artifacts as they are generated.

### ✅ Example: Streamed Execution

```ts
import { IAgentExecutor } from "@a2a/sdk/server/agent/executor";
import { AgentTaskStream } from "@a2a/sdk/server/agent/stream";
import { createTextPart } from "@a2a/sdk/utils/part";
import { ArtifactHandler } from "@a2a/sdk/utils/artifact";

export class MyAgentExecutor implements IAgentExecutor {
  async execute(context) {
    return context.stream(async (stream: AgentTaskStream) => {
      await stream.start({
        message: { parts: [createTextPart("Starting...")] },
      });

      const artifact = ArtifactHandler.fromText(
        "Hello from MyAgent!"
      ).getArtifact();
      await stream.writeArtifact({ artifact });

      await stream.complete({ message: { parts: [createTextPart("Done.")] } });
    });
  }

  async cancel(task) {
    return { ...task, status: { ...task.status, state: "canceled" } };
  }
}
```

---

## 🛠 `AgentExecutionContext` Cheatsheet

```ts
context.request; // Incoming AgentRequest
context.currentTask; // Possible existing task in this context
context.referenceTasks; // Possible referenced tasks in this context

context.stream(callback); // Begin a streamed task
context.complete(params); // Mark task as complete
context.reject(params); // Mark task as rejected
context.authRequired(params); // Request user auth
context.inputRequired(params); // Request user input
```

---

## 📡 Streaming with `AgentTaskStream`

Inside your stream callback, use the stream to emit task events:

```ts
await stream.writeArtifact(...);   // Send one or more artifacts
await stream.complete(...);        // Mark the task as complete
```

if any input is required, use `context.inputRequired(params)`

```ts
await context.inputRequired({
  message: { parts: [createTextPart("Please provide input.")] },
});
```

The SDK handles:

- Finalizing the stream
- Aborting if needed
- Managing subscribers
- Updating the task status in the task store
- Keeping the Task, Message, Artifacts context and task id's consistent with the current task and context

---

## ✨ Recommended Utilities

Use these helpers to avoid manual object construction.

### 🧱 Parts

```ts
createTextPart("Hello");
createFilePart({ name: "report.pdf", uri: "..." });
createDataPart({ name: "John Doe", age: 42 });
```

### 💬 MessageHandler

```ts
new MessageHandler().withRole("agent").addTextPart("Hi there").getMessage();
```

### 📦 ArtifactHandler

```ts
ArtifactHandler.fromText("Hello").getArtifact();
```

### 🧠 TaskHandler (for advanced logic)

```ts
new TaskHandler().withStatus({ state: "working", ... })
```

### ❗ Error Builders

```ts
import { taskNotFoundError } from "@a2a/sdk/utils/errors";

return taskNotFoundError("No such task");
```

---

## 🧪 Testing Tips

- Use `/a2a` endpoint to POST A2A messages (JSON-RPC).
- Use the `.well-known/agent.json` endpoint to advertise the agent card.
- If streaming, use SSE or re-subscribe via `tasks/resubscribe`.

## Acknowledgments

- [A2A Specification](https://google.github.io/A2A/specification/)
- Inspired by various agent frameworks and communication protocols
