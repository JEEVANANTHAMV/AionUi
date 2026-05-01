/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/// 多线程管理模型
// 1. 主进程管理子进程 -》 进程管理器，需要维护当前所有子进程，并负责子进程的通信操作
// 2. 子进程管理，需要根据不同的agent处理不同的agent任务，同时所有子进程具备相同的通信机制
import { GeminiAgent } from '@process/agent/gemini';
import { forkTask } from './utils';
export default forkTask(({ data }, pipe) => {
  pipe.log('gemini.init', data);
  console.log(`[GeminiWorker] presetRules length: ${data.presetRules?.length || 0}`);
  console.log(`[GeminiWorker] presetRules preview: ${data.presetRules?.substring(0, 200) || 'empty'}`);

  // Track registered confirmation listeners to prevent duplicate pipe.once registrations.
  // onToolCallsUpdate fires for every state change across ALL tools, so tools still in
  // awaiting_approval re-emit confirmationDetails each time. Without deduplication, multiple
  // onConfirm callbacks accumulate and fire simultaneously when the user approves, causing
  // CoreToolScheduler to treat the duplicate calls as rejection.
  const registeredConfirmCallIds = new Set<string>();
  const confirmCallbacks = new Map<string, (outcome: string, payload?: any) => void>();

  const agent = new GeminiAgent({
    ...data,
    onStreamEvent(event) {
      if (event.type === 'tool_group') {
        // Clone the tool data array to avoid modifying the agent's internal references by accident.
        // This ensures the agent's internal state still has the 'onConfirm' function 
        // even after we "clean" the version we send to the UI.
        const originalTools = event.data as any[];
        event.data = originalTools.map((tool: any) => {
          const { confirmationDetails, ...other } = tool;
          if (confirmationDetails) {
            const { onConfirm, ...details } = confirmationDetails;
            
            // Store the function reference before we strip it from the display object
            if (onConfirm) {
              confirmCallbacks.set(tool.callId, onConfirm);
            }

            if (!registeredConfirmCallIds.has(tool.callId)) {
              console.log(`[GeminiWorker] Registering confirm listener for ${tool.callId} (${tool.name})`);
              registeredConfirmCallIds.add(tool.callId);
              pipe.once(
                tool.callId,
                async (data: any, deferred?: { resolve: (v: unknown) => void }) => {
                  console.log(`[GeminiWorker] Received confirmation for ${tool.callId}:`, JSON.stringify(data));
                  const latestOnConfirm = confirmCallbacks.get(tool.callId);
                  registeredConfirmCallIds.delete(tool.callId);
                  confirmCallbacks.delete(tool.callId);

                  if (latestOnConfirm) {
                    const outcome = typeof data === 'object' ? data.outcome : data;
                    const payload = typeof data === 'object' ? data.payload : undefined;
                    
                    try {
                      // Delegate resumption to the agent instance which has access to the REAL tool call objects.
                      await agent.confirmTool(tool.callId, outcome, payload);
                    } catch (err) {
                      console.error(`[GeminiWorker] agent.confirmTool FAILED for ${tool.callId}:`, err);
                    }
                  }
                  // Resolve the deferred so postMessagePromise in the main process
                  // gets its callback. Without this, the promise leaks and the
                  // main-process once(callbackKey) listener is never cleaned up.
                  if (deferred?.resolve) deferred.resolve(undefined);
                }
              );
            }
            return {
              ...other,
              confirmationDetails: details,
            };
          }
          return tool;
        });
      }
      pipe.call('gemini.message', event);
    },
  });
  pipe.on('stop.stream', (_, deferred) => {
    agent.stop();
    deferred.with(Promise.resolve());
  });
  pipe.on('init.history', (event: { text: string }, deferred) => {
    deferred.with(agent.injectConversationHistory(event.text));
  });
  pipe.on('send.message', (event: { input: string; msg_id: string; files?: string[] }, deferred) => {
    deferred.with(agent.send(event.input, event.msg_id, event.files));
  });
  pipe.on('set_yolo_mode', (event: { yoloMode: boolean }) => {
    agent.setYoloMode(event.yoloMode);
  });

  return agent.bootstrap;
});
