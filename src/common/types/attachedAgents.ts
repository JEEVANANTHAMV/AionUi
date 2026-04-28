/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Attached Agents Types - For managing sub-agents that can be called by main agents
 */

/**
 * Available attached agent types
 */
export enum AttachedAgentType {
  OPENCODE = 'opencode',
  WINDOWS_MCP = 'windows_mcp',
  BROWSER_CONTROL = 'browser_control',
}

/**
 * Attached agent status
 */
export enum AttachedAgentStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  RUNNING = 'running',
  BUSY = 'busy',
  ERROR = 'error',
  STOPPED = 'stopped',
}

/**
 * Configuration for an attached agent
 */
export interface AttachedAgentConfig {
  id: string;
  name: string;
  type: AttachedAgentType;
  description: string;
  enabled: boolean;
  endpoint?: string;
  port?: number;
  autoStart: boolean;
  env?: Record<string, string>;
  options?: Record<string, unknown>;
}

/**
 * Runtime state of an attached agent
 */
export interface AttachedAgentState {
  id: string;
  type: AttachedAgentType;
  status: AttachedAgentStatus;
  lastTask?: string;
  lastResult?: string;
  error?: string;
  startedAt?: number;
  lastActiveAt?: number;
  taskCount: number;
}

/**
 * Task request for an attached agent
 */
export interface AttachedAgentTaskRequest {
  agentId: string;
  taskId: string;
  instruction: string;
  context?: Record<string, unknown>;
  timeout?: number;
}

/**
 * Task response from an attached agent
 */
export interface AttachedAgentTaskResponse {
  taskId: string;
  agentId: string;
  success: boolean;
  result?: string;
  error?: string;
  completedAt: number;
}

/**
 * OpenCode agent specific configuration
 */
export interface OpenCodeAgentConfig extends AttachedAgentConfig {
  type: AttachedAgentType.OPENCODE;
  projectDir?: string;
  configPath?: string;
  serverUrl?: string;
}

/**
 * Windows MCP agent specific configuration
 */
export interface WindowsMcpAgentConfig extends AttachedAgentConfig {
  type: AttachedAgentType.WINDOWS_MCP;
  bundlePath?: string;
  mcpPort?: number;
}

/**
 * Browser Control agent specific configuration
 */
export interface BrowserControlAgentConfig extends AttachedAgentConfig {
  type: AttachedAgentType.BROWSER_CONTROL;
  browserPort?: number;
  headless?: boolean;
  mcpEndpoint?: string;
}

/**
 * Agent capabilities - what tools/functions each agent type provides
 */
export interface AttachedAgentCapabilities {
  type: AttachedAgentType;
  tools: AttachedAgentToolDefinition[];
}

/**
 * Tool definition for attached agents
 */
export interface AttachedAgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  agentType: AttachedAgentType;
}

/**
 * Default attached agent configurations
 */
export const DEFAULT_ATTACHED_AGENTS: AttachedAgentConfig[] = [
  {
    id: 'opencode-agent',
    name: 'OpenCode Agent',
    type: AttachedAgentType.OPENCODE,
    description: 'Coding sub-agent for code analysis, patching, and repo work',
    enabled: true,
    autoStart: false,
    endpoint: 'http://localhost:8080',
    options: {
      defaultPort: 8080,
    },
  },
  {
    id: 'windows-mcp-agent',
    name: 'Windows-MCP Agent',
    type: AttachedAgentType.WINDOWS_MCP,
    description: 'Windows GUI automation via MCP protocol',
    enabled: true,
    autoStart: false,
    port: 3001,
    options: {
      bundlePath: './bundled/windows-mcp',
    },
  },
  {
    id: 'browser-control-agent',
    name: 'Browser-Control Agent',
    type: AttachedAgentType.BROWSER_CONTROL,
    description: 'Browser automation via MCP protocol',
    enabled: true,
    autoStart: false,
    port: 8222,
    endpoint: 'http://localhost:8222/mcp',
    options: {
      headless: false,
      timeout: 30000,
    },
  },
];

/**
 * Attached agent type metadata
 */
export const ATTACHED_AGENT_METADATA: Record<
  AttachedAgentType,
  { icon: string; labelKey: string; descriptionKey: string }
> = {
  [AttachedAgentType.OPENCODE]: {
    icon: 'Code',
    labelKey: 'attachedAgent.opencode.label',
    descriptionKey: 'attachedAgent.opencode.description',
  },
  [AttachedAgentType.WINDOWS_MCP]: {
    icon: 'Windows',
    labelKey: 'attachedAgent.windowsMcp.label',
    descriptionKey: 'attachedAgent.windowsMcp.description',
  },
  [AttachedAgentType.BROWSER_CONTROL]: {
    icon: 'Browser',
    labelKey: 'attachedAgent.browserControl.label',
    descriptionKey: 'attachedAgent.browserControl.description',
  },
};
