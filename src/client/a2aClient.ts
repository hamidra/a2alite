import {
  MessageSendParams,
  SendMessageSuccessResponse,
  GetTaskSuccessResponse,
  CancelTaskSuccessResponse,
  SendStreamingMessageSuccessResponse,
  TaskQueryParams,
  TaskIdParams,
  JSONRPCError,
  JSONRPCRequest,
  RequestsByMethod,
  SendMessageResponseSchema,
  GetTaskResponseSchema,
  CancelTaskResponseSchema,
  SendStreamingMessageResponseSchema,
  SendStreamingMessageResponse,
  AgentCardSchema,
  AgentCard,
} from "../types/types.ts";

export async function fetchAgentCard(
  baseUrl: string,
  path: string = "/.well-known/agent.json"
): Promise<AgentCard> {
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
  } catch (error) {
    throw error;
  }
}

export class A2AClient {
  private _url: string;
  private _agentCard: AgentCard;
  private static idCounter: number = 0;
  private static idCounterBound: number = 1000000;

  constructor(agentCard: AgentCard) {
    // validate agent card
    const parsed = AgentCardSchema.safeParse(agentCard);
    if (!parsed.success) {
      throw new Error(`Invalid agent card: ${parsed.error.message}`);
    }
    this._agentCard = parsed.data;
    this._url = parsed.data.url;
  }

  private static getNewId() {
    return A2AClient.idCounter++ % A2AClient.idCounterBound;
  }

  private async jsonRpcRequest<M extends keyof RequestsByMethod>(
    method: M,
    params: RequestsByMethod[M]["params"]
  ): Promise<Response> {
    const url = this._url;

    const payload: JSONRPCRequest = {
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

  async sendMessage(
    params: MessageSendParams
  ): Promise<SendMessageSuccessResponse["result"] | JSONRPCError> {
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

  async getTask(
    params: TaskQueryParams
  ): Promise<GetTaskSuccessResponse["result"] | JSONRPCError> {
    const response = await this.jsonRpcRequest("tasks/get", params);
    const bodyText = await response.text();
    if (!bodyText) {
      throw new Error("Empty response body");
    }
    let json = JSON.parse(bodyText);
    let jsonRpcResponse = GetTaskResponseSchema.parse(json);
    if ("error" in jsonRpcResponse) {
      return jsonRpcResponse.error;
    } else return jsonRpcResponse.result;
  }

  async cancelTask(
    params: TaskIdParams
  ): Promise<CancelTaskSuccessResponse["result"] | JSONRPCError> {
    const response = await this.jsonRpcRequest("tasks/cancel", params);
    const bodyText = await response.text();
    if (!bodyText) {
      throw new Error("Empty response body");
    }
    let json = JSON.parse(bodyText);
    let jsonRpcResponse = CancelTaskResponseSchema.parse(json);
    if ("error" in jsonRpcResponse) {
      return jsonRpcResponse.error;
    } else return jsonRpcResponse.result;
  }

  async *sendStreamMessage(
    params: MessageSendParams
  ): AsyncGenerator<
    SendStreamingMessageSuccessResponse["result"] | JSONRPCError | undefined
  > {
    const url = this._url;
    const payload: JSONRPCRequest = {
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

    if (!res.body) throw new Error("No response body for SSE stream");
    for await (const eventText of this.parseSSEStream(res.body)) {
      if (!eventText) continue;
      let parsed: SendStreamingMessageResponse;
      try {
        let json = JSON.parse(eventText);
        parsed = SendStreamingMessageResponseSchema.parse(json);
      } catch (e) {
        // TODO: log warning
        console.warn("Invalid JSON-RPC response", e);
        continue;
      }
      if ("error" in parsed) {
        throw parsed.error;
      }
      if ("result" in parsed) {
        yield parsed.result;
      } else {
        // TODO: log warning
        yield undefined;
      }
    }
  }

  // TODO: refactor the common code with the sendStreamMessage method in a single private method to be used by both methods
  async *resubscribeTask(
    params: TaskIdParams
  ): AsyncGenerator<
    SendStreamingMessageSuccessResponse["result"] | JSONRPCError | undefined
  > {
    const url = this._url;
    const payload: JSONRPCRequest = {
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

    if (!res.body) throw new Error("No response body for SSE stream");
    for await (const eventText of this.parseSSEStream(res.body)) {
      console.log("resubscribe eventText", eventText);
      if (!eventText) continue;
      let parsed: SendStreamingMessageResponse;
      try {
        let json = JSON.parse(eventText);
        parsed = SendStreamingMessageResponseSchema.parse(json);
      } catch (e) {
        // TODO: log warning
        console.warn("Invalid JSON-RPC response", e);
        continue;
      }
      if ("error" in parsed) {
        throw parsed.error;
      }
      if ("result" in parsed) {
        yield parsed.result;
      } else {
        // TODO: log warning
        yield undefined;
      }
    }
  }

  // Helper to parse SSE events from a ReadableStream
  private async *parseSSEStream(
    stream: ReadableStream<Uint8Array>
  ): AsyncGenerator<string> {
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;
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
    } finally {
      reader.releaseLock();
    }
  }

  // getter for agent card
  get agentCard(): AgentCard {
    return this._agentCard!;
  }

  static async getClientFromUrl(
    baseUrl: string,
    path: string = "/.well-known/agent.json"
  ): Promise<A2AClient> {
    const agentCard = await fetchAgentCard(baseUrl, path);
    return new A2AClient(agentCard);
  }
}
