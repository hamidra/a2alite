import { v4 as uuidv4 } from "uuid";
import {
  Message,
  MessageRole,
  Part,
  Task,
  FileWithBytes,
  FileWithUri,
  FilePart,
  TextPart,
  DataPart,
} from "../types/types.ts";

export class MessageHandler {
  private message: Message;

  constructor(baseMessage?: Partial<Message>) {
    this.message = {
      kind: "message",
      messageId: baseMessage?.messageId || uuidv4(),
      role: baseMessage?.role || "user",
      parts: baseMessage?.parts ? [...baseMessage.parts] : [],
    };
  }

  withId(messageId: string): MessageHandler {
    this.message.messageId = messageId;
    return this;
  }

  withRole(role: MessageRole): MessageHandler {
    this.message.role = role;
    return this;
  }

  inResponseTo(source: Task | Message): MessageHandler {
    if (source.kind === "task") {
      // Set context and task ID from a Task
      this.message.contextId = source.contextId;
      this.message.taskId = source.id;
    } else if (source.kind === "message") {
      // Set context, task ID, and inResponseTo from a Message
      this.message.contextId = source.contextId;
      this.message.taskId = source.taskId;
    }
    return this;
  }

  withContextId(contextId: string): MessageHandler {
    this.message.contextId = contextId;
    return this;
  }

  withParts(parts: Part[]): MessageHandler {
    this.message.parts = [...parts];
    return this;
  }

  addParts(parts: Part[]): MessageHandler {
    this.message.parts.push(...parts);
    return this;
  }

  addTextPart(text: string, metadata?: Record<string, any>): MessageHandler {
    this.message.parts.push({
      kind: "text",
      text,
      ...(metadata && { metadata }),
    });
    return this;
  }

  addFilePart(
    file: FileWithBytes | FileWithUri,
    metadata?: Record<string, any>
  ): MessageHandler {
    this.message.parts.push({
      kind: "file",
      file,
      ...(metadata && { metadata }),
    });
    return this;
  }

  addDataPart(data: any, metadata?: Record<string, any>): MessageHandler {
    this.message.parts.push({
      kind: "data",
      data,
      ...(metadata && { metadata }),
    });
    return this;
  }

  clearParts(): MessageHandler {
    this.message.parts = [];
    return this;
  }

  withMetadata(metadata: Record<string, any>): MessageHandler {
    this.message.metadata = {
      ...this.message.metadata,
      ...metadata,
    };
    return this;
  }

  getMessage(): Message {
    return { ...this.message };
  }

  getTextParts(): TextPart[] {
    return this.message.parts.filter(
      (
        part
      ): part is {
        kind: "text";
        text: string;
        metadata?: Record<string, any>;
      } => part.kind === "text"
    );
  }

  getText(): string {
    return this.getTextParts()
      .map((part) => part.text)
      .join("\n");
  }

  getFileParts(): FilePart[] {
    return this.message.parts.filter(
      (
        part
      ): part is {
        kind: "file";
        file: FileWithBytes | FileWithUri;
        metadata?: Record<string, any>;
      } => part.kind === "file"
    );
  }

  getFiles(): Array<FileWithBytes | FileWithUri> {
    return this.getFileParts().map((part) => part.file);
  }

  getDataParts(): DataPart[] {
    return this.message.parts.filter(
      (
        part
      ): part is {
        kind: "data";
        data: any;
        metadata?: Record<string, any>;
      } => part.kind === "data"
    );
  }

  getData(): Record<string, any> {
    return this.getDataParts().map((part) => part.data);
  }
}
