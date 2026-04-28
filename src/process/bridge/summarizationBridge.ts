/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Summarization Bridge - IPC bridge for summarization service
 */

import { ipcBridge } from '@/common';
import { summarizationService } from '@process/services/summarizationService';
import type { SummarizationJob, SummarizationResult, SummarizerAgentConfig } from '@/common/types/summarization';

export function initSummarizationBridge(): void {
  // Get configuration
  ipcBridge.summarization.getConfig.provider(async () => {
    try {
      const config = summarizationService.getConfig();
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting config',
      };
    }
  });

  // Update configuration
  ipcBridge.summarization.updateConfig.provider(async (updates) => {
    try {
      const config = await summarizationService.updateConfig(updates);
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error updating config',
      };
    }
  });

  // Estimate tokens
  ipcBridge.summarization.estimateTokens.provider(async (content) => {
    try {
      const tokens = summarizationService.estimateTokens(content);
      return { success: true, data: tokens };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error estimating tokens',
      };
    }
  });

  // Determine strategy
  ipcBridge.summarization.determineStrategy.provider(async (tokenCount) => {
    try {
      const estimate = summarizationService.determineStrategy(tokenCount);
      return { success: true, data: estimate };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error determining strategy',
      };
    }
  });

  // Create job
  ipcBridge.summarization.createJob.provider(async ({ filePath, content }) => {
    try {
      const job = await summarizationService.createJob(filePath, content);
      return { success: true, data: job };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error creating job',
      };
    }
  });

  // Get job
  ipcBridge.summarization.getJob.provider(async (jobId) => {
    try {
      const job = summarizationService.getJob(jobId);
      if (!job) {
        return { success: false, msg: `Job not found: ${jobId}` };
      }
      return { success: true, data: job };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting job',
      };
    }
  });

  // Get all jobs
  ipcBridge.summarization.getAllJobs.provider(async () => {
    try {
      const jobs = summarizationService.getAllJobs();
      return { success: true, data: jobs };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting jobs',
      };
    }
  });

  // Execute job
  ipcBridge.summarization.executeJob.provider(async (jobId) => {
    try {
      const result = await summarizationService.executeJob(jobId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error executing job',
      };
    }
  });

  // Cancel job
  ipcBridge.summarization.cancelJob.provider(async (jobId) => {
    try {
      const result = summarizationService.cancelJob(jobId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error cancelling job',
      };
    }
  });

  // Delete job
  ipcBridge.summarization.deleteJob.provider(async (jobId) => {
    try {
      const result = summarizationService.deleteJob(jobId);
      return { success: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error deleting job',
      };
    }
  });

  // Summarize text
  ipcBridge.summarization.summarizeText.provider(async (text) => {
    try {
      const result = await summarizationService.summarizeText(text);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error summarizing text',
      };
    }
  });

  // Summarize file
  ipcBridge.summarization.summarizeFile.provider(async ({ filePath, content }) => {
    try {
      const result = await summarizationService.summarizeFile(filePath, content);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error summarizing file',
      };
    }
  });
}
