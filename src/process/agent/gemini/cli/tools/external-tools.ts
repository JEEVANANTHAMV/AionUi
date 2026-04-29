/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  getErrorMessage,
  ToolErrorType,
  type Config,
  type MessageBus,
  type ToolResult,
  type ToolInvocation,
} from '@office-ai/aioncli-core';
import { uuid } from '@/common/utils';
// @ts-ignore - executeToolCall is not re-exported from main entry but exists in subpath
import { executeToolCall } from '@office-ai/aioncli-core/dist/src/core/nonInteractiveToolExecutor.js';
import { extendedToolsService } from '@/process/services/extendedToolsService';

export interface ListExternalToolsParams {
  search_query?: string;
}

export class ListExternalToolsTool extends BaseDeclarativeTool<ListExternalToolsParams, ToolResult> {
  static readonly Name: string = 'list_external_tools';

  constructor(
    private readonly config: Config,
    messageBus: MessageBus
  ) {
    super(
      ListExternalToolsTool.Name,
      'List External Tools',
      'Lists available tools in the system, including their usage, descriptions, and required parameters. Use this to discover tools that are not currently active in the session. You can search for specific tools using the search_query parameter.',
      Kind.Search,
      {
        type: Type.OBJECT,
        properties: {
          search_query: {
            type: Type.STRING,
            description: 'A search pattern to filter tools by name or description (e.g., "git", "browser"). If omitted, lists a summary of available tools.',
          },
        },
      },
      messageBus,
      true, // isOutputMarkdown
      false // canUpdateOutput
    );
  }

  protected createInvocation(
    params: ListExternalToolsParams,
    messageBus: MessageBus
  ): ToolInvocation<ListExternalToolsParams, ToolResult> {
    return new ListExternalToolsInvocation(this.config, params, messageBus);
  }
}

class ListExternalToolsInvocation extends BaseToolInvocation<ListExternalToolsParams, ToolResult> {
  constructor(
    private readonly config: Config,
    params: ListExternalToolsParams,
    messageBus: MessageBus
  ) {
    super(params, messageBus);
  }

  getDescription(): string {
    return this.params.search_query
      ? `Searching for tools matching "${this.params.search_query}"`
      : 'Listing all available external tools';
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const toolRegistry = await this.config.getToolRegistry();
      const tools: any[] = [];

      // Robustly extract tools from toolRegistry
      for (const key of Object.getOwnPropertyNames(toolRegistry)) {
        const prop = (toolRegistry as any)[key];
        if (prop instanceof Map) {
          for (const [name, tool] of prop.entries()) {
            tools.push(tool);
          }
        } else if (Array.isArray(prop)) {
          tools.push(...prop);
        }
      }

      if (typeof (toolRegistry as any).getTools === 'function') {
        const result = (toolRegistry as any).getTools();
        if (Array.isArray(result)) tools.push(...result);
        else if (result instanceof Map) tools.push(...result.values());
      }

      const uiTools = extendedToolsService.getEnabledTools();
      for (const uiTool of uiTools) {
        tools.push({
          name: uiTool.id,
          description: uiTool.descriptionKey || 'No description available.',
          schema: uiTool.schema || {
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        });
      }

      // Deduplicate tools by name
      const uniqueTools = new Map<string, any>();
      for (const tool of tools) {
        if (tool && tool.name && !uniqueTools.has(tool.name)) {
          uniqueTools.set(tool.name, tool);
        }
      }

      const query = this.params.search_query?.toLowerCase();
      const matchedTools: any[] = [];

      for (const [name, tool] of uniqueTools.entries()) {
        // Skip self-referencing proxy tools
        if (name === ListExternalToolsTool.Name || name === 'execute_external_tool') {
          continue;
        }

        const desc = tool.description || '';
        const displayName = tool.displayName || name;

        if (!query || name.toLowerCase().includes(query) || desc.toLowerCase().includes(query) || displayName.toLowerCase().includes(query)) {
          matchedTools.push(tool);
        }
      }

      if (matchedTools.length === 0) {
        return {
          llmContent: query 
            ? `No external tools found matching "${this.params.search_query}".`
            : 'No external tools found in the system.',
          returnDisplay: 'No tools found.',
        };
      }

      // Format the output
      let output = `### Found ${matchedTools.length} External Tools:\n\n`;

      const isDetailed = !!query;

      if (!isDetailed) {
        output += `*Note: To view the required parameters and detailed schema for a specific tool, run \`list_external_tools(search_query='tool_name')\`.*\n\n`;
      }

      for (const tool of matchedTools) {
        const schema = tool.schema || {};
        output += `#### \`${tool.name}\`\n`;
        output += `- **Description**: ${tool.description || 'No description available.'}\n`;
        
        if (isDetailed) {
          if (schema.parametersJsonSchema) {
            output += `- **Parameters**:\n\`\`\`json\n${JSON.stringify(schema.parametersJsonSchema, null, 2)}\n\`\`\`\n`;
          } else if (schema.parameters) {
            output += `- **Parameters**:\n\`\`\`json\n${JSON.stringify(schema.parameters, null, 2)}\n\`\`\`\n`;
          } else if (tool.parameterSchema) {
            output += `- **Parameters**:\n\`\`\`json\n${JSON.stringify(tool.parameterSchema, null, 2)}\n\`\`\`\n`;
          } else {
            output += `- **Parameters**: None required.\n`;
          }
        }
        output += `\n---\n`;
      }

      return {
        llmContent: output,
        returnDisplay: `Found ${matchedTools.length} tools.`,
      };
    } catch (e) {
      const errorMessage = getErrorMessage(e);
      return {
        llmContent: `Error listing tools: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export interface ExecuteExternalToolParams {
  tool_name: string;
  arguments: Record<string, any>;
}

export class ExecuteExternalToolTool extends BaseDeclarativeTool<ExecuteExternalToolParams, ToolResult> {
  static readonly Name: string = 'execute_external_tool';

  constructor(
    private readonly config: Config,
    messageBus: MessageBus
  ) {
    super(
      ExecuteExternalToolTool.Name,
      'Execute External Tool',
      'Executes an external tool with the provided arguments. Use this to run tools discovered via list_external_tools.',
      Kind.Execute,
      {
        type: Type.OBJECT,
        properties: {
          tool_name: {
            type: Type.STRING,
            description: 'The exact name of the tool to execute.',
          },
          arguments: {
            type: Type.OBJECT,
            description: 'The arguments object required by the tool schema.',
          },
        },
        required: ['tool_name', 'arguments'],
      },
      messageBus,
      true, // isOutputMarkdown
      false // canUpdateOutput
    );
  }

  protected createInvocation(
    params: ExecuteExternalToolParams,
    messageBus: MessageBus
  ): ToolInvocation<ExecuteExternalToolParams, ToolResult> {
    return new ExecuteExternalToolInvocation(this.config, params, messageBus);
  }
}

class ExecuteExternalToolInvocation extends BaseToolInvocation<ExecuteExternalToolParams, ToolResult> {
  constructor(
    private readonly config: Config,
    params: ExecuteExternalToolParams,
    messageBus: MessageBus
  ) {
    super(params, messageBus);
  }

  getDescription(): string {
    return `Executing external tool "${this.params.tool_name}"`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const uiTool = extendedToolsService.getTool(this.params.tool_name);
      if (uiTool) {
        if (!uiTool.isEnabled) {
          throw new Error(`Tool ${this.params.tool_name} is turned off in the UI.`);
        }
        const uiResult = await extendedToolsService.executeTool(this.params.tool_name, this.params.arguments);
        if (!uiResult.success) {
          throw new Error(uiResult.error || 'Execution failed');
        }
        return {
          llmContent: uiResult.output || 'Success',
          returnDisplay: `Executed ${this.params.tool_name}`,
        };
      }

      const requestInfo = {
        callId: `${this.params.tool_name}-${uuid()}`,
        name: this.params.tool_name,
        args: this.params.arguments,
        isClientInitiated: false,
        prompt_id: `${this.config.getSessionId()}########${Date.now()}`,
      };

      const toolResponse = await executeToolCall(this.config, requestInfo, signal);

      const resultDisplay = toolResponse.response?.resultDisplay;
      const displayString = typeof resultDisplay === 'string'
        ? resultDisplay
        : resultDisplay && typeof resultDisplay === 'object' && 'fileDiff' in resultDisplay
          ? resultDisplay.fileDiff
          : JSON.stringify(resultDisplay);

      if (toolResponse?.response?.error) {
        throw new Error(displayString || toolResponse.response.error.message);
      }

      let llmContent = '';
      if (toolResponse.response?.responseParts) {
        const parts = Array.isArray(toolResponse.response.responseParts)
          ? toolResponse.response.responseParts
          : [toolResponse.response.responseParts];
        
        for (const part of parts) {
          if (typeof part === 'string') {
            llmContent += part;
          } else if (part && typeof part === 'object') {
            if ('text' in part) {
              llmContent += (part as any).text;
            } else {
              llmContent += JSON.stringify(part);
            }
          }
        }
      }

      if (!llmContent && displayString) {
        llmContent = displayString;
      }

      return {
        llmContent: llmContent || 'Tool executed successfully but returned no content.',
        returnDisplay: displayString || `Executed ${this.params.tool_name}.`,
      };
    } catch (e) {
      const errorMessage = getErrorMessage(e);
      return {
        llmContent: `Error executing external tool ${this.params.tool_name}: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}
