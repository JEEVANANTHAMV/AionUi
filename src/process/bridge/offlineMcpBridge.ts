/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline MCP Bridge - IPC bridge for offline MCP service
 */

import { ipcBridge } from '@/common';
import { offlineMcpService } from '@process/services/offlineMcpService';
import type { OfflineMcpServerConfig, McpServerRuntimeState, OfflineMcpTool } from '@/common/types/offlineMcp';

export function initOfflineMcpBridge(): void {
  // Get all server configs
  ipcBridge.offlineMcp.getAllConfigs.provider(async () => {
    try {
      const configs = offlineMcpService.getAllConfigs();
      return { success: true, data: configs };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting MCP configs',
      };
    }
  });

  // Get all server states
  ipcBridge.offlineMcp.getAllStates.provider(async () => {
    try {
      const states = offlineMcpService.getAllStates();
      return { success: true, data: states };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting MCP states',
      };
    }
  });

  // Get server config
  ipcBridge.offlineMcp.getConfig.provider(async (serverId) => {
    try {
      const config = offlineMcpService.getConfig(serverId);
      if (!config) {
        return { success: false, msg: `Server not found: ${serverId}` };
      }
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting MCP config',
      };
    }
  });

  // Get server state
  ipcBridge.offlineMcp.getState.provider(async (serverId) => {
    try {
      const state = offlineMcpService.getState(serverId);
      if (!state) {
        return { success: false, msg: `Server not found: ${serverId}` };
      }
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting MCP state',
      };
    }
  });

  // Update server config
  ipcBridge.offlineMcp.updateConfig.provider(async ({ serverId, updates }) => {
    try {
      const config = await offlineMcpService.updateConfig(serverId, updates);
      if (!config) {
        return { success: false, msg: `Server not found: ${serverId}` };
      }
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error updating MCP config',
      };
    }
  });

  // Ensure bundle
  ipcBridge.offlineMcp.ensureBundle.provider(async (serverId) => {
    try {
      const result = await offlineMcpService.ensureBundle(serverId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error ensuring bundle',
      };
    }
  });

  // Start server
  ipcBridge.offlineMcp.startServer.provider(async (serverId) => {
    try {
      const result = await offlineMcpService.startServer(serverId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error starting MCP server',
      };
    }
  });

  // Stop server
  ipcBridge.offlineMcp.stopServer.provider(async (serverId) => {
    try {
      const result = await offlineMcpService.stopServer(serverId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error stopping MCP server',
      };
    }
  });

  // Restart server
  ipcBridge.offlineMcp.restartServer.provider(async (serverId) => {
    try {
      const result = await offlineMcpService.restartServer(serverId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error restarting MCP server',
      };
    }
  });

  // Discover tools
  ipcBridge.offlineMcp.discoverTools.provider(async (serverId) => {
    try {
      const tools = await offlineMcpService.discoverTools(serverId);
      return { success: true, data: tools };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error discovering tools',
      };
    }
  });

  // Start auto-start servers
  ipcBridge.offlineMcp.startAutoStartServers.provider(async () => {
    try {
      await offlineMcpService.startAutoStartServers();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error starting auto-start servers',
      };
    }
  });
}
