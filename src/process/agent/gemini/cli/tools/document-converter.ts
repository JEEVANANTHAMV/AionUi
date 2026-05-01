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
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { documentConverter } from '@/common/chat/document/DocumentConverter';
import TurndownService from 'turndown';

interface DocumentConverterParams {
  input_content: string;
  output_path: string;
  format: 'docx' | 'pptx';
}

class DocumentConverterToolInvocation extends BaseToolInvocation<DocumentConverterParams, ToolResult> {
  private config: any;

  constructor(
    config: any,
    params: DocumentConverterParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string
  ) {
    super(params, messageBus, toolName, toolDisplayName);
    this.config = config;
  }

  getDescription() {
    return `Converting to ${this.params.format.toUpperCase()}: ${this.params.output_path}`;
  }

  async execute() {
    const resolvedOutputPath = path.resolve(this.config.getTargetDir(), this.params.output_path);

    // Validate path
    const validationError = this.config.validatePathAccess(resolvedOutputPath, 'write');
    if (validationError) {
      return {
        llmContent: `Error: Access denied to ${this.params.output_path}`,
        returnDisplay: 'Access denied',
      };
    }

    try {
      let markdown = this.params.input_content;

      // If input looks like HTML, convert to markdown first as DocumentConverter prefers markdown
      if (markdown.trim().startsWith('<')) {
        const turndown = new TurndownService();
        markdown = turndown.turndown(markdown);
      }

      if (this.params.format === 'docx') {
        const arrayBuffer = await documentConverter.markdownToWord(markdown);
        await fs.writeFile(resolvedOutputPath, Buffer.from(arrayBuffer));
      } else {
        // PPTX conversion logic
        return {
          llmContent:
            "Error: PPTX conversion via this tool is not yet fully implemented. Please use the 'officecli-pptx' skill for complex PowerPoint generation.",
          returnDisplay: 'PPTX not supported yet',
        };
      }

      return {
        llmContent: `Successfully converted content to ${this.params.format.toUpperCase()} and saved to ${this.params.output_path}`,
        returnDisplay: `Converted to ${this.params.format.toUpperCase()}`,
      };
    } catch (e: any) {
      const errorMsg = `Conversion failed: ${e.message}`;
      return {
        llmContent: errorMsg,
        returnDisplay: 'Conversion failed',
        error: {
          message: errorMsg,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class DocumentConverterTool extends BaseDeclarativeTool<DocumentConverterParams, ToolResult> {
  constructor(
    private config: any,
    messageBus: MessageBus
  ) {
    super(
      'convert_document',
      'Document Converter',
      'Converts HTML or Markdown content to professional document formats like Word (.docx). Use this to finalize reports, letters, or documents you have generated.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          input_content: { type: 'string', description: 'The HTML or Markdown content to convert' },
          output_path: {
            type: 'string',
            description: 'The relative path where the converted file should be saved (e.g., "report.docx")',
          },
          format: { type: 'string', enum: ['docx', 'pptx'], description: 'The target format' },
        },
        required: ['input_content', 'output_path', 'format'],
      } as any,
      messageBus,
      true,
      false
    );
  }

  protected createInvocation(
    params: DocumentConverterParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string
  ) {
    return new DocumentConverterToolInvocation(
      this.config,
      params,
      messageBus,
      toolName || this.name,
      toolDisplayName || this.displayName
    );
  }
}
