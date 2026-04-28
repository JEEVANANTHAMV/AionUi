/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extended Tools Service - Manages default and custom tools
 */

import { EventEmitter } from 'events';
import type {
  ExtendedToolDefinition,
  ExtendedToolCategory,
  CustomToolConfig,
  BuiltinToolConfig,
  ToolExecutionResult,
  ToolRegistryState,
} from '@/common/types/extendedTools';
import { DEFAULT_BUILTIN_TOOLS, ExtendedToolCategory as ToolCategory, ToolSource } from '@/common/types/extendedTools';
import type { IMcpServer } from '@/common/config/storage';
import { ConfigStorage } from '@/common/config/storage';
import { RendererType } from '@/common/types/codex/types/toolTypes';

export interface ExtendedToolsServiceEvents {
  'tool-registered': { toolId: string; category: ExtendedToolCategory };
  'tool-unregistered': { toolId: string };
  'tool-executed': { toolId: string; result: ToolExecutionResult };
  'tool-error': { toolId: string; error: string };
}

declare interface ExtendedToolsService {
  on<U extends keyof ExtendedToolsServiceEvents>(
    event: U,
    listener: (data: ExtendedToolsServiceEvents[U]) => void
  ): this;
  emit<U extends keyof ExtendedToolsServiceEvents>(event: U, data: ExtendedToolsServiceEvents[U]): boolean;
}

class ExtendedToolsService extends EventEmitter {
  private builtinTools: Map<string, BuiltinToolConfig> = new Map();
  private customTools: Map<string, CustomToolConfig> = new Map();
  private mcpTools: Map<string, ExtendedToolDefinition> = new Map();
  private agentTools: Map<string, ExtendedToolDefinition> = new Map();
  private executionHistory: ToolExecutionResult[] = [];
  private maxHistorySize = 100;

  constructor() {
    super();
    this.loadBuiltinTools();
    this.loadCustomTools();
  }

  /**
   * Load built-in tools
   */
  private loadBuiltinTools(): void {
    for (const tool of DEFAULT_BUILTIN_TOOLS) {
      this.builtinTools.set(tool.id, { ...tool });
    }
  }

  /**
   * Load custom tools from storage
   */
  private async loadCustomTools(): Promise<void> {
    try {
      const stored = await ConfigStorage.get('tools.custom');
      if (stored && Array.isArray(stored)) {
        for (const tool of stored as CustomToolConfig[]) {
          this.customTools.set(tool.id, tool);
        }
      }
    } catch (error) {
      console.error('Failed to load custom tools:', error);
    }
  }

  /**
   * Save custom tools to storage
   */
  private async saveCustomTools(): Promise<void> {
    const tools = Array.from(this.customTools.values());
    try {
      await ConfigStorage.set('tools.custom', tools);
    } catch (error) {
      console.error('Failed to save custom tools:', error);
    }
  }

  /**
   * Get all tools
   */
  getAllTools(): ExtendedToolDefinition[] {
    const tools: ExtendedToolDefinition[] = [];

    // Built-in tools
    for (const tool of this.builtinTools.values()) {
      tools.push(this.convertBuiltinToExtended(tool));
    }

    // Custom tools
    for (const tool of this.customTools.values()) {
      tools.push(this.convertCustomToExtended(tool));
    }

    // MCP tools
    for (const tool of this.mcpTools.values()) {
      tools.push(tool);
    }

    // Agent tools
    for (const tool of this.agentTools.values()) {
      tools.push(tool);
    }

    return tools;
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ExtendedToolCategory): ExtendedToolDefinition[] {
    return this.getAllTools().filter((tool) => tool.category === category);
  }

  /**
   * Get tools by source
   */
  getToolsBySource(source: ToolSource): ExtendedToolDefinition[] {
    return this.getAllTools().filter((tool) => tool.source === source);
  }

  /**
   * Get enabled tools
   */
  getEnabledTools(): ExtendedToolDefinition[] {
    return this.getAllTools().filter((tool) => tool.isEnabled);
  }

  /**
   * Get tool by ID
   */
  getTool(toolId: string): ExtendedToolDefinition | undefined {
    // Check built-in
    const builtin = this.builtinTools.get(toolId);
    if (builtin) return this.convertBuiltinToExtended(builtin);

    // Check custom
    const custom = this.customTools.get(toolId);
    if (custom) return this.convertCustomToExtended(custom);

    // Check MCP
    const mcp = this.mcpTools.get(toolId);
    if (mcp) return mcp;

    // Check agent tools
    return this.agentTools.get(toolId);
  }

  /**
   * Register MCP tools from MCP servers
   */
  registerMcpTools(
    server: IMcpServer,
    tools: { name: string; description: string; inputSchema?: Record<string, unknown> }[]
  ): void {
    for (const tool of tools) {
      const toolId = `mcp-${server.id}-${tool.name}`;
      const extendedTool: ExtendedToolDefinition = {
        id: toolId,
        name: tool.name,
        displayNameKey: `tools.mcp.${tool.name}`,
        category: ToolCategory.MCP,
        priority: 100,
        availability: { platforms: ['darwin', 'linux', 'win32'] },
        capabilities: {
          supportsStreaming: false,
          supportsImages: false,
          supportsCharts: false,
          supportsMarkdown: true,
          supportsInteraction: false,
          outputFormats: [],
        },
        renderer: { type: RendererType.STANDARD, config: {} },
        source: ToolSource.MCP,
        customCode: undefined,
        language: undefined,
        filePath: undefined,
        isEditable: false,
        isEnabled: server.enabled ?? true,
        isSystem: false,
        requiresConfirmation: false,
        schema: tool.inputSchema || {},
        icon: 'Extension',
        descriptionKey: tool.description,
      };

      this.mcpTools.set(toolId, extendedTool);
      this.emit('tool-registered', { toolId, category: ToolCategory.MCP });
    }
  }

  /**
   * Register agent tools
   */
  registerAgentTools(agentId: string, tools: { name: string; description: string }[]): void {
    for (const tool of tools) {
      const toolId = `agent-${agentId}-${tool.name}`;
      const extendedTool: ExtendedToolDefinition = {
        id: toolId,
        name: tool.name,
        displayNameKey: `tools.agent.${tool.name}`,
        category: ToolCategory.AGENT_MANAGEMENT,
        priority: 200,
        availability: { platforms: ['darwin', 'linux', 'win32'] },
        capabilities: {
          supportsStreaming: false,
          supportsImages: false,
          supportsCharts: false,
          supportsMarkdown: true,
          supportsInteraction: false,
          outputFormats: [],
        },
        renderer: { type: RendererType.STANDARD, config: {} },
        source: ToolSource.ATTACHED_AGENT,
        parentAgentId: agentId,
        isEditable: false,
        isEnabled: true,
        isSystem: true,
        requiresConfirmation: true,
        icon: 'User',
        descriptionKey: tool.description,
        schema: {},
      };

      this.agentTools.set(toolId, extendedTool);
      this.emit('tool-registered', { toolId, category: ToolCategory.AGENT_MANAGEMENT });
    }
  }

  /**
   * Create custom tool
   */
  async createCustomTool(config: Omit<CustomToolConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomToolConfig> {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const tool: CustomToolConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.customTools.set(id, tool);
    await this.saveCustomTools();

    this.emit('tool-registered', { toolId: id, category: ToolCategory.CUSTOM });

    return tool;
  }

  /**
   * Update custom tool
   */
  async updateCustomTool(id: string, updates: Partial<CustomToolConfig>): Promise<CustomToolConfig | undefined> {
    const tool = this.customTools.get(id);
    if (!tool) return undefined;

    const updated = {
      ...tool,
      ...updates,
      updatedAt: Date.now(),
    };

    this.customTools.set(id, updated);
    await this.saveCustomTools();

    return updated;
  }

  /**
   * Delete custom tool
   */
  async deleteCustomTool(id: string): Promise<boolean> {
    const deleted = this.customTools.delete(id);
    if (deleted) {
      await this.saveCustomTools();
      this.emit('tool-unregistered', { toolId: id });
    }
    return deleted;
  }

  /**
   * Enable/disable tool
   */
  async toggleTool(toolId: string, enabled: boolean): Promise<boolean> {
    // Check built-in
    const builtin = this.builtinTools.get(toolId);
    if (builtin) {
      builtin.enabled = enabled;
      this.builtinTools.set(toolId, builtin);
      return true;
    }

    // Check custom
    const custom = this.customTools.get(toolId);
    if (custom) {
      custom.enabled = enabled;
      this.customTools.set(toolId, custom);
      await this.saveCustomTools();
      return true;
    }

    // Check MCP
    const mcp = this.mcpTools.get(toolId);
    if (mcp) {
      mcp.isEnabled = enabled;
      this.mcpTools.set(toolId, mcp);
      return true;
    }

    return false;
  }

  /**
   * Execute a tool
   */
  async executeTool(toolId: string, params: Record<string, unknown>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.getTool(toolId);

    if (!tool) {
      const result: ToolExecutionResult = {
        success: false,
        output: '',
        error: `Tool not found: ${toolId}`,
        duration: 0,
        toolId,
        timestamp: startTime,
      };
      this.emit('tool-error', { toolId, error: result.error });
      return result;
    }

    if (!tool.isEnabled) {
      const result: ToolExecutionResult = {
        success: false,
        output: '',
        error: `Tool is disabled: ${toolId}`,
        duration: 0,
        toolId,
        timestamp: startTime,
      };
      this.emit('tool-error', { toolId, error: result.error });
      return result;
    }

    try {
      let output = '';

      switch (tool.source) {
        case ToolSource.BUILTIN:
          output = await this.executeBuiltinTool(toolId, params);
          break;
        case ToolSource.CUSTOM_JS:
        case ToolSource.CUSTOM_PYTHON:
          output = await this.executeCustomTool(toolId, params);
          break;
        case ToolSource.MCP:
          output = await this.executeMcpTool(toolId, params);
          break;
        case ToolSource.ATTACHED_AGENT:
          output = await this.executeAgentTool(toolId, params);
          break;
        default:
          throw new Error(`Unknown tool source: ${tool.source}`);
      }

      const result: ToolExecutionResult = {
        success: true,
        output,
        duration: Date.now() - startTime,
        toolId,
        timestamp: startTime,
      };

      this.addToHistory(result);
      this.emit('tool-executed', { toolId, result });
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const result: ToolExecutionResult = {
        success: false,
        output: '',
        error: errorMsg,
        duration: Date.now() - startTime,
        toolId,
        timestamp: startTime,
      };

      this.addToHistory(result);
      this.emit('tool-error', { toolId, error: errorMsg });
      return result;
    }
  }

  /**
   * Execute built-in tool
   */
  private async executeBuiltinTool(toolId: string, params: Record<string, unknown>): Promise<string> {
    // Built-in tools are executed through the main process bridge
    // This is a placeholder - actual implementation would call the appropriate bridge
    return `Executed built-in tool: ${toolId}`;
  }

  /**
   * Execute custom tool
   */
  private async executeCustomTool(toolId: string, params: Record<string, unknown>): Promise<string> {
    const custom = this.customTools.get(toolId);
    if (!custom) throw new Error(`Custom tool not found: ${toolId}`);

    // Execute custom code in sandbox
    // This is a placeholder - actual implementation would use VM or subprocess
    if (custom.language === 'javascript' || custom.language === 'typescript') {
      // Use Function constructor for simple JS execution
      const func = new Function('params', custom.code);
      const result = func(params);
      return String(result);
    } else if (custom.language === 'python') {
      // Python execution would require a Python subprocess
      throw new Error('Python execution not yet implemented');
    }

    throw new Error(`Unsupported language: ${custom.language}`);
  }

  /**
   * Execute MCP tool
   */
  private async executeMcpTool(toolId: string, params: Record<string, unknown>): Promise<string> {
    // MCP tools are executed through the MCP bridge
    // This is a placeholder - actual implementation would call the MCP bridge
    return `Executed MCP tool: ${toolId}`;
  }

  /**
   * Execute agent tool
   */
  private async executeAgentTool(toolId: string, params: Record<string, unknown>): Promise<string> {
    // Agent tools are executed through the attached agent service
    // This is a placeholder - actual implementation would call the attached agent service
    return `Executed agent tool: ${toolId}`;
  }

  /**
   * Add result to history
   */
  private addToHistory(result: ToolExecutionResult): void {
    this.executionHistory.push(result);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ToolExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * Get tool registry state
   */
  getRegistryState(): ToolRegistryState {
    return {
      builtinTools: Array.from(this.builtinTools.values()),
      customTools: Array.from(this.customTools.values()),
      mcpTools: Array.from(this.mcpTools.values()),
      agentTools: Array.from(this.agentTools.values()),
    };
  }

  /**
   * Convert built-in tool config to extended definition
   */
  private convertBuiltinToExtended(tool: BuiltinToolConfig): ExtendedToolDefinition {
    return {
      id: tool.id,
      name: tool.name,
      displayNameKey: tool.name,
      category: tool.category,
      priority: 0,
      availability: { platforms: ['darwin', 'linux', 'win32'] },
      capabilities: {
        supportsStreaming: false,
        supportsImages: false,
        supportsCharts: false,
        supportsMarkdown: true,
        supportsInteraction: false,
        outputFormats: [],
      },
      renderer: { type: RendererType.STANDARD, config: {} },
      source: ToolSource.BUILTIN,
      icon: tool.icon,
      descriptionKey: tool.description,
      isEditable: false,
      isEnabled: tool.enabled,
      isSystem: true,
      requiresConfirmation: false,
      schema: {},
    };
  }

  /**
   * Convert custom tool config to extended definition
   */
  private convertCustomToExtended(tool: CustomToolConfig): ExtendedToolDefinition {
    return {
      id: tool.id,
      name: tool.name,
      displayNameKey: tool.name,
      category: ToolCategory.CUSTOM,
      priority: 50,
      availability: { platforms: ['darwin', 'linux', 'win32'] },
      capabilities: {
        supportsStreaming: false,
        supportsImages: false,
        supportsCharts: false,
        supportsMarkdown: false,
        supportsInteraction: false,
        outputFormats: [],
      },
      renderer: { type: RendererType.STANDARD, config: {} },
      source: tool.language === 'python' ? ToolSource.CUSTOM_PYTHON : ToolSource.CUSTOM_JS,
      customCode: tool.code,
      language: tool.language,
      isEditable: true,
      isEnabled: tool.enabled,
      isSystem: false,
      requiresConfirmation: true,
      schema: tool.schema,
      icon: 'Tool',
      descriptionKey: tool.description,
    };
  }
}

// Export singleton instance
export const extendedToolsService = new ExtendedToolsService();
