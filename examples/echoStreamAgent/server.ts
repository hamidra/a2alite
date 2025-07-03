import type {
  IAgentExecutor,
  AgentExecutionContext,
} from "@a2alite/sdk/server";
import type { Task, AgentCard } from "@a2alite/sdk/types";
import { serve } from "@hono/node-server";
import { createHonoApp, A2AServer } from "@a2alite/sdk/server";
import {
  taskNotCancelableError,
  createTextPart,
  MessageHandler,
  ArtifactHandler,
} from "@a2alite/sdk/utils";

const agentCard: AgentCard = {
  name: "Echo Agent",
  description: "An echo agent that echoes your message.",
  url: "http://localhost:3000/a2a",
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  skills: [
    {
      id: "echo",
      name: "echo",
      description: "Echoes your message.",
      tags: ["echo"],
    },
  ],
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

// Dummy executor implementing IAgentExecutor
class EchoAgentExecutor implements IAgentExecutor {
  static messageMemory = new Map<string, string>();

  async execute(context: AgentExecutionContext) {
    let currentTask = context.currentTask;
    let incomingMessage = new MessageHandler(context.request.params.message);

    // if no task is set, it is a new message, store message in memory and ask for number of times to echo
    if (!currentTask) {
      const task = await context.inputRequired({
        message: new MessageHandler()
          .withRole("agent")
          .addTextPart(
            "Hello!\nHow many times would you like me to echo your message?"
          )
          .getMessage(),
      });
      // store message in memory to be used for echo
      EchoAgentExecutor.messageMemory.set(task.id, incomingMessage.getText());
      return task;
    }

    // continuation of a paused task

    // check if the current task is waiting for input
    if (currentTask.status.state === "input-required") {
      const echoCount = parseInt(incomingMessage.getText());
      // if not a number, ask for a number
      if (isNaN(echoCount)) {
        const task = await context.inputRequired({
          message: new MessageHandler()
            .withRole("agent")
            .addTextPart("Please send a valid number.")
            .getMessage(),
        });
        return task;
      }
      // echo message
      return await context.stream(async (stream) => {
        const echoMessage = EchoAgentExecutor.messageMemory.get(currentTask.id);
        if (echoMessage) {
          for (let i = 0; i < echoCount; i++) {
            await stream.writeArtifact({
              artifact: new ArtifactHandler()
                .withId("artifact-1")
                .addParts([createTextPart(echoMessage)])
                .getArtifact(),
              append: true,
              lastChunk: i === echoCount - 1,
            });
            // sleep for 1000ms
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          stream.complete({});
        } else {
          stream.reject({
            message: new MessageHandler()
              .withRole("agent")
              .addTextPart("The message to echo was not found.")
              .getMessage(),
          });
        }
      });
    } else {
      return context.message({
        parts: [
          createTextPart(
            `The task is currently in ${currentTask.status.state} state. Not expecting any input in this state.`
          ),
        ],
      });
    }
  }

  async cancel(task: Task) {
    return taskNotCancelableError(`Task ${task.id} cannot be canceled.`);
  }
}

const a2aServer = new A2AServer({
  agentExecutor: new EchoAgentExecutor(),
  agentCard,
});

createHonoApp({ a2aServer })
  .then((app) => {
    serve(
      {
        fetch: app.fetch,
        port: 3000,
      },
      (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
      }
    );
  })
  .catch((err) => {
    console.error(err);
  });
