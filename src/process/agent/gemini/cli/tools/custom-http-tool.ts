/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type {
  ToolResult,
  ToolInvocation,
  ToolLocation,
  ToolCallConfirmationDetails,
  MessageBus,
} from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, ToolErrorType, getErrorMessage } from '@office-ai/aioncli-core';
import type { ICustomHttpTool } from '@/common/config/storage';

/**
 * Custom HTTP tool created from user configuration
 */
export class CustomHttpTool extends BaseDeclarativeTool<any, ToolResult> {
  constructor(
    private readonly toolConfig: ICustomHttpTool,
    messageBus: MessageBus
  ) {
    let inputSchemaObj: any = { type: Type.OBJECT, properties: {} };
    try {
      inputSchemaObj = JSON.parse(toolConfig.inputSchema);
    } catch (e) {
      console.error(`[CustomHttpTool] Failed to parse input schema for tool ${toolConfig.name}:`, e);
    }

    super(
      toolConfig.name,
      toolConfig.name,
      toolConfig.description,
      toolConfig.method === 'GET' ? Kind.Fetch : Kind.Execute,
      inputSchemaObj,
      messageBus,
      true, // isOutputMarkdown
      false // canUpdateOutput
    );
  }

  protected createInvocation(
    params: any,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string
  ): ToolInvocation<any, ToolResult> {
    return new CustomHttpInvocation(this.toolConfig, params, messageBus, _toolName, _toolDisplayName);
  }
}

class CustomHttpInvocation extends BaseToolInvocation<any, ToolResult> {
  constructor(
    private readonly toolConfig: ICustomHttpTool,
    params: any,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  getDescription(): string {
    return `Calling custom tool ${this.toolConfig.name} (${this.toolConfig.method} ${this.toolConfig.url})`;
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    // Custom tools might need confirmation as they can have side effects
    return {
      type: 'info',
      title: `Execute ${this.toolConfig.name}?`,
      prompt: `The AI wants to call your custom tool: ${this.toolConfig.name}.\n\nURL: ${this.toolConfig.method} ${this.toolConfig.url}\n\nArguments:\n${JSON.stringify(this.params, null, 2)}`,
      onConfirm: async () => {},
    };
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    try {
      updateOutput?.(`Calling ${this.toolConfig.name}...`);

      let finalUrl = this.toolConfig.url;
      let body: any = null;
      const headersStr = this.toolConfig.headers || '{}';
      const headers = {
        'Content-Type': 'application/json',
        ...JSON.parse(headersStr),
      };

      if (this.toolConfig.method === 'GET' || this.toolConfig.method === 'DELETE') {
        const query = new URLSearchParams(this.params).toString();
        if (query) {
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + query;
        }
      } else {
        body = JSON.stringify(this.params);
      }

      const response = await fetch(finalUrl, {
        method: this.toolConfig.method,
        headers,
        body,
        signal,
      });

      const resultText = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${resultText}`);
      }

      return {
        llmContent: resultText,
        returnDisplay: `Tool ${this.toolConfig.name} executed successfully.`,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `Error calling ${this.toolConfig.name}: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}
