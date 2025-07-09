import { serve } from "@hono/node-server";
import type {
  IAgentExecutor,
  AgentExecutionContext,
} from "@a2alite/sdk/server";
import type { Task, Part, AgentCard } from "@a2alite/sdk/types";
import { createHonoApp, A2AServer } from "@a2alite/sdk/server";

import {
  taskNotCancelableError,
  createTextPart,
  MessageHandler,
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
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
};

// Echo executor implementing IAgentExecutor
class EchoAgentExecutor implements IAgentExecutor {
  static messageMemory = new Map<string, string>();

  async execute(context: AgentExecutionContext) {
    let currentTask = context.currentTask;
    let message = new MessageHandler(context.request.params.message);

    // if no task is set, it is a new message, store message in memory and ask for number of times to echo
    if (!currentTask) {
      const task = await context.inputRequired({
        message: {
          parts: [
            createTextPart(
              "Hello!\nHow many times would you like me to echo your message?"
            ),
          ],
        },
      });
      // store message in memory to be used for echo
      EchoAgentExecutor.messageMemory.set(task.id, message.getText());
      return task;
    }

    // continuation of a paused task

    // check if the current task is waiting for input
    if (currentTask.status.state === "input-required") {
      const echoCount = parseInt(message.getText());
      // if not a number, ask for a number
      if (isNaN(echoCount)) {
        const task = await context.inputRequired({
          message: {
            parts: [createTextPart("Please provide a valid number.")],
          },
        });
        return task;
      }
      // echo message
      const echoMessage = EchoAgentExecutor.messageMemory.get(currentTask.id);

      if (!echoMessage) {
        return context.reject({
          message: {
            parts: [createTextPart("The message to echo was not found.")],
          },
        });
      }

      let parts: Part[] = [];
      for (let i = 0; i < echoCount; i++) {
        parts.push(createTextPart(echoMessage));
      }

      return context.complete({
        artifacts: [
          {
            artifactId: "artifact-1",
            parts,
          },
        ],
      });
    }

    // the task is not expecting any input
    return context.message({
      parts: [
        createTextPart(
          `The task is currently in ${currentTask.status.state} state. Not expecting any input in this state.`
        ),
      ],
    });
  }

  async cancel(task: Task) {
    return taskNotCancelableError(`Task ${task.id} cannot be canceled.`);
  }
}

const a2aServer = new A2AServer({
  agentExecutor: new EchoAgentExecutor(),
  agentCard,
});

console.log("Agent card:\n", JSON.stringify(a2aServer.agentCard, null, 2));

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
