/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Summarization Service - Handles large documents with moving context window
 */

import { EventEmitter } from 'events';
import type {
  SummarizationJob,
  SummarizationResult,
  ContextWindowConfig,
  DocumentChunk,
  SummarizationProgressEvent,
  SummarizerAgentConfig,
  TokenEstimate,
} from '@/common/types/summarization';
import {
  DEFAULT_CONTEXT_WINDOW_CONFIG,
  DEFAULT_SUMMARIZER_CONFIG,
  SummarizationStrategy,
  SummarizationStatus,
} from '@/common/types/summarization';
import { ConfigStorage } from '@/common/config/storage';

export interface SummarizationServiceEvents {
  'job-created': { jobId: string; filePath: string };
  'job-progress': { jobId: string; progress: SummarizationProgressEvent };
  'job-completed': { jobId: string; result: SummarizationResult };
  'job-failed': { jobId: string; error: string };
}

declare interface SummarizationService {
  on<U extends keyof SummarizationServiceEvents>(
    event: U,
    listener: (data: SummarizationServiceEvents[U]) => void
  ): this;
  emit<U extends keyof SummarizationServiceEvents>(event: U, data: SummarizationServiceEvents[U]): boolean;
}

class SummarizationService extends EventEmitter {
  private jobs: Map<string, SummarizationJob> = new Map();
  private config: SummarizerAgentConfig;
  private isProcessing: Map<string, boolean> = new Map();
  private geminiClient: any = null;

  setGeminiClient(client: any) {
    this.geminiClient = client;
  }

  constructor() {
    super();
    this.config = { ...DEFAULT_SUMMARIZER_CONFIG };
    this.loadConfig();
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const stored = await ConfigStorage.get('summarization.config');
      if (stored) {
        this.config = { ...this.config, ...(stored as SummarizerAgentConfig) };
      }
    } catch (error) {
      console.error('Failed to load summarization config:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private async saveConfig(): Promise<void> {
    try {
      await ConfigStorage.set('summarization.config', this.config);
    } catch (error) {
      console.error('Failed to save summarization config:', error);
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<SummarizerAgentConfig>): Promise<SummarizerAgentConfig> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): SummarizerAgentConfig {
    return { ...this.config };
  }

  /**
   * Estimate token count from content
   * Rough estimate: ~4 characters per token
   */
  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Determine strategy based on token count
   */
  determineStrategy(tokenCount: number): TokenEstimate {
    const { maxChunkSize, maxTotalTokens } = this.getContextConfig();

    if (tokenCount <= maxChunkSize) {
      return {
        estimatedTokens: tokenCount,
        recommendedStrategy: SummarizationStrategy.FULL,
        recommendedChunkCount: 1,
      };
    } else if (tokenCount <= maxChunkSize * 2) {
      return {
        estimatedTokens: tokenCount,
        recommendedStrategy: SummarizationStrategy.SLIDING_WINDOW,
        recommendedChunkCount: 2,
      };
    } else if (tokenCount <= maxTotalTokens) {
      const chunkCount = Math.ceil(tokenCount / maxChunkSize);
      return {
        estimatedTokens: tokenCount,
        recommendedStrategy: SummarizationStrategy.HIERARCHICAL,
        recommendedChunkCount: chunkCount,
      };
    } else {
      const chunkCount = Math.ceil(tokenCount / maxChunkSize);
      return {
        estimatedTokens: tokenCount,
        recommendedStrategy: SummarizationStrategy.MAP_REDUCE,
        recommendedChunkCount: chunkCount,
      };
    }
  }

  /**
   * Create chunks from content
   */
  createChunks(content: string, strategy: SummarizationStrategy): DocumentChunk[] {
    const { maxChunkSize, overlapSize } = this.getContextConfig();
    const estimatedTokens = this.estimateTokens(content);
    const chunks: DocumentChunk[] = [];

    if (strategy === SummarizationStrategy.FULL) {
      chunks.push({
        id: `chunk-0`,
        index: 0,
        startToken: 0,
        endToken: estimatedTokens,
        content,
        isProcessed: false,
      });
      return chunks;
    }

    // Split content into chunks
    const estimatedCharsPerChunk = maxChunkSize * 4;
    const overlapChars = overlapSize * 4;

    let position = 0;
    let index = 0;
    let startToken = 0;

    while (position < content.length) {
      const endPosition = Math.min(position + estimatedCharsPerChunk, content.length);

      // Try to break at a natural boundary (paragraph or sentence)
      let actualEndPosition = endPosition;
      if (endPosition < content.length) {
        // Look for paragraph break
        const nextParaBreak = content.indexOf('\n\n', endPosition - estimatedCharsPerChunk / 2);
        if (nextParaBreak !== -1 && nextParaBreak < endPosition + 100) {
          actualEndPosition = nextParaBreak;
        } else {
          // Look for sentence break
          const sentenceBreak = content.match(/[.!?]\s+/g);
          if (sentenceBreak) {
            const lastBreak = content.lastIndexOf(sentenceBreak[sentenceBreak.length - 1], endPosition);
            if (lastBreak > position + estimatedCharsPerChunk / 2) {
              actualEndPosition = lastBreak + 2;
            }
          }
        }
      }

      const chunkContent = content.slice(position, actualEndPosition);
      const chunkTokens = this.estimateTokens(chunkContent);

      chunks.push({
        id: `chunk-${index}`,
        index,
        startToken,
        endToken: startToken + chunkTokens,
        content: chunkContent,
        isProcessed: false,
      });

      position = actualEndPosition - overlapChars;
      startToken += chunkTokens - overlapSize;
      index++;

      if (position >= content.length - overlapChars) break;
    }

    return chunks;
  }

  /**
   * Create a new summarization job
   */
  async createJob(filePath: string, content: string): Promise<SummarizationJob> {
    const estimatedTokens = this.estimateTokens(content);
    const { recommendedStrategy } = this.determineStrategy(estimatedTokens);

    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();

    let chunks: DocumentChunk[] = [];
    if (ext === '.pdf' || ['.docx', '.doc'].includes(ext)) {
      chunks = await this.createPageChunks(filePath, content);
    } else {
      chunks = this.createChunks(content, recommendedStrategy);
    }

    const job: SummarizationJob = {
      id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      fileSize: content.length,
      totalTokens: estimatedTokens,
      status: SummarizationStatus.PENDING,
      strategy: recommendedStrategy,
      chunks,
      currentChunkIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.jobs.set(job.id, job);
    this.emit('job-created', { jobId: job.id, filePath });

    return job;
  }

  /**
   * Create chunks based on pages (for PDF/DOCX)
   */
  async createPageChunks(filePath: string, content: string): Promise<DocumentChunk[]> {
    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();
    const chunks: DocumentChunk[] = [];

    let pages: string[] = [];

    if (ext === '.pdf') {
      try {
        pages = await this.readPdfPages(filePath);
      } catch (e) {
        console.error('Failed to read PDF pages, falling back to token chunking:', e);
      }
    } else if (['.docx', '.doc'].includes(ext)) {
      try {
        pages = await this.readDocxPages(filePath);
      } catch (e) {
        console.error('Failed to read DOCX pages, falling back to token chunking:', e);
      }
    }

    if (pages.length === 0) {
      return this.createChunks(content, SummarizationStrategy.SLIDING_WINDOW);
    }

    const pagesPerChunk = 50;
    const overlapPages = 5;

    let index = 0;
    for (let i = 0; i < pages.length; i += pagesPerChunk - overlapPages) {
      const chunkPages = pages.slice(i, i + pagesPerChunk);
      const chunkContent = chunkPages.join('\n\n');
      const chunkTokens = this.estimateTokens(chunkContent);

      chunks.push({
        id: `chunk-page-${index}`,
        index,
        startToken: i,
        endToken: i + chunkPages.length,
        content: chunkContent,
        isProcessed: false,
      });

      index++;
      if (i + pagesPerChunk >= pages.length) break;
    }

    return chunks;
  }

  private async readPdfPages(filePath: string): Promise<string[]> {
    const fs = require('fs');
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const data = new Uint8Array(fs.readFileSync(filePath));
      const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
      });

      const pdf = await loadingTask.promise;
      const pages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        pages.push(pageText);
      }

      return pages;
    } catch (e) {
      console.error('Error reading PDF pages with pdfjs-dist:', e);
      throw e;
    }
  }

  private async readDocxPages(filePath: string): Promise<string[]> {
    const fs = require('fs');
    const mammoth = require('mammoth');

    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;

    const words = text.split(/\s+/);
    const wordsPerPage = 500;
    const pages: string[] = [];

    for (let i = 0; i < words.length; i += wordsPerPage) {
      pages.push(words.slice(i, i + wordsPerPage).join(' '));
    }

    return pages;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): SummarizationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): SummarizationJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Execute summarization job
   */
  async executeJob(jobId: string): Promise<SummarizationResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (this.isProcessing.get(jobId)) {
      throw new Error(`Job already processing: ${jobId}`);
    }

    this.isProcessing.set(jobId, true);
    const startTime = Date.now();

    try {
      this.updateJobStatus(jobId, SummarizationStatus.PROCESSING);

      let finalSummary = '';
      const chunkSummaries: string[] = [];

      // Process each chunk
      for (let i = 0; i < job.chunks.length; i++) {
        const chunk = job.chunks[i];
        this.updateJobProgress(jobId, i);

        // Summarize chunk
        const chunkSummary = await this.summarizeChunk(chunk, i, job.chunks.length);
        chunkSummaries.push(chunkSummary);
        chunk.summary = chunkSummary;
        chunk.isProcessed = true;

        // Emit progress event
        this.emitProgress(jobId, i + 1, job.chunks.length, chunkSummary);
      }

      // Combine summaries based on strategy
      finalSummary = await this.combineSummaries(chunkSummaries, job.strategy);

      // Update job with result
      const result: SummarizationResult = {
        jobId,
        success: true,
        summary: finalSummary,
        chunksProcessed: job.chunks.length,
        totalChunks: job.chunks.length,
        tokensProcessed: job.totalTokens,
        duration: Date.now() - startTime,
      };

      this.updateJobResult(jobId, finalSummary);
      this.emit('job-completed', { jobId, result });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateJobError(jobId, errorMsg);

      const result: SummarizationResult = {
        jobId,
        success: false,
        summary: '',
        chunksProcessed: job.currentChunkIndex,
        totalChunks: job.chunks.length,
        tokensProcessed: 0,
        duration: Date.now() - startTime,
        error: errorMsg,
      };

      this.emit('job-failed', { jobId, error: errorMsg });
      return result;
    } finally {
      this.isProcessing.set(jobId, false);
    }
  }

  /**
   * Summarize a single chunk
   */
  private async summarizeChunk(chunk: DocumentChunk, index: number, total: number): Promise<string> {
    const prompt = this.config.promptTemplate.replace('{content}', chunk.content);

    if (this.geminiClient) {
      try {
        const { DEFAULT_GEMINI_FLASH_MODEL, LlmRole } = require('@office-ai/aioncli-core');
        const result = await this.geminiClient.generateContent(
          { model: DEFAULT_GEMINI_FLASH_MODEL },
          [{ role: 'user', parts: [{ text: prompt }] }],
          new AbortController().signal,
          LlmRole.UTILITY_TOOL
        );

        const parts = result.candidates?.[0]?.content?.parts;
        if (parts) {
          const text = parts
            .map((part: any) => part.text)
            .filter(Boolean)
            .join('');
          if (text) return text;
        }
      } catch (e) {
        console.error('Failed to summarize chunk using Gemini API:', e);
      }
    }

    // Fallback: truncate and add summary prefix
    const words = chunk.content.split(/\s+/).slice(0, 50).join(' ');
    return `[Summary of section ${index + 1}/${total}]: ${words}${chunk.content.length > words.length ? '...' : ''}`;
  }

  /**
   * Combine chunk summaries
   */
  private async combineSummaries(summaries: string[], strategy: SummarizationStrategy): Promise<string> {
    if (summaries.length === 1) {
      return summaries[0];
    }

    const combinedText = summaries.join('\n\n---\n\n');

    if (strategy === SummarizationStrategy.MAP_REDUCE && summaries.length > 5) {
      const estimatedTokens = this.estimateTokens(combinedText);
      const { maxChunkSize } = this.getContextConfig();

      if (estimatedTokens > maxChunkSize) {
        const midPoint = Math.ceil(summaries.length / 2);
        const firstHalf = await this.combineSummaries(summaries.slice(0, midPoint), SummarizationStrategy.HIERARCHICAL);
        const secondHalf = await this.combineSummaries(summaries.slice(midPoint), SummarizationStrategy.HIERARCHICAL);
        return await this.summarizeChunk(
          {
            id: 'final',
            index: 0,
            startToken: 0,
            endToken: estimatedTokens,
            content: `${firstHalf}\n\n${secondHalf}`,
            isProcessed: false,
          },
          0,
          1
        );
      }
    }

    const prompt = this.config.combinePromptTemplate.replace('{summaries}', combinedText);

    if (this.geminiClient) {
      try {
        const { DEFAULT_GEMINI_FLASH_MODEL, LlmRole } = require('@office-ai/aioncli-core');
        const result = await this.geminiClient.generateContent(
          { model: DEFAULT_GEMINI_FLASH_MODEL },
          [{ role: 'user', parts: [{ text: prompt }] }],
          new AbortController().signal,
          LlmRole.UTILITY_TOOL
        );

        const parts = result.candidates?.[0]?.content?.parts;
        if (parts) {
          const text = parts
            .map((part: any) => part.text)
            .filter(Boolean)
            .join('');
          if (text) return text;
        }
      } catch (e) {
        console.error('Failed to combine summaries using Gemini API:', e);
      }
    }

    return `Combined Summary:\n\n${summaries.length} sections summarized.\n\nKey points:\n${summaries.map((s, i) => `${i + 1}. ${s.substring(0, 100)}...`).join('\n')}`;
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === SummarizationStatus.PROCESSING) {
      this.isProcessing.set(jobId, false);
      this.updateJobError(jobId, 'Job cancelled by user');
      return true;
    }

    return false;
  }

  /**
   * Delete a job
   */
  deleteJob(jobId: string): boolean {
    this.cancelJob(jobId);
    return this.jobs.delete(jobId);
  }

  /**
   * Update job status
   */
  private updateJobStatus(jobId: string, status: SummarizationStatus): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = Date.now();
      this.jobs.set(jobId, job);
    }
  }

  /**
   * Update job progress
   */
  private updateJobProgress(jobId: string, currentChunk: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.currentChunkIndex = currentChunk;
      job.updatedAt = Date.now();
      this.jobs.set(jobId, job);
    }
  }

  /**
   * Update job with result
   */
  private updateJobResult(jobId: string, summary: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = SummarizationStatus.COMPLETED;
      job.finalSummary = summary;
      job.completedAt = Date.now();
      job.updatedAt = Date.now();
      this.jobs.set(jobId, job);
    }
  }

  /**
   * Update job with error
   */
  private updateJobError(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = SummarizationStatus.FAILED;
      job.error = error;
      job.updatedAt = Date.now();
      this.jobs.set(jobId, job);
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(jobId: string, currentChunk: number, totalChunks: number, currentSummary?: string): void {
    const progress: SummarizationProgressEvent = {
      jobId,
      status: SummarizationStatus.PROCESSING,
      currentChunk,
      totalChunks,
      progressPercentage: Math.round((currentChunk / totalChunks) * 100),
      currentSummary,
    };

    this.emit('job-progress', { jobId, progress });
  }

  /**
   * Get context window configuration
   */
  private getContextConfig(): ContextWindowConfig {
    return {
      maxTokensPerChunk: this.config.maxChunkSize,
      overlapTokens: this.config.overlapSize,
      maxTotalTokens: this.config.maxChunkSize * 5,
      strategy: SummarizationStrategy.SLIDING_WINDOW,
      maxChunkSize: this.config.maxChunkSize,
      overlapSize: this.config.overlapSize,
    };
  }

  /**
   * Summarize text (convenience method)
   */
  async summarizeText(text: string, filePath?: string): Promise<SummarizationResult> {
    const job = await this.createJob(filePath || 'inline-text', text);
    return this.executeJob(job.id);
  }

  /**
   * Summarize large file
   */
  async summarizeFile(filePath: string, content: string): Promise<SummarizationResult> {
    const job = await this.createJob(filePath, content);
    return this.executeJob(job.id);
  }
}

// Export singleton instance
export const summarizationService = new SummarizationService();
