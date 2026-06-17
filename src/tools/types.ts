export interface VapiToolCall {
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface VapiToolResponse {
  results: Array<{
    toolCallId: string;
    result: string;
  }>;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;
