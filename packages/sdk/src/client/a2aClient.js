import { SendMessageResponseSchema, GetTaskResponseSchema, CancelTaskResponseSchema, SendStreamingMessageResponseSchema, AgentCardSchema, } from "../types/types.js";
export async function fetchAgentCard(baseUrl, path = "/.well-known/agent.json") {
    try {
        const agentCardUrl = new URL(path, baseUrl).href;
        const response = await fetch(agentCardUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch agent card: ${response.statusText}`);
        }
        const agentCard = await response.json();
        const parsed = AgentCardSchema.safeParse(agentCard);
        if (!parsed.success) {
            throw new Error(`Invalid agent card: ${parsed.error.message}`);
        }
        return parsed.data;
    }
    catch (error) {
        throw error;
    }
}
export class A2AClient {
    constructor(agentCard) {
        // validate agent card
        const parsed = AgentCardSchema.safeParse(agentCard);
        if (!parsed.success) {
            throw new Error(`Invalid agent card: ${parsed.error.message}`);
        }
        this._agentCard = parsed.data;
        this._url = parsed.data.url;
    }
    static getNewId() {
        return A2AClient.idCounter++ % A2AClient.idCounterBound;
    }
    async jsonRpcRequest(method, params) {
        const url = this._url;
        const payload = {
            jsonrpc: "2.0",
            method,
            params,
            id: A2AClient.getNewId(),
        };
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        return response;
    }
    async sendMessage(params) {
        const response = await this.jsonRpcRequest("message/send", params);
        const bodyText = await response.text();
        if (!bodyText) {
            throw new Error("Empty response body");
        }
        let json = JSON.parse(bodyText);
        let jsonRpcResponse = SendMessageResponseSchema.parse(json);
        if ("error" in jsonRpcResponse) {
            return jsonRpcResponse.error;
        }
        return jsonRpcResponse.result;
    }
    async getTask(params) {
        const response = await this.jsonRpcRequest("tasks/get", params);
        const bodyText = await response.text();
        if (!bodyText) {
            throw new Error("Empty response body");
        }
        let json = JSON.parse(bodyText);
        let jsonRpcResponse = GetTaskResponseSchema.parse(json);
        if ("error" in jsonRpcResponse) {
            return jsonRpcResponse.error;
        }
        else
            return jsonRpcResponse.result;
    }
    async cancelTask(params) {
        const response = await this.jsonRpcRequest("tasks/cancel", params);
        const bodyText = await response.text();
        if (!bodyText) {
            throw new Error("Empty response body");
        }
        let json = JSON.parse(bodyText);
        let jsonRpcResponse = CancelTaskResponseSchema.parse(json);
        if ("error" in jsonRpcResponse) {
            return jsonRpcResponse.error;
        }
        else
            return jsonRpcResponse.result;
    }
    async *sendStreamMessage(params) {
        const url = this._url;
        const payload = {
            jsonrpc: "2.0",
            method: "message/stream",
            params,
            id: A2AClient.getNewId(),
        };
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
            },
            body: JSON.stringify(payload),
        });
        if (!res.body)
            throw new Error("No response body for SSE stream");
        for await (const eventText of this.parseSSEStream(res.body)) {
            if (!eventText)
                continue;
            let parsed;
            try {
                let json = JSON.parse(eventText);
                parsed = SendStreamingMessageResponseSchema.parse(json);
            }
            catch (e) {
                // TODO: log warning
                console.warn("Invalid JSON-RPC response", e);
                continue;
            }
            if ("error" in parsed) {
                throw parsed.error;
            }
            if ("result" in parsed) {
                yield parsed.result;
            }
            else {
                // TODO: log warning
                yield undefined;
            }
        }
    }
    // TODO: refactor the common code with the sendStreamMessage method in a single private method to be used by both methods
    async *resubscribeTask(params) {
        const url = this._url;
        const payload = {
            jsonrpc: "2.0",
            method: "tasks/resubscribe",
            params,
            id: A2AClient.getNewId(),
        };
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
            },
            body: JSON.stringify(payload),
        });
        if (!res.body)
            throw new Error("No response body for SSE stream");
        for await (const eventText of this.parseSSEStream(res.body)) {
            console.log("resubscribe eventText", eventText);
            if (!eventText)
                continue;
            let parsed;
            try {
                let json = JSON.parse(eventText);
                parsed = SendStreamingMessageResponseSchema.parse(json);
            }
            catch (e) {
                // TODO: log warning
                console.warn("Invalid JSON-RPC response", e);
                continue;
            }
            if ("error" in parsed) {
                throw parsed.error;
            }
            if ("result" in parsed) {
                yield parsed.result;
            }
            else {
                // TODO: log warning
                yield undefined;
            }
        }
    }
    // Helper to parse SSE events from a ReadableStream
    async *parseSSEStream(stream) {
        const decoder = new TextDecoder();
        const reader = stream.getReader();
        let buffer = "";
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                let eventEnd;
                while ((eventEnd = buffer.indexOf("\n\n")) !== -1) {
                    const rawEvent = buffer.slice(0, eventEnd);
                    buffer = buffer.slice(eventEnd + 2);
                    // Only process lines starting with 'data:'
                    const dataLine = rawEvent
                        .split("\n")
                        .find((line) => line.startsWith("data:"));
                    if (dataLine) {
                        yield dataLine.slice(5).trim();
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    // getter for agent card
    get agentCard() {
        return this._agentCard;
    }
    static async getClientFromUrl(baseUrl, path = "/.well-known/agent.json") {
        const agentCard = await fetchAgentCard(baseUrl, path);
        return new A2AClient(agentCard);
    }
}
A2AClient.idCounter = 0;
A2AClient.idCounterBound = 1000000;
