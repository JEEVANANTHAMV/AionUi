/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolErrorType,
  type ToolResult,
  type MessageBus,
} from '@office-ai/aioncli-core';
import { extendedToolsService } from '@/process/services/extendedToolsService';

interface OfficeCliParams {
  command: string;
  file?: string;
  path?: string;
  args?: string[];
  flags?: Record<string, any>;
  input?: string;
  output?: string;
}

class OfficeCliToolInvocation extends BaseToolInvocation<OfficeCliParams, ToolResult> {
  constructor(
    params: OfficeCliParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription() {
    return `Executing officecli ${this.params.command}`;
  }

  async execute() {
    try {
      const result = await (extendedToolsService as any).executeOfficeCli(this.params as any);
      
      // If result is small, include it in display; otherwise show success message
      const displayResult = (result && result.length < 100) 
        ? `: ${result.trim().split('\n')[0]}` 
        : ' complete';

      return {
        llmContent: result,
        returnDisplay: `officecli ${this.params.command}${displayResult}`,
      };
    } catch (e: any) {
      return {
        llmContent: `Error executing officecli: ${e.message}`,
        returnDisplay: 'officecli failed',
        error: {
          message: e.message,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class OfficeCliTool extends BaseDeclarativeTool<OfficeCliParams, ToolResult> {
  constructor(messageBus: MessageBus) {
    super(
      'officecli',
      'Office CLI',
      'Create, edit, and manage PowerPoint, Word, and Excel files. Use this to automate document creation, slide generation, and content extraction. Supports .pptx, .docx, and .xlsx formats.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The officecli command to run. Can be just the subcommand (e.g., "view", "add", "set") or a full command string including arguments (e.g., "view slides.pptx text"). If only the subcommand is provided, you MUST provide other parameters like "file", "path", "args", etc. USE "officecli --help" to explore available commands.',
          },
          file: {
            type: 'string',
            description: 'The target office file path (.pptx, .docx, .xlsx). This is required for most commands.',
          },
          path: {
            type: 'string',
            description: 'The element path within the document (e.g., "/slide[1]", "/body/p[1]").',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Positional arguments for the subcommand (e.g., ["text"] for "view").',
          },
          flags: {
            type: 'object',
            description: 'Command line flags (e.g., { "depth": 1, "json": true }).',
          },
          input: {
            type: 'string',
            description: 'Input text or file content for "add" or "set" operations.',
          },
          output: {
            type: 'string',
            description: 'Output file path. USE WITH CAUTION: This will overwrite existing files.',
          },
        },
        required: ['command', 'file'],
      } as any,
      messageBus,
      false, // requiresConfirmation = false (Trusted/ACP Tool)
      false
    );
  }

  protected createInvocation(
    params: OfficeCliParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string
  ) {
    return new OfficeCliToolInvocation(
      params,
      messageBus,
      toolName || this.name,
      toolDisplayName || this.displayName
    );
  }
}
