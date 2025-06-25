import { MessageHandler } from "../../utils/message.ts";
import { A2AClient } from "../../client/a2aClient.ts";
import { isJSONRPCError } from "src/types/types.ts";

const client = new A2AClient("http://localhost:3000/a2a");

async function run() {
  const userMessage = new MessageHandler()
    .withRole("user")
    .withId("1")
    .addTextPart("Hello. please echo!");

  console.log("user: ", userMessage.getText());
  console.log("user message details:\n", userMessage.getMessage());

  let result: any = client.sendStreamMessage({
    message: userMessage.getMessage(),
  });
  let done = false;

  // continue until the multi turn conversation is completed
  while (!done) {
    // we might reset the stream for new user input, so we use a new variable
    const dataStream = result;
    done = true;
    // Iterate over the stream
    for await (const data of dataStream) {
      if (data) {
        if ("kind" in data) {
          if (data.kind === "message") {
            const agentMessage = new MessageHandler(data);
            console.log("agent message: ", agentMessage.getText());
            console.log("agent message details:\n", agentMessage.getMessage());
          } else if (
            data.kind === "task" &&
            data.status.state === "input-required"
          ) {
            const task = data;
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
            result = await client.sendStreamMessage({
              message: userResponse.getMessage(),
            });
            done = false;
          } else {
            console.log("other data", data);
          }
        }
      }
    }
  }
}

await run();
