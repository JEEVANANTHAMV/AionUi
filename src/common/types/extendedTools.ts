/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extended Tools Types - For managing default and custom tools
 */

import type { ToolDefinition } from './codex/types/toolTypes';

/**
 * Tool source type
 */
export enum ToolSource {
  BUILTIN = 'builtin',
  CUSTOM_JS = 'custom_js',
  CUSTOM_PYTHON = 'custom_python',
  MCP = 'mcp',
  ATTACHED_AGENT = 'attached_agent',
}

/**
 * Tool category for organization
 */
export enum ExtendedToolCategory {
  FILE_OPERATIONS = 'file_operations',
  CODE_OPERATIONS = 'code_operations',
  TERMINAL = 'terminal',
  BROWSER = 'browser',
  GIT = 'git',
  WEB = 'web',
  ANALYSIS = 'analysis',
  AGENT_MANAGEMENT = 'agent_management',
  CUSTOM = 'custom',
  MCP = 'mcp',
}

/**
 * Extended tool definition with additional metadata
 */
export interface ExtendedToolDefinition {
  id: string;
  name: string;
  displayNameKey: string;
  category: ExtendedToolCategory;
  priority: number;
  availability: import('./codex/types/toolTypes').ToolAvailability;
  capabilities: import('./codex/types/toolTypes').ToolCapabilities;
  renderer: import('./codex/types/toolTypes').ToolRenderer;
  source: ToolSource;
  icon?: string;
  descriptionKey: string;
  schema?: Record<string, unknown>;
  customCode?: string;
  language?: 'javascript' | 'typescript' | 'python';
  filePath?: string;
  isEditable: boolean;
  isEnabled: boolean;
  isSystem: boolean;
  requiresConfirmation: boolean;
  parentAgentId?: string;
}

/**
 * Default built-in tools available in the system
 */
export interface BuiltinToolConfig {
  id: string;
  name: string;
  category: ExtendedToolCategory;
  description: string;
  enabled: boolean;
  icon?: string;
}

/**
 * Custom tool configuration
 */
export interface CustomToolConfig {
  id: string;
  name: string;
  description: string;
  language: 'javascript' | 'typescript' | 'python';
  code: string;
  schema: Record<string, unknown>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  toolId: string;
  timestamp: number;
}

/**
 * Tool registry state
 */
export interface ToolRegistryState {
  builtinTools: BuiltinToolConfig[];
  customTools: CustomToolConfig[];
  mcpTools: ExtendedToolDefinition[];
  agentTools: ExtendedToolDefinition[];
}

/**
 * Default built-in tools configuration
 */
export const DEFAULT_BUILTIN_TOOLS: BuiltinToolConfig[] = [
  // File Operations
  {
    id: 'process_file',
    name: 'Process File',
    category: ExtendedToolCategory.FILE_OPERATIONS,
    description: 'Convert files to markdown with OCR support',
    enabled: true,
    icon: 'FileConversion',
  },

  // Web Operations
  {
    id: 'http_get',
    name: 'HTTP GET',
    category: ExtendedToolCategory.WEB,
    description: 'Perform HTTP GET request',
    enabled: true,
    icon: 'Link',
  },
  {
    id: 'http_post',
    name: 'HTTP POST',
    category: ExtendedToolCategory.WEB,
    description: 'Perform HTTP POST request',
    enabled: true,
    icon: 'Link',
  },

  // Browser Operations
  {
    id: 'browser_navigate',
    name: 'Browser Navigate',
    category: ExtendedToolCategory.BROWSER,
    description: 'Navigate browser to URL',
    enabled: true,
    icon: 'Browser',
  },
  {
    id: 'browser_click',
    name: 'Browser Click',
    category: ExtendedToolCategory.BROWSER,
    description: 'Click element in browser',
    enabled: true,
    icon: 'Browser',
  },
  {
    id: 'browser_type',
    name: 'Browser Type',
    category: ExtendedToolCategory.BROWSER,
    description: 'Type text into form field',
    enabled: true,
    icon: 'Browser',
  },
  {
    id: 'browser_extract',
    name: 'Browser Extract',
    category: ExtendedToolCategory.BROWSER,
    description: 'Extract text from element',
    enabled: true,
    icon: 'Browser',
  },
  {
    id: 'browser_screenshot',
    name: 'Browser Screenshot',
    category: ExtendedToolCategory.BROWSER,
    description: 'Take browser screenshot',
    enabled: true,
    icon: 'Browser',
  },
  {
    id: 'browser_execute_js',
    name: 'Browser Execute JS',
    category: ExtendedToolCategory.BROWSER,
    description: 'Execute JavaScript in browser',
    enabled: true,
    icon: 'Browser',
  },

  // Analysis Operations
  {
    id: 'parse_document',
    name: 'Parse Document',
    category: ExtendedToolCategory.ANALYSIS,
    description: 'Parse documents to text',
    enabled: true,
    icon: 'Analysis',
  },
  {
    id: 'ocr_document',
    name: 'OCR Document',
    category: ExtendedToolCategory.ANALYSIS,
    description: 'Extract text via OCR',
    enabled: true,
    icon: 'Analysis',
  },
  {
    id: 'vision_analyze',
    name: 'Vision Analyze',
    category: ExtendedToolCategory.ANALYSIS,
    description: 'Analyze images and diagrams',
    enabled: true,
    icon: 'Analysis',
  },
  {
    id: 'summarize_text',
    name: 'Summarize Text',
    category: ExtendedToolCategory.ANALYSIS,
    description: 'Summarize long text with context window',
    enabled: true,
    icon: 'Analysis',
  },

  // Agent Management
  {
    id: 'agent_spawn',
    name: 'Agent Spawn',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Spawn a sub-agent',
    enabled: true,
    icon: 'User',
  },
  {
    id: 'agent_status',
    name: 'Agent Status',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Get agent status',
    enabled: true,
    icon: 'User',
  },
  {
    id: 'agent_delegate',
    name: 'Agent Delegate',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Delegate task to agent',
    enabled: true,
    icon: 'User',
  },
  {
    id: 'team_delete',
    name: 'Team Delete',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Delete agent team',
    enabled: true,
    icon: 'Team',
  },

  // Task Management
  {
    id: 'task_create',
    name: 'Task Create',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Create a new task',
    enabled: true,
    icon: 'CheckList',
  },
  {
    id: 'task_get',
    name: 'Task Get',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Get task details',
    enabled: true,
    icon: 'CheckList',
  },
  {
    id: 'task_list',
    name: 'Task List',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'List all tasks',
    enabled: true,
    icon: 'CheckList',
  },
  {
    id: 'task_update',
    name: 'Task Update',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Update task properties',
    enabled: true,
    icon: 'CheckList',
  },
  {
    id: 'task_output',
    name: 'Task Output',
    category: ExtendedToolCategory.AGENT_MANAGEMENT,
    description: 'Record task output',
    enabled: true,
    icon: 'CheckList',
  },
];

/**
 * Tool category display metadata
 */
export const TOOL_CATEGORY_METADATA: Record<ExtendedToolCategory, { labelKey: string; icon: string; color: string }> = {
  [ExtendedToolCategory.FILE_OPERATIONS]: {
    labelKey: 'tools.category.fileOperations',
    icon: 'FolderOpen',
    color: 'blue',
  },
  [ExtendedToolCategory.CODE_OPERATIONS]: { labelKey: 'tools.category.codeOperations', icon: 'Code', color: 'green' },
  [ExtendedToolCategory.TERMINAL]: { labelKey: 'tools.category.terminal', icon: 'Terminal', color: 'purple' },
  [ExtendedToolCategory.BROWSER]: { labelKey: 'tools.category.browser', icon: 'Browser', color: 'orange' },
  [ExtendedToolCategory.GIT]: { labelKey: 'tools.category.git', icon: 'Git', color: 'red' },
  [ExtendedToolCategory.WEB]: { labelKey: 'tools.category.web', icon: 'Link', color: 'cyan' },
  [ExtendedToolCategory.ANALYSIS]: { labelKey: 'tools.category.analysis', icon: 'Analysis', color: 'pink' },
  [ExtendedToolCategory.AGENT_MANAGEMENT]: {
    labelKey: 'tools.category.agentManagement',
    icon: 'User',
    color: 'indigo',
  },
  [ExtendedToolCategory.CUSTOM]: { labelKey: 'tools.category.custom', icon: 'Tool', color: 'yellow' },
  [ExtendedToolCategory.MCP]: { labelKey: 'tools.category.mcp', icon: 'Extension', color: 'teal' },
};
