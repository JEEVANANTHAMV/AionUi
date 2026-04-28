/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auto-Summarization Types - For handling large documents with context window
 */

/**
 * Summarization strategy
 */
export enum SummarizationStrategy {
  /** Process entire document at once (for small files) */
  FULL = 'full',
  /** Sliding window approach for medium files */
  SLIDING_WINDOW = 'sliding_window',
  /** Hierarchical summarization for large files */
  HIERARCHICAL = 'hierarchical',
  /** Map-reduce approach for very large files */
  MAP_REDUCE = 'map_reduce',
}

/**
 * Summarization status
 */
export enum SummarizationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Context window configuration
 */
export interface ContextWindowConfig {
  /** Maximum tokens per chunk (default: 40000) */
  maxTokensPerChunk: number;
  /** Overlap between chunks in tokens (default: 1000) */
  overlapTokens: number;
  /** Maximum total tokens to process (default: 200000) */
  maxTotalTokens: number;
  /** Strategy to use */
  strategy: SummarizationStrategy;
  /** Alias for maxTokensPerChunk */
  maxChunkSize?: number;
  /** Alias for overlapTokens */
  overlapSize?: number;
}

/**
 * Default context window configuration
 */
export const DEFAULT_CONTEXT_WINDOW_CONFIG: ContextWindowConfig = {
  maxTokensPerChunk: 40000,
  overlapTokens: 1000,
  maxTotalTokens: 200000,
  strategy: SummarizationStrategy.SLIDING_WINDOW,
};

/**
 * Document chunk information
 */
export interface DocumentChunk {
  id: string;
  index: number;
  startToken: number;
  endToken: number;
  content: string;
  isProcessed: boolean;
  summary?: string;
}

/**
 * Summarization job state
 */
export interface SummarizationJob {
  id: string;
  filePath: string;
  fileSize: number;
  totalTokens: number;
  status: SummarizationStatus;
  strategy: SummarizationStrategy;
  chunks: DocumentChunk[];
  currentChunkIndex: number;
  finalSummary?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

/**
 * Summarization result
 */
export interface SummarizationResult {
  jobId: string;
  success: boolean;
  summary: string;
  chunksProcessed: number;
  totalChunks: number;
  tokensProcessed: number;
  duration: number;
  error?: string;
}

/**
 * Summarizer agent configuration
 */
export interface SummarizerAgentConfig {
  enabled: boolean;
  model: string;
  provider: string;
  maxChunkSize: number;
  overlapSize: number;
  temperature: number;
  promptTemplate: string;
  combinePromptTemplate: string;
}

/**
 * Default summarizer agent configuration
 */
export const DEFAULT_SUMMARIZER_CONFIG: SummarizerAgentConfig = {
  enabled: true,
  model: 'gemini-2.5-pro',
  provider: 'google',
  maxChunkSize: 40000,
  overlapSize: 1000,
  temperature: 0.3,
  promptTemplate: `Please summarize the following text section. Focus on:
- Key concepts and main ideas
- Important details and facts
- Technical terms and definitions
- Action items or conclusions

Text to summarize:
{content}

Provide a concise summary:`,
  combinePromptTemplate: `Please combine the following section summaries into a coherent overall summary. 
Maintain the logical flow and ensure no key information is lost.

Section summaries:
{summaries}

Provide a unified summary:`,
};

/**
 * Token estimation result
 */
export interface TokenEstimate {
  estimatedTokens: number;
  recommendedStrategy: SummarizationStrategy;
  recommendedChunkCount: number;
}

/**
 * Summarization progress event
 */
export interface SummarizationProgressEvent {
  jobId: string;
  status: SummarizationStatus;
  currentChunk: number;
  totalChunks: number;
  progressPercentage: number;
  currentSummary?: string;
}
