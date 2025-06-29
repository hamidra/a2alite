import { v4 as uuidv4 } from "uuid";
export class MessageHandler {
    constructor(baseMessage) {
        this.message = {
            kind: "message",
            messageId: baseMessage?.messageId || uuidv4(),
            role: baseMessage?.role || "user",
            parts: baseMessage?.parts ? [...baseMessage.parts] : [],
        };
    }
    withId(messageId) {
        this.message.messageId = messageId;
        return this;
    }
    withRole(role) {
        this.message.role = role;
        return this;
    }
    inResponseTo(source) {
        if (source.kind === "task") {
            // Set context and task ID from a Task
            this.message.contextId = source.contextId;
            this.message.taskId = source.id;
        }
        else if (source.kind === "message") {
            // Set context, task ID, and inResponseTo from a Message
            this.message.contextId = source.contextId;
            this.message.taskId = source.taskId;
        }
        return this;
    }
    withContextId(contextId) {
        this.message.contextId = contextId;
        return this;
    }
    withParts(parts) {
        this.message.parts = [...parts];
        return this;
    }
    addParts(parts) {
        this.message.parts.push(...parts);
        return this;
    }
    addTextPart(text, metadata) {
        this.message.parts.push({
            kind: "text",
            text,
            ...(metadata && { metadata }),
        });
        return this;
    }
    addFilePart(file, metadata) {
        this.message.parts.push({
            kind: "file",
            file,
            ...(metadata && { metadata }),
        });
        return this;
    }
    addDataPart(data, metadata) {
        this.message.parts.push({
            kind: "data",
            data,
            ...(metadata && { metadata }),
        });
        return this;
    }
    clearParts() {
        this.message.parts = [];
        return this;
    }
    withMetadata(metadata) {
        this.message.metadata = {
            ...this.message.metadata,
            ...metadata,
        };
        return this;
    }
    getMessage() {
        return { ...this.message };
    }
    getTextParts() {
        return this.message.parts.filter((part) => part.kind === "text");
    }
    getText() {
        return this.getTextParts()
            .map((part) => part.text)
            .join("\n");
    }
    getFileParts() {
        return this.message.parts.filter((part) => part.kind === "file");
    }
    getFiles() {
        return this.getFileParts().map((part) => part.file);
    }
    getDataParts() {
        return this.message.parts.filter((part) => part.kind === "data");
    }
    getData() {
        return this.getDataParts().map((part) => part.data);
    }
}
