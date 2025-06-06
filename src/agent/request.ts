import { Message, MessageSendConfiguration } from "../types/types.ts";
import { Task } from "../types/types.ts";

type PopulatedMessage = Omit<
  Message,
  "taskId" | "referenceTaskIds" | "parts"
> & {
  task: Task;
  referenceTasks: Task[];
  text: string;
  files: File[];
  data: Record<string, any>;
};

export type AgentRequest = {
  message: PopulatedMessage;
  messageConfiguration: MessageSendConfiguration;
  httpContext: {
    request: Request;
    extension: Record<string, any>;
  };
};
