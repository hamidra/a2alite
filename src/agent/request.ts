import { Message, MessageSendConfiguration } from "../types/types.ts";
import { Task } from "../types/types.ts";

type PopulatedMessage = Omit<
  Message,
  "taskId" | "referenceTaskIds" | "parts"
> & {
  text: string;
  files: File[];
  data: Array<Record<string, any>>;
};

export function populateMessage(message: Message): PopulatedMessage {
  return {
    ...message,
    text: message.parts
      .filter((part) => part.kind === "text")
      .map((part) => part.text)
      .join("\n"),
    // TODO: implement files
    files: [],
    data: message.parts
      .filter((part) => part.kind === "data")
      .map((part) => part.data),
  };
}
