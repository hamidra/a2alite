import type {
  IAgentExecutor,
  AgentExecutionContext,
  AgentExecutionResult,
} from "@a2alite/sdk/server";
import type { Task, AgentCard } from "@a2alite/sdk/types";

import { serve } from "@hono/node-server";
import { createHonoApp, A2AServer } from "@a2alite/sdk/server";
import {
  taskNotCancelableError,
  createTextPart,
  createDataPart,
  MessageHandler,
  ArtifactHandler,
} from "@a2alite/sdk/utils";

import { createJobOrderFormAgent } from "./agent.ts";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

// Agent card configuration
const agentCard: AgentCard = {
  name: "Job Order Form Agent",
  description:
    "A LangGraph-based agent that collects job order form information and streams the completed form back to you.",
  url: "http://localhost:3000/a2a",
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  skills: [
    {
      id: "job_order_form",
      name: "Job Order Form Collection",
      description:
        "Collects job order form information including name, date of birth, and current inquiry.",
      tags: ["form", "collection", "job-order"],
    },
  ],
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
};

// LangGraph-based Job Order Form Agent
class JobOrderFormAgent implements IAgentExecutor {
  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const currentTask = context.currentTask;
    const incomingMessage = new MessageHandler(context.request.params.message);
    const messageText = incomingMessage.getText() || "";

    // Create and use LangGraph workflow with memory
    const orderFormAgent = createJobOrderFormAgent();

    // Context id is already resolved for existing tasks to relevant context and can be used as thread id
    const config = {
      configurable: { thread_id: context.id },
    };

    let agentResult;
    if (currentTask && currentTask.status.state === "input-required") {
      // if this is a response to input required, resume the agent
      agentResult = await orderFormAgent.invoke(
        new Command({ resume: messageText }),
        config
      );
    } else {
      // if this is a new message, start the agent
      agentResult = await orderFormAgent.invoke(
        { messages: [new HumanMessage(messageText)] },
        config
      );
    }
    // if agent is interrupted, ask for input
    const agentState = await orderFormAgent.getState(config);
    const interrupt = agentState.tasks?.[0]?.interrupts?.[0];
    if (interrupt) {
      return context.inputRequired({
        message: {
          parts: [createTextPart(interrupt.value as string)],
        },
      });
    }

    // Stream the completed form back to the user
    return context.stream(async (stream) => {
      // stream the form as artifact
      await stream.writeArtifact({
        artifact: new ArtifactHandler()
          .withId("job-order-form")
          .addParts([
            createTextPart("Filed Job Order Form"),
            createDataPart({
              formType: "Job Order Form",
              submissionDate: new Date().toISOString(),
              applicantName: agentResult.name,
              dateOfBirth: agentResult.dob,
              currentInquiry: agentResult.inquiry,
              status: "completed",
            }),
          ])
          .getArtifact(),
      });
      // stream the final message as complete
      await stream.complete({
        message: new MessageHandler()
          .withRole("agent")
          .addTextPart("your job inquiry was successfully filed!")
          .getMessage(),
      });
    });
  }

  async cancel(task: Task) {
    return taskNotCancelableError(`Task ${task.id} cannot be cancelled.`);
  }
}

// Create and start the A2A server
const a2aServer = new A2AServer({
  agentExecutor: new JobOrderFormAgent(),
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
        console.log(
          `Job Order Form Agent is running on http://localhost:${info.port}`
        );
        console.log(
          `Agent Card: http://localhost:${info.port}/.well-known/agent.json`
        );
      }
    );
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
  });
