/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { 
  BaseDeclarativeTool, 
  BaseToolInvocation, 
  Kind, 
  LlmRole,
  type ToolResult,
  type MessageBus,
  type GeminiClient
} from '@office-ai/aioncli-core';
import * as fs from 'node:fs/promises';

interface VisionAnalyzeParams {
  file_path: string;
  question: string;
}

class VisionAnalyzeToolInvocation extends BaseToolInvocation<VisionAnalyzeParams, ToolResult> {
  private config: any;
  private geminiClient: GeminiClient;

  constructor(config: any, geminiClient: GeminiClient, params: VisionAnalyzeParams, messageBus: MessageBus, toolName: string, toolDisplayName: string) {
    super(params, messageBus, toolName, toolDisplayName);
    this.config = config;
    this.geminiClient = geminiClient;
  }

  getDescription() {
    return `Analyzing image ${path.basename(this.params.file_path)}: ${this.params.question}`;
  }

  async execute(signal: AbortSignal) {
    const resolvedPath = path.resolve(this.config.getTargetDir(), this.params.file_path);
    
    // 1. Validate path
    const validationError = this.config.validatePathAccess(resolvedPath, 'read');
    if (validationError) {
      return {
        llmContent: `Error: Access denied to ${this.params.file_path}`,
        returnDisplay: 'Access denied',
      };
    }

    // 2. Read image and encode to base64
    try {
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeType = ext === '.jpg' ? 'image/jpeg' : `image/${ext.replace('.', '')}`;
      const buffer = await fs.readFile(resolvedPath);
      const base64Data = buffer.toString('base64');

      // 3. Prepare multimodal content for the SAME model
      const modelConfigKey = { model: this.config.getModel() };
      const isGoogleModel = this.config.getModel().startsWith('gemini') || this.config.getModel().startsWith('vertex');
      
      const visionPart: any = isGoogleModel ? {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      } : {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`,
        },
      };

      const contents = [
        {
          role: 'user',
          parts: [
            visionPart,
            {
              text: this.params.question || "Please describe this image in detail.",
            },
          ],
        },
      ];

      // 4. Perform inference
      // Check if we need to bypass the core generator (which might strip multimodal parts for OpenAI)
      const generator = (this.geminiClient as any).getContentGeneratorOrFail?.();
      const isOpenAIGenerator = generator?.constructor?.name === 'OpenAIContentGenerator';

      let textResult = '';
      if (isOpenAIGenerator && generator.client?.chat?.completions) {
        console.log(`[VisionAnalyzeTool] Using direct OpenAI multimodal call for ${this.config.getModel()}`);
        const completion = await generator.client.chat.completions.create({
          model: this.config.getModel(),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: this.params.question || "Please describe this image in detail." },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
        });
        textResult = completion.choices[0]?.message?.content || "No description generated.";
      } else {
        // Fallback to standard GeminiClient (for native Google models)
        const response = await this.geminiClient.generateContent(
          modelConfigKey,
          contents as any,
          signal,
          LlmRole.UTILITY_TOOL
        );
        textResult = response.candidates?.[0]?.content?.parts?.[0]?.text || "No description generated.";
      }

      return {
        llmContent: `Analysis Result for ${path.basename(resolvedPath)}:\n${textResult}`,
        returnDisplay: `Analyzed ${path.basename(resolvedPath)}`,
      };
    } catch (e: any) {
      return {
        llmContent: `Failed to analyze image: ${e.message}`,
        returnDisplay: 'Inference failed',
      };
    }
  }
}

export class VisionAnalyzeTool extends BaseDeclarativeTool<VisionAnalyzeParams, ToolResult> {
  constructor(private config: any, private geminiClient: GeminiClient, messageBus: MessageBus) {
    super(
      'vision_analyze',
      'Vision Analyser',
      'Analyzes the content of an image file (PNG, JPG, WEBP) using vision capabilities. Use this when you need to "see" or "explain" an image referenced in the conversation.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Relative path to the image file' },
          question: { type: 'string', description: 'What you want to know about the image (e.g., "describe this", "what is the error text?")' },
        },
        required: ['file_path', 'question'],
      } as any,
      messageBus,
      true,
      false
    );
  }

  protected createInvocation(params: VisionAnalyzeParams, messageBus: MessageBus, toolName?: string, toolDisplayName?: string) {
    return new VisionAnalyzeToolInvocation(this.config, this.geminiClient, params, messageBus, toolName || this.name, toolDisplayName || this.displayName);
  }
}
