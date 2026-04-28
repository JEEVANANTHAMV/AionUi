/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extended Tools Bridge - IPC bridge for extended tools service
 */

import { ipcBridge } from '@/common';
import { extendedToolsService } from '@process/services/extendedToolsService';
import type {
  ExtendedToolDefinition,
  ExtendedToolCategory,
  CustomToolConfig,
  ToolExecutionResult,
  ToolRegistryState,
} from '@/common/types/extendedTools';

export function initExtendedToolsBridge(): void {
  // Get all tools
  ipcBridge.extendedTools.getAllTools.provider(async () => {
    try {
      const tools = extendedToolsService.getAllTools();
      return { success: true, data: tools };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting tools',
      };
    }
  });

  // Get tools by category
  ipcBridge.extendedTools.getToolsByCategory.provider(async (category: ExtendedToolCategory) => {
    try {
      const tools = extendedToolsService.getToolsByCategory(category);
      return { success: true, data: tools };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting tools by category',
      };
    }
  });

  // Get tool by ID
  ipcBridge.extendedTools.getTool.provider(async (toolId) => {
    try {
      const tool = extendedToolsService.getTool(toolId);
      if (!tool) {
        return { success: false, msg: `Tool not found: ${toolId}` };
      }
      return { success: true, data: tool };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting tool',
      };
    }
  });

  // Get enabled tools
  ipcBridge.extendedTools.getEnabledTools.provider(async () => {
    try {
      const tools = extendedToolsService.getEnabledTools();
      return { success: true, data: tools };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting enabled tools',
      };
    }
  });

  // Create custom tool
  ipcBridge.extendedTools.createCustomTool.provider(async (config) => {
    try {
      const tool = await extendedToolsService.createCustomTool(config);
      return { success: true, data: tool };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error creating custom tool',
      };
    }
  });

  // Update custom tool
  ipcBridge.extendedTools.updateCustomTool.provider(async ({ id, updates }) => {
    try {
      const tool = await extendedToolsService.updateCustomTool(id, updates);
      if (!tool) {
        return { success: false, msg: `Tool not found: ${id}` };
      }
      return { success: true, data: tool };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error updating custom tool',
      };
    }
  });

  // Delete custom tool
  ipcBridge.extendedTools.deleteCustomTool.provider(async (id) => {
    try {
      const result = await extendedToolsService.deleteCustomTool(id);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error deleting custom tool',
      };
    }
  });

  // Toggle tool
  ipcBridge.extendedTools.toggleTool.provider(async ({ toolId, enabled }) => {
    try {
      const result = await extendedToolsService.toggleTool(toolId, enabled);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error toggling tool',
      };
    }
  });

  // Execute tool
  ipcBridge.extendedTools.executeTool.provider(async ({ toolId, params }) => {
    try {
      const result = await extendedToolsService.executeTool(toolId, params);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error executing tool',
      };
    }
  });

  // Get registry state
  ipcBridge.extendedTools.getRegistryState.provider(async () => {
    try {
      const state = extendedToolsService.getRegistryState();
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting registry state',
      };
    }
  });

  // Get execution history
  ipcBridge.extendedTools.getExecutionHistory.provider(async () => {
    try {
      const history = extendedToolsService.getExecutionHistory();
      return { success: true, data: history };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting execution history',
      };
    }
  });
}
