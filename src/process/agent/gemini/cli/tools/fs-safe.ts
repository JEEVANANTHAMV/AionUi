/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { 
  BaseDeclarativeTool, 
  BaseToolInvocation, 
  Kind, 
  ToolErrorType,
  type ToolResult,
  type MessageBus
} from '@office-ai/aioncli-core';
import * as fs from 'node:fs/promises';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

interface ReadFileParams {
  file_path: string;
}

class SafeReadFileToolInvocation extends BaseToolInvocation<ReadFileParams, ToolResult> {
  private config: any;
  private resolvedPath: string;

  constructor(config: any, params: ReadFileParams, messageBus: MessageBus, toolName: string, toolDisplayName: string) {
    super(params, messageBus, toolName, toolDisplayName);
    this.config = config;
    this.resolvedPath = path.resolve(this.config.getTargetDir(), this.params.file_path);
  }

  getDescription() {
    return path.relative(this.config.getTargetDir(), this.resolvedPath);
  }

  async execute() {
    // 1. Check if it's an image
    if (isImageFile(this.resolvedPath)) {
      return {
        llmContent: `[File is an image: ${path.basename(this.resolvedPath)}]. \nIMPORTANT: Do not attempt to read image files as text. Use your vision capabilities to analyze the image directly from the multimodal input. If you cannot see the image, it may not have been uploaded correctly.`,
        returnDisplay: `Skipped reading binary image file: ${path.basename(this.resolvedPath)}`,
      };
    }

    // 2. Validate path access (re-implementing core logic)
    const validationError = this.config.validatePathAccess(this.resolvedPath, 'read');
    if (validationError) {
      return {
        llmContent: validationError,
        returnDisplay: 'Path not in workspace.',
        error: {
          message: validationError,
          type: ToolErrorType.PATH_NOT_IN_WORKSPACE,
        },
      };
    }

    // 3. Simple read with safety check
    try {
      const stats = await fs.stat(this.resolvedPath);
      if (stats.size > 1024 * 1024) { // 1MB limit for tool reading
         return {
           llmContent: `[File too large to read as text: ${stats.size} bytes]. Please use specialized tools or read specific ranges.`,
           returnDisplay: `Large file skipped: ${path.basename(this.resolvedPath)}`,
         };
      }
      
      const content = await fs.readFile(this.resolvedPath, 'utf-8');
      return {
        llmContent: content,
        returnDisplay: `Read ${path.basename(this.resolvedPath)}`,
      };
    } catch (e: any) {
      return {
        llmContent: `Error reading file: ${e.message}`,
        returnDisplay: `Error: ${e.message}`,
        error: {
          message: e.message,
          type: ToolErrorType.UNKNOWN,
        },
      };
    }
  }
}

export class SafeReadFileTool extends BaseDeclarativeTool<ReadFileParams, ToolResult> {
  constructor(private config: any, messageBus: MessageBus) {
    super(
      'read_file',
      'Read File',
      'Reads the content of a file from the workspace. DO NOT use this for images.',
      Kind.Read,
      {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Relative path to the file' },
        },
        required: ['file_path'],
      } as any,
      messageBus,
      true,
      false
    );
  }

  protected createInvocation(params: ReadFileParams, messageBus: MessageBus, toolName?: string, toolDisplayName?: string) {
    return new SafeReadFileToolInvocation(this.config, params, messageBus, toolName || this.name, toolDisplayName || this.displayName);
  }
}

interface ReadManyFilesParams {
  file_paths: string[];
}

class SafeReadManyFilesToolInvocation extends BaseToolInvocation<ReadManyFilesParams, ToolResult> {
  private config: any;

  constructor(config: any, params: ReadManyFilesParams, messageBus: MessageBus, toolName: string, toolDisplayName: string) {
    super(params, messageBus, toolName, toolDisplayName);
    this.config = config;
  }

  getDescription(): string {
    return `Reading ${this.params.file_paths?.length || 0} files`;
  }

  async execute() {
    const results = [];
    const filePaths = this.params.file_paths || [];

    for (const filePath of filePaths) {
      const resolvedPath = path.resolve(this.config.getTargetDir(), filePath);
      
      if (isImageFile(resolvedPath)) {
        results.push(`--- [${filePath}] ---\n[Skipped: Binary Image File]`);
        continue;
      }

      const validationError = this.config.validatePathAccess(resolvedPath, 'read');
      if (validationError) {
        results.push(`--- [${filePath}] ---\n[Error: Access Denied]`);
        continue;
      }

      try {
        const stats = await fs.stat(resolvedPath);
        if (stats.size > 512 * 1024) {
          results.push(`--- [${filePath}] ---\n[Error: File too large]`);
          continue;
        }
        const content = await fs.readFile(resolvedPath, 'utf-8');
        results.push(`--- [${filePath}] ---\n${content}`);
      } catch (e: any) {
        results.push(`--- [${filePath}] ---\n[Error: ${e.message}]`);
      }
    }

    return {
      llmContent: results.join('\n\n'),
      returnDisplay: `Read ${filePaths.length} files`,
    };
  }
}

export class SafeReadManyFilesTool extends BaseDeclarativeTool<ReadManyFilesParams, ToolResult> {
  constructor(private config: any, messageBus: MessageBus) {
    super(
      'read_many_files',
      'Read Many Files',
      'Reads multiple files at once. DO NOT use this for images.',
      Kind.Read,
      {
        type: 'object',
        properties: {
          file_paths: { type: 'array', items: { type: 'string' } },
        },
        required: ['file_paths'],
      } as any,
      messageBus,
      true,
      false
    );
  }

  protected createInvocation(params: ReadManyFilesParams, messageBus: MessageBus, toolName?: string, toolDisplayName?: string) {
    return new SafeReadManyFilesToolInvocation(this.config, params, messageBus, toolName || this.name, toolDisplayName || this.displayName);
  }
}
