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
  type ToolCallConfirmationDetails,
} from '@office-ai/aioncli-core';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface RemoteRunCommandParams {
  command: string;
}

class RemoteRunCommandToolInvocation extends BaseToolInvocation<RemoteRunCommandParams, ToolResult> {
  constructor(params: RemoteRunCommandParams, messageBus: MessageBus, toolName: string, toolDisplayName: string) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription() {
    return `Remote: ${this.params.command}`;
  }

  async shouldConfirmExecute(_abortSignal: AbortSignal): Promise<ToolCallConfirmationDetails | false> {
    return {
      type: 'exec',
      title: 'Remote Execution',
      onConfirm: async () => {}, // Handled by GeminiAgentManager
      command: this.params.command,
      rootCommand: this.params.command.split(' ')[0],
      rootCommands: [this.params.command.split(' ')[0]],
    };
  }

  async execute(signal: AbortSignal) {
    const sshIp = process.env.SSH_IP;
    const sshUser = process.env.SSH_USER;
    const sshPass = process.env.SSH_PASSWORD;

    if (!sshIp || !sshUser || !sshPass) {
      return {
        llmContent: 'Error: SSH credentials not configured in environment (SSH_IP, SSH_USER, SSH_PASSWORD)',
        returnDisplay: 'SSH Config Missing',
        error: {
          message: 'SSH credentials missing',
          type: ToolErrorType.UNKNOWN,
        },
      };
    }

    try {
      // Use sshpass for non-interactive password auth
      // StrictHostKeyChecking=no to avoid prompt on first connect
      const sshCommand = `sshpass -p '${sshPass}' ssh -o StrictHostKeyChecking=no ${sshUser}@${sshIp} "${this.params.command.replace(/"/g, '\\"')}"`;

      const { stdout, stderr } = await execAsync(sshCommand, { timeout: 60000 });

      if (stderr && !stdout) {
        return {
          llmContent: stderr,
          returnDisplay: 'Command Output (with stderr)',
        };
      }

      return {
        llmContent: stdout || 'Command executed with no output.',
        returnDisplay: 'Remote execution successful',
      };
    } catch (e: any) {
      const errorMsg = `Remote command failed: ${e.message}\n${e.stdout || ''}\n${e.stderr || ''}`;
      return {
        llmContent: errorMsg,
        returnDisplay: 'Execution failed',
        error: {
          message: errorMsg,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class RemoteRunCommandTool extends BaseDeclarativeTool<RemoteRunCommandParams, ToolResult> {
  constructor(messageBus: MessageBus) {
    super(
      'remote_run_command',
      'Remote Run Command',
      'Executes a shell command on the remote Ubuntu server (101.53.140.246) via SSH. Use this for heavy computation, python execution, or tasks requiring internet access from a linux environment.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute remotely' },
        },
        required: ['command'],
      } as any,
      messageBus,
      true,
      false
    );
  }

  protected createInvocation(
    params: RemoteRunCommandParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string
  ) {
    return new RemoteRunCommandToolInvocation(
      params,
      messageBus,
      toolName || this.name,
      toolDisplayName || this.displayName
    );
  }
}
