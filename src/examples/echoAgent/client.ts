import { populateMessage } from "../../agent/request.ts";
import { A2AClient } from "../../client/a2aClient.ts";

const client = new A2AClient("http://localhost:3000/a2a");

async function run() {
  let result = await client.sendMessage({
    message: {
      kind: "message",
      role: "user",
      messageId: "1",
      parts: [
        {
          kind: "text",
          text: "Hello. please echo!",
        },
      ],
    },
  });

  if ("kind" in result) {
    if (result.kind === "message") {
      const message = populateMessage(result);
      console.log("\n\n---message---");
      console.log(message.text);
    } else if (
      result.kind === "task" &&
      result.status.state === "input-required"
    ) {
      const task = result;
      console.log("\n\n---task---");
      console.log(task);
      if (task.status.message) {
        console.log("task message:");
        console.log(populateMessage(task.status.message).text);
      }
      result = await client.sendMessage({
        message: {
          kind: "message",
          role: "user",
          messageId: "10",
          parts: [
            {
              kind: "text",
              text: "5",
            },
          ],
          taskId: task.id,
          contextId: task.contextId,
        },
      });
      console.log(result);
      if (
        "kind" in result &&
        result.kind === "task" &&
        result.status.state === "completed"
      ) {
        console.log("\n\n---task completed---");
        for (const artifact of result.artifacts || []) {
          console.log(artifact);
          for (const part of artifact.parts) {
            if (part.kind === "text") {
              console.log(part.text);
            }
          }
        }
      }
    } else {
      console.log(result);
    }
  }
}

await run();
