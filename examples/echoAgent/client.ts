import { MessageHandler } from "@a2alite/sdk/utils";
import { A2AClient } from "@a2alite/sdk/client";

async function run() {
  const client = await A2AClient.getClientFromUrl("http://localhost:3000");

  // print agent card
  console.log("agent card:\n", client.agentCard);

  const userMessage = new MessageHandler()
    .withRole("user")
    .withId("1")
    .addTextPart("Hello. please echo!");

  console.log("user: ", userMessage.getText());
  console.log("user message details:\n", userMessage.getMessage());

  let result = await client.sendMessage({
    message: userMessage.getMessage(),
  });

  if ("kind" in result) {
    if (result.kind === "message") {
      const agentMessage = new MessageHandler(result);
      console.log("agent message: ", agentMessage.getText());
      console.log("agent message details:\n", agentMessage.getMessage());
    } else if (
      result.kind === "task" &&
      result.status.state === "input-required"
    ) {
      const task = result;
      if (task.status.message) {
        console.log("agent task message:");
        console.log(new MessageHandler(task.status.message).getText());
        console.log("agent task details:\n", task);
      }
      // send user response
      const userResponse = new MessageHandler()
        .withRole("user")
        .withId("3")
        .addTextPart("5")
        .inResponseTo(task);

      console.log("user response: ", userResponse.getText());
      console.log("user response details:\n", userResponse.getMessage());
      result = await client.sendMessage({
        message: userResponse.getMessage(),
      });

      if (
        "kind" in result &&
        result.kind === "task" &&
        result.status.state === "completed"
      ) {
        console.log("task completed");
        for (const artifact of result.artifacts || []) {
          console.log(artifact);
          for (const part of artifact.parts) {
            if (part.kind === "text") {
              console.log(part.text);
            }
          }
        }
      } else {
        console.log(result);
      }
    }
  }
}

await run();
