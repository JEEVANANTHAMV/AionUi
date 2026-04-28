/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Attached Agents Bridge - IPC bridge for attached agents service
 */

import { ipcBridge } from '@/common';
import { attachedAgentService } from '@process/services/attachedAgentService';
import type {
  AttachedAgentConfig,
  AttachedAgentState,
  AttachedAgentTaskRequest,
  AttachedAgentTaskResponse,
} from '@/common/types/attachedAgents';

export function initAttachedAgentBridge(): void {
  // Get all agent configs
  ipcBridge.attachedAgents.getAllConfigs.provider(async () => {
    try {
      const configs = attachedAgentService.getAllConfigs();
      return { success: true, data: configs };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting agent configs',
      };
    }
  });

  // Get all agent states
  ipcBridge.attachedAgents.getAllStates.provider(async () => {
    try {
      const states = attachedAgentService.getAllStates();
      return { success: true, data: states };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting agent states',
      };
    }
  });

  // Get agent config
  ipcBridge.attachedAgents.getConfig.provider(async (agentId) => {
    try {
      const config = attachedAgentService.getConfig(agentId);
      if (!config) {
        return { success: false, msg: `Agent not found: ${agentId}` };
      }
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting agent config',
      };
    }
  });

  // Get agent state
  ipcBridge.attachedAgents.getState.provider(async (agentId) => {
    try {
      const state = attachedAgentService.getState(agentId);
      if (!state) {
        return { success: false, msg: `Agent not found: ${agentId}` };
      }
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting agent state',
      };
    }
  });

  // Update agent config
  ipcBridge.attachedAgents.updateConfig.provider(async ({ agentId, updates }) => {
    try {
      const config = attachedAgentService.updateConfig(agentId, updates);
      if (!config) {
        return { success: false, msg: `Agent not found: ${agentId}` };
      }
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error updating agent config',
      };
    }
  });

  // Start agent
  ipcBridge.attachedAgents.startAgent.provider(async (agentId) => {
    try {
      const result = await attachedAgentService.startAgent(agentId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error starting agent',
      };
    }
  });

  // Stop agent
  ipcBridge.attachedAgents.stopAgent.provider(async (agentId) => {
    try {
      const result = await attachedAgentService.stopAgent(agentId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error stopping agent',
      };
    }
  });

  // Execute task on agent
  ipcBridge.attachedAgents.executeTask.provider(async (request) => {
    try {
      const result = await attachedAgentService.executeTask(request);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error executing task',
      };
    }
  });

  // Get agent capabilities
  ipcBridge.attachedAgents.getCapabilities.provider(async (agentId) => {
    try {
      const capabilities = attachedAgentService.getAgentCapabilities(agentId);
      if (!capabilities) {
        return { success: false, msg: `Agent not found: ${agentId}` };
      }
      return { success: true, data: capabilities };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting agent capabilities',
      };
    }
  });
}
