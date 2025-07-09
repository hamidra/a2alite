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

import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

// Define the state structure for the job order form using LangGraph Annotation
const JobOrderFormState = Annotation.Root({
  name: Annotation<string | undefined>,
  dob: Annotation<string | undefined>,
  inquiry: Annotation<string | undefined>,
  currentField: Annotation<"name" | "dob" | "inquiry" | "complete">,
  messages: Annotation<BaseMessage[]>,
  taskId: Annotation<string | undefined>,
});

type JobOrderFormStateType = typeof JobOrderFormState.State;

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
  private static formStates = new Map<string, Partial<JobOrderFormStateType>>();

  private createLangGraphWorkflow() {
    const workflow = new StateGraph(JobOrderFormState);

    // Define nodes for each step
    return workflow
      .addNode("collect_name", this.collectName.bind(this))
      .addNode("collect_dob", this.collectDOB.bind(this))
      .addNode("collect_inquiry", this.collectInquiry.bind(this))
      .addNode("complete_form", this.completeForm.bind(this))
      .addEdge(START, "collect_name")
      .addEdge("collect_name", "collect_dob")
      .addEdge("collect_dob", "collect_inquiry")
      .addEdge("collect_inquiry", "complete_form")
      .addEdge("complete_form", END)
      .compile();
  }

  private async collectName(
    state: JobOrderFormStateType
  ): Promise<Partial<JobOrderFormStateType>> {
    return {
      currentField: "name",
      messages: [
        ...(state.messages || []),
        new AIMessage(
          "Hello! I'll help you fill out a job order form. Let's start with your full name."
        ),
      ],
    };
  }

  private async collectDOB(
    state: JobOrderFormStateType
  ): Promise<Partial<JobOrderFormStateType>> {
    return {
      currentField: "dob",
      messages: [
        ...(state.messages || []),
        new AIMessage(
          `Thank you, ${state.name}! Now, please provide your date of birth (MM/DD/YYYY format).`
        ),
      ],
    };
  }

  private async collectInquiry(
    state: JobOrderFormStateType
  ): Promise<Partial<JobOrderFormStateType>> {
    return {
      currentField: "inquiry",
      messages: [
        ...(state.messages || []),
        new AIMessage(
          "Great! Finally, please describe your current inquiry or the type of work you're looking for."
        ),
      ],
    };
  }

  private async completeForm(
    state: JobOrderFormStateType
  ): Promise<Partial<JobOrderFormStateType>> {
    return {
      currentField: "complete",
      messages: [
        ...(state.messages || []),
        new AIMessage(
          "Perfect! I've collected all the information. Let me stream your completed job order form back to you."
        ),
      ],
    };
  }

  private validateName(name: string): boolean {
    return name.trim().length >= 2;
  }

  private validateDOB(dob: string): boolean {
    const dobRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!dobRegex.test(dob)) return false;

    const date = new Date(dob);
    const now = new Date();
    return date < now && date.getFullYear() > 1900;
  }

  private validateInquiry(inquiry: string): boolean {
    return inquiry.trim().length >= 10;
  }

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const currentTask = context.currentTask;
    const incomingMessage = new MessageHandler(context.request.params.message);
    const messageText = incomingMessage.getText() || "";

    // Initialize or retrieve form state
    let formState: Partial<JobOrderFormStateType>;

    if (!currentTask) {
      // New conversation - start form collection
      formState = {
        currentField: "name",
        messages: [new HumanMessage(messageText)],
      };
    } else {
      // Continuing existing task
      formState = JobOrderFormAgent.formStates.get(currentTask.id) || {
        currentField: "name",
        messages: [new HumanMessage(messageText)],
        taskId: currentTask.id,
      };
    }

    // Process user input based on current field
    if (currentTask?.status.state === "input-required") {
      switch (formState.currentField) {
        case "name":
          if (this.validateName(messageText)) {
            formState.name = messageText.trim();
            formState.currentField = "dob";
          } else {
            return context.inputRequired({
              message: new MessageHandler()
                .withRole("agent")
                .addTextPart(
                  "Please provide a valid name (at least 2 characters, letters and spaces only)."
                )
                .getMessage(),
            });
          }
          break;

        case "dob":
          if (this.validateDOB(messageText)) {
            formState.dob = messageText.trim();
            formState.currentField = "inquiry";
          } else {
            return context.inputRequired({
              message: new MessageHandler()
                .withRole("agent")
                .addTextPart(
                  "Please provide a valid date of birth in MM/DD/YYYY format."
                )
                .getMessage(),
            });
          }
          break;

        case "inquiry":
          if (this.validateInquiry(messageText)) {
            formState.inquiry = messageText.trim();
            formState.currentField = "complete";
          } else {
            return context.inputRequired({
              message: new MessageHandler()
                .withRole("agent")
                .addTextPart(
                  "Please provide a more detailed inquiry (at least 10 characters)."
                )
                .getMessage(),
            });
          }
          break;
      }
    }

    // Handle form progression
    if (formState.currentField === "complete") {
      // Stream the completed form back to the user
      return context.stream(async (stream) => {
        await stream.writeArtifact({
          artifact: new ArtifactHandler()
            .withId("job-order-form")
            .addParts([
              createTextPart("Job Order Form - Completed"),
              createDataPart({
                formType: "Job Order Form",
                submissionDate: new Date().toISOString(),
                applicantName: formState.name,
                dateOfBirth: formState.dob,
                currentInquiry: formState.inquiry,
                status: "completed",
              }),
            ])
            .getArtifact(),
        });

        await stream.complete({
          message: new MessageHandler()
            .withRole("agent")
            .addTextPart(
              `Job Order Form completed successfully!\n\n` +
                `Name: ${formState.name}\n` +
                `Date of Birth: ${formState.dob}\n` +
                `Current Inquiry: ${formState.inquiry}\n\n` +
                `Thank you for providing your information. Your job order form has been processed.`
            )
            .getMessage(),
        });

        // Clean up form state
        if (formState.taskId) {
          JobOrderFormAgent.formStates.delete(formState.taskId);
        }
      });
    }

    // Request next field input
    let promptMessage = "";
    switch (formState.currentField) {
      case "name":
        promptMessage =
          "Hello! I'll help you fill out a job order form. Let's start with your full name.";
        break;
      case "dob":
        promptMessage = `Thank you, ${formState.name}! Now, please provide your date of birth (MM/DD/YYYY format).`;
        break;
      case "inquiry":
        promptMessage =
          "Great! Finally, please describe your current inquiry or the type of work you're looking for.";
        break;
    }

    const task = await context.inputRequired({
      message: new MessageHandler()
        .withRole("agent")
        .addTextPart(promptMessage)
        .getMessage(),
    });

    // Store form state for the task
    JobOrderFormAgent.formStates.set(task.id, {
      ...formState,
      taskId: task.id,
    });

    return task;
  }

  async cancel(task: Task) {
    // Clean up form state when task is cancelled
    JobOrderFormAgent.formStates.delete(task.id);
    return taskNotCancelableError(
      `Task ${task.id} has been cancelled and cleaned up.`
    );
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
