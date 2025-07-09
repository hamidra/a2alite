import { MessageHandler } from "@a2alite/sdk/utils";
import { A2AClient } from "@a2alite/sdk/client";
import type { Task } from "@a2alite/sdk/types";

// Sample data for job order form
const SAMPLE_DATA = {
  name: "John Smith",
  dob: "03/15/1990",
  inquiry:
    "I am looking for a full-time software engineering position with focus on backend development and cloud technologies. I have 5 years of experience in Node.js, Python, and AWS services.",
};

// Form field types that can be detected
type FormFieldType = "name" | "dob" | "inquiry" | "unknown";

class JobOrderFormClient {
  private client: A2AClient;
  private messageCounter = 1;

  constructor(client: A2AClient) {
    this.client = client;
  }

  /**
   * Detect what type of form field is being requested based on the task message
   * In an actual agent, the task message is passed to llm and the llm returns the next response.
   */
  private detectFormFieldType(taskMessage: string): FormFieldType {
    const lowerMessage = taskMessage.toLowerCase();

    if (lowerMessage.includes("name") || lowerMessage.includes("full name")) {
      return "name";
    }

    if (
      lowerMessage.includes("date of birth") ||
      lowerMessage.includes("dob") ||
      lowerMessage.includes("birth") ||
      lowerMessage.includes("mm/dd/yyyy")
    ) {
      return "dob";
    }

    if (
      lowerMessage.includes("inquiry") ||
      lowerMessage.includes("work") ||
      lowerMessage.includes("looking for") ||
      lowerMessage.includes("describe")
    ) {
      return "inquiry";
    }

    return "unknown";
  }

  /**
   * Generate appropriate response based on form field type
   */
  private generateResponse(fieldType: FormFieldType): string {
    switch (fieldType) {
      case "name":
        return SAMPLE_DATA.name;
      case "dob":
        return SAMPLE_DATA.dob;
      case "inquiry":
        return SAMPLE_DATA.inquiry;
      default:
        return "I'm not sure what information you need. Could you please clarify?";
    }
  }

  /**
   * Process a task requiring input and generate appropriate response
   */
  private async processInputRequiredTask(task: Task): Promise<string> {
    if (!task.status.message) {
      console.log("Task requires input but no message provided");
      return "I need more information to proceed.";
    }

    const taskMessage = new MessageHandler(task.status.message).getText() || "";
    console.log(`> Agent: ${taskMessage}\n`);

    const fieldType = this.detectFormFieldType(taskMessage);
    const response = this.generateResponse(fieldType);

    console.log(`Detected field type: ${fieldType}`);
    console.log(`>> User response: ${response}\n`);

    return response;
  }

  /**
   * Run the complete job order form interaction
   */
  async runJobOrderForm(): Promise<void> {
    console.log("Starting Job Order Form Client");
    console.log("Agent Card:", this.client.agentCard.name);
    console.log("Description:", this.client.agentCard.description);
    console.log("");

    // Initial job request message
    const initialMessage = new MessageHandler()
      .withRole("user")
      .withId(this.messageCounter.toString())
      .addTextPart("Hi! I would like to submit a job order form.");

    console.log(`>> User: ${initialMessage.getText()}\n`);
    this.messageCounter++;

    // Send initial message using streaming
    let result = this.client.sendStreamMessage({
      message: initialMessage.getMessage(),
    });

    let conversationActive = true;

    // Main conversation loop
    while (conversationActive) {
      const dataStream = result;
      conversationActive = false;

      // Process stream data
      for await (const data of dataStream) {
        if (data && "kind" in data) {
          if (data.kind === "message") {
            const agentMessage = new MessageHandler(data);
            console.log(`> Agent: ${agentMessage.getText()}\n`);
          } else if (data.kind === "task") {
            if (data.status.state === "input-required") {
              // Process input requirement
              const responseText = await this.processInputRequiredTask(data);

              // Create response message
              const userResponse = new MessageHandler()
                .withRole("user")
                .withId(this.messageCounter.toString())
                .addTextPart(responseText)
                .inResponseTo(data);

              this.messageCounter++;

              // Send response and continue conversation
              result = this.client.sendStreamMessage({
                message: userResponse.getMessage(),
              });
              conversationActive = true;
              break; // Exit inner loop to process new stream
            } else if (data.status.state === "completed") {
              // Handle completion in the stream processing
              console.log("Form submission completed!");
            } else if (data.status.state === "working") {
              console.log("Agent is processing...");
            } else {
              console.log(`Task status: ${data.status.state}`);
            }
          } else if (data.kind === "status-update") {
            console.log(
              `\n===================\n`,
              `Task status updated: \n ${JSON.stringify(data.status, null, 2)}`,
              `\n===================\n`
            );
          } else if (data.kind === "artifact-update") {
            console.log(
              `\n===================\n`,
              `Task artifact updated: \n ${JSON.stringify(data.artifact, null, 2)}`,
              `\n===================\n`
            );
          }
        }
      }
    }

    console.log("\n< Job Order Form interaction completed!");
  }
}

// Main execution function
async function run() {
  try {
    console.log("Connecting to Job Order Form Agent...");
    const client = await A2AClient.getClientFromUrl("http://localhost:3000");

    const jobOrderClient = new JobOrderFormClient(client);
    await jobOrderClient.runJobOrderForm();
  } catch (error) {
    console.error("L Error running job order form client:", error);
    process.exit(1);
  }
}

// Run the client
await run();
