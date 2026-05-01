/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-export GeminiApprovalStore for use in other modules
export { GeminiApprovalStore } from './GeminiApprovalStore';

// src/core/ConfigManager.ts
import { FORJINN_DESK_FILES_MARKER } from '../../../common/config/constants';
import { NavigationInterceptor } from '../../../common/chat/navigation';
import type { TProviderWithModel, ICustomHttpTool } from '../../../common/config/storage';
import { uuid } from '../../../common/utils';
import { getProviderAuthType } from '../../../common/utils/platformAuthType';
import { isNewApiPlatform } from '../../../common/utils/platformConstants';
import { normalizeNewApiBaseUrl } from '../../../common/api/ClientFactory';
import type {
  CompletedToolCall,
  Config,
  GeminiClient,
  ServerGeminiStreamEvent,
  ToolCall,
  ToolCallRequestInfo,
  Turn,
} from '@office-ai/aioncli-core';
import {
  AuthType,
  clearOauthClientCache,
  CoreToolScheduler,
  FileDiscoveryService,
  GeminiEventType,
  refreshServerHierarchicalMemory,
  sessionId,
} from '@office-ai/aioncli-core';
import fs from 'fs';
import { ApiKeyManager } from '../../../common/api/ApiKeyManager';
import { handleAtCommand } from './cli/atCommandProcessor';
import { loadCliConfig } from './cli/config';
import { loadExtensions } from './cli/extension';
import { getGlobalTokenManager } from './cli/oauthTokenManager';
import type { Settings } from './cli/settings';
import { loadSettings } from './cli/settings';
import { globalToolCallGuard, type StreamConnectionEvent } from './cli/streamResilience';
import { ConversationToolConfig } from './cli/tools/conversation-tool-config';
import { mapToDisplay, type TrackedToolCall } from './cli/useReactToolScheduler';
import {
  compactToolResponsesInHistory,
  getPromptCount,
  handleCompletedTools,
  processGeminiStreamEvents,
  startNewPrompt,
} from './utils';
import path from 'path';
import os from 'os';
import { summarizationService } from '../../services/summarizationService';
import { attachedAgentService } from '../../services/attachedAgentService';
import { DEFAULT_ATTACHED_AGENTS } from '../../../common/types/attachedAgents';
import { ProcessConfig } from '../../utils/initStorage';
import officeparser from 'officeparser';

// Global registry for current agent instance (used by flashFallbackHandler)
let currentGeminiAgent: GeminiAgent | null = null;

/**
 * Check if Google OAuth credentials exist
 * 检查 Google OAuth 凭证是否存在
 *
 * Gemini CLI stores OAuth credentials in ~/.gemini/oauth_creds.json
 * If this file doesn't exist or is empty, OAuth hasn't been configured
 * Gemini CLI 将 OAuth 凭证存储在 ~/.gemini/oauth_creds.json
 * 如果此文件不存在或为空，则表示 OAuth 尚未配置
 */
function hasGoogleOAuthCredentials(): boolean {
  try {
    const credentialsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
    if (!fs.existsSync(credentialsPath)) {
      return false;
    }
    const content = fs.readFileSync(credentialsPath, 'utf-8');
    const creds = JSON.parse(content);
    // Check if credentials have the required fields
    // 检查凭证是否包含必要字段
    return !!(creds && (creds.access_token || creds.refresh_token));
  } catch {
    return false;
  }
}

interface GeminiAgent2Options {
  workspace: string;
  proxy?: string;
  model: TProviderWithModel;
  webSearchEngine?: 'google' | 'default';
  yoloMode?: boolean;
  GOOGLE_CLOUD_PROJECT?: string;
  mcpServers?: Record<string, unknown>;
  contextFileName?: string;
  onStreamEvent: (event: { type: string; data: unknown; msg_id: string }) => void;
  // 系统规则，在初始化时注入到 userMemory / System rules, injected into userMemory at initialization
  presetRules?: string;
  contextContent?: string; // 向后兼容 / Backward compatible
  /** 内置 skills 目录路径，使用 aioncli-core SkillManager 加载 / Builtin skills directory path, loaded by aioncli-core SkillManager */
  skillsDir?: string;
  /** 启用的 skills 列表，用于过滤 SkillManager 中的 skills / Enabled skills list for filtering skills in SkillManager */
  enabledSkills?: string[];
  /** 排除使用的工具列表 / List of tools to exclude */
  excludeTools?: string[];
  /** 自定义 HTTP 工具列表 / List of custom HTTP tools */
  customHttpTools?: ICustomHttpTool[];
}

export class GeminiAgent {
  config: Config | null = null;
  private workspace: string | null = null;
  private proxy: string | null = null;
  private model: TProviderWithModel | null = null;
  private webSearchEngine: 'google' | 'default' | null = null;
  private yoloMode: boolean = false;
  private googleCloudProject: string | null = null;
  private mcpServers: Record<string, unknown> = {};
  private excludeTools: string[] = [];
  private geminiClient: GeminiClient | null = null;
  private authType: AuthType | null = null;
  private scheduler: CoreToolScheduler | null = null;
  private trackedCalls: TrackedToolCall[] = [];
  private abortController: AbortController | null = null;
  private activeMsgId: string | null = null;
  private onStreamEvent: (event: { type: string; data: unknown; msg_id: string }) => void;
  // 系统规则，在初始化时注入 / System rules, injected at initialization
  private presetRules?: string;
  private contextContent?: string; // 向后兼容 / Backward compatible
  private toolConfig: ConversationToolConfig; // 对话级别的工具配置
  private apiKeyManager: ApiKeyManager | null = null; // 多API Key管理器
  private settings: Settings | null = null;
  private historyPrefix: string | null = null;
  private historyUsedOnce = false;
  private skillsIndexPrependedOnce = false; // Track if we've prepended skills index to first message
  private contextFileName: string | undefined;
  private lastQuery: unknown = null;
  private lastOptions: any = null;
  /** 内置 skills 目录路径 / Builtin skills directory path */
  private skillsDir?: string;
  /** 启用的 skills 列表 / Enabled skills list */
  private enabledSkills?: string[];
  /** 排除使用的工具列表 / List of tools to exclude */
  private _excludeTools?: string[];
  /** 自定义 HTTP 工具列表 / List of custom HTTP tools */
  private customHttpTools: ICustomHttpTool[] = [];
  bootstrap: Promise<void>;
  static buildFileServer(workspace: string) {
    return new FileDiscoveryService(workspace);
  }
  constructor(options: GeminiAgent2Options) {
    this.workspace = options.workspace;
    this.proxy = options.proxy;
    this.model = options.model;
    this.webSearchEngine = options.webSearchEngine || 'default';
    this.yoloMode = options.yoloMode || false;
    this.googleCloudProject = options.GOOGLE_CLOUD_PROJECT;
    this.mcpServers = options.mcpServers || {};
    this.excludeTools = options.excludeTools || [];
    this.contextFileName = options.contextFileName;
    // 使用统一的工具函数获取认证类型
    this.authType = getProviderAuthType(options.model);
    this.onStreamEvent = options.onStreamEvent;
    this.presetRules = options.presetRules;
    this.mcpServers = options.mcpServers || {};
    this.excludeTools = options.excludeTools || [];
    this.customHttpTools = options.customHttpTools || [];
    this.onStreamEvent = options.onStreamEvent;
    this.presetRules = options.presetRules;
    this.contextContent = options.contextContent || options.presetRules;
    this.skillsDir = options.skillsDir;
    this.enabledSkills = options.enabledSkills;
    this._excludeTools = options.excludeTools;

    this.toolConfig = new ConversationToolConfig({
      proxy: this.proxy || '',
      webSearchEngine: this.webSearchEngine || 'default',
      customHttpTools: this.customHttpTools,
    });

    // Register as current agent for flashFallbackHandler access
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    currentGeminiAgent = this;

    this.bootstrap = this.initialize();
    // Prevent unhandled rejection when initialize fails (e.g. missing OAuth credentials).
    // The error still propagates when callers `await this.bootstrap` in send().
    this.bootstrap.catch(() => {});
  }

  private initClientEnv() {
    const fallbackValue = (key: string, value1: string, value2?: string) => {
      if (value1 && value1 !== 'undefined') {
        process.env[key] = value1;
      }
      if (value2 && value2 !== 'undefined') {
        process.env[key] = value2;
      }
    };

    // Initialize multi-key manager for supported auth types
    this.initializeMultiKeySupport();

    // Get the current API key to use (either from multi-key manager or original)
    const getCurrentApiKey = () => {
      if (this.apiKeyManager && this.apiKeyManager.hasMultipleKeys()) {
        return process.env[this.apiKeyManager.getStatus().envKey] || this.model.apiKey;
      }
      return this.model.apiKey;
    };

    // 清除所有认证相关的环境变量，避免不同认证类型之间的干扰
    // Clear all auth-related env vars to avoid interference between different auth types
    const clearAllAuthEnvVars = () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_GEMINI_BASE_URL;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.OPENAI_BASE_URL;
      delete process.env.OPENAI_API_KEY;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_PROFILE;
      delete process.env.AWS_REGION;
    };

    clearAllAuthEnvVars();

    // 对 new-api 网关进行 URL 规范化（不同协议需要不同的 URL 格式）
    // Normalize URL for new-api gateway (different protocols need different URL formats)
    const isNewApi = isNewApiPlatform(this.model.platform);
    const getBaseUrl = () =>
      isNewApi ? normalizeNewApiBaseUrl(this.model.baseUrl, this.authType) : this.model.baseUrl;

    if (this.authType === AuthType.USE_GEMINI) {
      fallbackValue('GEMINI_API_KEY', getCurrentApiKey());
      fallbackValue('GOOGLE_GEMINI_BASE_URL', getBaseUrl());
      return;
    }
    if (this.authType === AuthType.USE_VERTEX_AI) {
      fallbackValue('GOOGLE_API_KEY', getCurrentApiKey());
      process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
      return;
    }
    if (this.authType === AuthType.LOGIN_WITH_GOOGLE) {
      // 对于个人 OAuth 认证，不需要 GOOGLE_CLOUD_PROJECT
      // 如果用户配置了无效的项目 ID，会导致 403 权限错误
      // For personal OAuth auth, GOOGLE_CLOUD_PROJECT is not needed
      // Invalid project ID will cause 403 permission error
      // 只有当用户明确配置了有效的项目 ID 时才设置
      // Only set if user explicitly configured a valid project ID
      if (this.googleCloudProject && this.googleCloudProject.trim()) {
        process.env.GOOGLE_CLOUD_PROJECT = this.googleCloudProject.trim();
      }
      // 注意：LOGIN_WITH_GOOGLE 使用 OAuth，不需要设置任何 API Key
      // Note: LOGIN_WITH_GOOGLE uses OAuth, no API Key needed
      return;
    }
    if (this.authType === AuthType.USE_OPENAI) {
      fallbackValue('OPENAI_BASE_URL', getBaseUrl());
      fallbackValue('OPENAI_API_KEY', getCurrentApiKey());
      return;
    }
    if (this.authType === AuthType.USE_ANTHROPIC) {
      fallbackValue('ANTHROPIC_BASE_URL', getBaseUrl());
      fallbackValue('ANTHROPIC_API_KEY', getCurrentApiKey());
      return;
    }
    if (this.authType === AuthType.USE_BEDROCK) {
      const bedrockConfig = this.model.bedrockConfig;

      if (!bedrockConfig) {
        throw new Error('Bedrock configuration missing');
      }

      // Set region (required)
      process.env.AWS_REGION = bedrockConfig.region;

      if (bedrockConfig.authMethod === 'accessKey') {
        if (!bedrockConfig.accessKeyId || !bedrockConfig.secretAccessKey) {
          throw new Error('AWS credentials missing for access key authentication');
        }
        process.env.AWS_ACCESS_KEY_ID = bedrockConfig.accessKeyId;
        process.env.AWS_SECRET_ACCESS_KEY = bedrockConfig.secretAccessKey;
      } else if (bedrockConfig.authMethod === 'profile') {
        if (!bedrockConfig.profile) {
          throw new Error('AWS profile name missing');
        }
        process.env.AWS_PROFILE = bedrockConfig.profile;
        // Clear access keys to ensure profile is used
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
      }
      return;
    }
  }

  private initializeMultiKeySupport(): void {
    const apiKey = this.model?.apiKey;
    if (!apiKey || (!apiKey.includes(',') && !apiKey.includes('\n'))) {
      return; // Single key or no key, skip multi-key setup
    }

    // Only initialize for supported auth types
    if (
      this.authType === AuthType.USE_OPENAI ||
      this.authType === AuthType.USE_GEMINI ||
      this.authType === AuthType.USE_ANTHROPIC
    ) {
      this.apiKeyManager = new ApiKeyManager(apiKey, this.authType);
    }
  }

  /**
   * Get multi-key manager (used by flashFallbackHandler)
   */
  getApiKeyManager(): ApiKeyManager | null {
    return this.apiKeyManager;
  }

  private createAbortController() {
    this.abortController = new AbortController();
    return this.abortController;
  }

  private enrichErrorMessage(errorMessage: string): string {
    const reportMatch = errorMessage.match(/Full report available at:\s*(.+?\.json)/i);
    const lowerMessage = errorMessage.toLowerCase();
    if (
      lowerMessage.includes('model_capacity_exhausted') ||
      lowerMessage.includes('no capacity available') ||
      lowerMessage.includes('resource_exhausted') ||
      lowerMessage.includes('ratelimitexceeded')
    ) {
      return `${errorMessage}\nQuota exhausted on this model.`;
    }
    if (!reportMatch?.[1]) return errorMessage;
    try {
      const reportContent = fs.readFileSync(reportMatch[1], 'utf-8');
      const reportLower = reportContent.toLowerCase();
      if (
        reportLower.includes('quota') ||
        reportLower.includes('resource_exhausted') ||
        reportLower.includes('exhausted')
      ) {
        return `${errorMessage}\nQuota exhausted on this model.`;
      }
    } catch {
      // Ignore report read errors and keep original message.
    }
    return errorMessage;
  }

  private async initialize(): Promise<void> {
    const workspacePath = this.workspace;

    if (!workspacePath) {
      throw new Error('GeminiAgent workspace is empty — cannot initialize without a valid workspace path');
    }

    // Ensure workspace directory exists before loading config.
    // The temp directory created by buildWorkspaceWidthFiles may have been removed
    // by OS cleanup or antivirus before the worker process starts initialization.
    // loadServerHierarchicalMemory calls fs.realpath(workspace) without try-catch,
    // causing an unhandled ENOENT rejection (Sentry ELECTRON-6W).
    await fs.promises.mkdir(workspacePath, { recursive: true });

    // Ensure .geminiignore exists to suppress library warnings about missing ignore file
    // 确保 .geminiignore 存在，以消除库关于缺少忽略文件的警告
    const ignorePath = path.join(workspacePath, '.geminiignore');
    if (!fs.existsSync(ignorePath)) {
      await fs.promises.writeFile(ignorePath, '');
    }

    // Verify workspace is resolvable before aioncli-core attempts fs.realpath()
    // internally. The mkdir above handles ENOENT, but EACCES (permission denied)
    // still causes an unhandled rejection inside the library (Sentry ELECTRON-BM).
    await fs.promises.realpath(workspacePath);

    const settings = loadSettings(workspacePath).merged;
    if (this.contextFileName) {
      settings.contextFileName = this.contextFileName;
    }
    this.settings = settings;

    // 使用传入的 YOLO 设置
    const yoloMode = this.yoloMode;

    // 初始化对话级别的工具配置
    await this.toolConfig.initializeForConversation(this.authType!);

    const extensions = loadExtensions(workspacePath);
    this.config = await loadCliConfig({
      workspace: workspacePath,
      settings,
      extensions,
      sessionId,
      proxy: this.proxy,
      model: this.model.useModel,
      conversationToolConfig: this.toolConfig,
      yoloMode,
      mcpServers: this.mcpServers,
      excludeTools: this.excludeTools,
      skillsDir: this.skillsDir,
      enabledSkills: this.enabledSkills,
    });
    await this.config.initialize();

    // aioncli-core skips awaiting MCP server connections when interactive=true
    // (Config._initialize fires startConfiguredMcpServers without await).
    // For team mode we MUST have MCP tools ready before the first message,
    // so explicitly await MCP discovery here when team MCP servers are configured.
    if (Object.keys(this.mcpServers).length > 0) {
      const mcpMgr = this.config.getMcpClientManager?.();
      if (mcpMgr) {
        await mcpMgr.startConfiguredMcpServers();
      }
    }

    // aioncli-core 的 SkillManager.discoverSkills() 会重新从用户 skills 目录加载所有 skills
    // 覆盖了 loadCliConfig 中的过滤，需要在这里重新应用 enabledSkills 过滤
    // aioncli-core's SkillManager.discoverSkills() reloads all skills from user directory,
    // overriding our filtering in loadCliConfig, so we need to re-apply enabledSkills filter here
    if (this.enabledSkills && this.enabledSkills.length > 0) {
      const enabledSet = new Set(this.enabledSkills);
      this.config.getSkillManager().filterSkills((skill) => enabledSet.has(skill.name));
      console.log(`[GeminiAgent] Filtered skills after initialize: ${this.enabledSkills.join(', ')}`);
    } else {
      // Non-preset agent: clear all optional skills (cron is injected via system instructions)
      this.config.getSkillManager().filterSkills(() => false);
    }

    // 对于 Google OAuth 认证，先检查凭证是否存在，避免触发浏览器授权弹窗
    // For Google OAuth auth, check if credentials exist first to avoid triggering browser auth popup
    if (this.authType === AuthType.LOGIN_WITH_GOOGLE) {
      // 检查 OAuth 凭证是否存在 / Check if OAuth credentials exist
      if (!hasGoogleOAuthCredentials()) {
        // 抛出认证错误，让 UI 层处理自动切换
        // Throw auth error to let UI layer handle auto-switching
        // 错误信息包含 "authentication" 关键字以触发 GeminiSendBox 的 API 错误检测和自动切换
        // Error message contains "authentication" keyword to trigger GeminiSendBox API error detection and auto-switch
        console.error(
          '[GeminiAgent] Google OAuth credentials not found. User needs to authenticate via Gemini CLI first.'
        );
        throw new Error(
          'Google OAuth authentication not configured. Please run "gemini" CLI to authenticate first, or switch to an API key-based agent.'
        );
      }
      // 凭证存在时才清除缓存并刷新
      // Only clear cache and refresh when credentials exist
      clearOauthClientCache();
    }

    // refreshAuth 是初始化 contentGenerator 的必要步骤，所有认证类型都需要调用
    // refreshAuth is necessary to initialize contentGenerator, required for all auth types
    // 注意：OAuth 只在 LOGIN_WITH_GOOGLE 时被触发（通过 createCodeAssistContentGenerator）
    // Note: OAuth is only triggered for LOGIN_WITH_GOOGLE (via createCodeAssistContentGenerator)
    // 对于 USE_OPENAI, USE_GEMINI, USE_ANTHROPIC 等，会创建相应的 Generator 但不会触发 OAuth
    // For USE_OPENAI, USE_GEMINI, USE_ANTHROPIC, etc., corresponding Generator is created without OAuth
    await this.config.refreshAuth(this.authType);
    console.log(
      `[GeminiAgent] After refreshAuth — config.getModel(): "${this.config.getModel()}", authType used: ${this.authType}`
    );

    this.geminiClient = this.config.getGeminiClient();

    // [Vision Patch] Fix OpenAI/Qwen vision support by re-injecting multimodal parts
    // The core OpenAIContentGenerator currently strips inlineData/image_url
    const generator = (this.geminiClient as any).getContentGeneratorOrFail?.();
    if (generator && generator.constructor.name === 'OpenAIContentGenerator') {
      console.log('[GeminiAgent] Applying vision patch to OpenAIContentGenerator');
      const originalConvert = generator.convertToOpenAIFormat.bind(generator);
      generator.convertToOpenAIFormat = (request: any) => {
        const messages = originalConvert(request);
        // Match request contents with generated messages to re-inject images
        if (Array.isArray(request.contents)) {
          // We iterate backwards to match the most recent messages (most likely to have images)
          for (let i = request.contents.length - 1; i >= 0; i--) {
            const content = request.contents[i];
            const role = content.role === 'model' ? 'assistant' : 'user';
            // Find the corresponding message in the converted array
            // Note: this is a heuristic match based on role and recentness
            const message = messages.reverse().find((m: any) => m.role === role && typeof m.content === 'string');
            messages.reverse(); // put it back

            if (message && content.parts) {
              const imageParts = content.parts.filter((p: any) => p.inlineData || p.image_url);
              if (imageParts.length > 0) {
                const text = message.content;
                const newContent: any[] = [{ type: 'text', text }];
                imageParts.forEach((part: any) => {
                  if (part.inlineData) {
                    newContent.push({
                      type: 'image_url',
                      image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
                    });
                  } else if (part.image_url) {
                    newContent.push(part);
                  }
                });
                message.content = newContent;
              }
            }
          }
        }
        return messages;
      };
    }

    try {
      summarizationService.setGeminiClient(this.geminiClient);
    } catch (e) {
      console.warn('[GeminiAgent] Failed to set GeminiClient in SummarizationService:', e);
    }

    // 在初始化时注入 presetRules 到 userMemory
    // Inject presetRules into userMemory at initialization
    // Rules 定义系统行为规则，在会话开始时就应该生效
    // Rules define system behavior, should be effective from session start
    console.log(`[GeminiAgent] presetRules length: ${this.presetRules?.length || 0}`);
    const visionInstruction = `\n\n[Vision Capability]\nIf you see image references (e.g. @uploads/image.png) and need to analyze their content, use the 'vision_analyze' tool. Do NOT use 'read_file' for images.\n\n[Office Operations]\nYou have a direct tool 'officecli' for PowerPoint, Word, and Excel operations. ALWAYS use this tool instead of 'run_shell_command' for any officecli commands. The tool takes a 'command' string (e.g. 'view slides.pptx text') and optional 'file', 'path', 'args', 'flags' parameters.`;
    const currentMemory = this.config.getUserMemory();

    let rulesSection = '';
    if (this.presetRules) {
      rulesSection = `[Assistant System Rules]\n${this.presetRules}${visionInstruction}`;
      console.log(`[GeminiAgent] Injected presetRules and visionInstruction into userMemory`);
    } else {
      rulesSection = `[Assistant System Rules]${visionInstruction}`;
      console.log(`[GeminiAgent] Injected visionInstruction into userMemory`);
    }

    const combined = currentMemory ? `${rulesSection}\n\n${currentMemory}` : rulesSection;
    this.config.setUserMemory(combined);

    // Note: Skills (技能定义) are prepended to the first message in send() method
    // Skills provide capabilities/tools descriptions, injected at runtime
    // 注意：Skills 在 send() 方法中 prepend 到第一条消息
    // Skills 提供能力/工具描述，在运行时注入

    // 注册对话级别的自定义工具
    await this.toolConfig.registerCustomTools(this.config, this.geminiClient);

    this.initToolScheduler(settings);
  }

  // 初始化调度工具
  private initToolScheduler(_settings: Settings) {
    this.scheduler = new CoreToolScheduler({
      onAllToolCallsComplete: async (completedToolCalls: CompletedToolCall[]) => {
        await Promise.resolve(); // Satisfy async requirement
        try {
          if (completedToolCalls.length > 0) {
            const refreshMemory = async () => {
              // 直接使用 aioncli-core 提供的 refreshServerHierarchicalMemory
              // Directly use refreshServerHierarchicalMemory from aioncli-core
              // 它会自动从 config 获取 ExtensionLoader 并更新 memory
              // It automatically gets ExtensionLoader from config and updates memory
              await refreshServerHierarchicalMemory(this.config);
            };
            const response = handleCompletedTools(completedToolCalls, this.geminiClient, refreshMemory);
            if (response.length > 0) {
              const geminiTools = completedToolCalls.filter((tc) => {
                const isTerminalState = tc.status === 'success' || tc.status === 'error' || tc.status === 'cancelled';

                if (isTerminalState) {
                  const completedOrCancelledCall = tc;
                  return (
                    completedOrCancelledCall.response?.responseParts !== undefined && !tc.request.isClientInitiated
                  );
                }
                return false;
              });

              this.submitQuery(response, this.activeMsgId ?? uuid(), this.createAbortController(), {
                isContinuation: true,
                prompt_id: geminiTools[0].request.prompt_id,
              });
            }
          }
        } catch (e) {
          this.onStreamEvent({
            type: 'error',
            data: 'handleCompletedTools error: ' + (e.message || JSON.stringify(e)),
            msg_id: this.activeMsgId ?? uuid(),
          });
        }
      },
      onToolCallsUpdate: (updatedCoreToolCalls: ToolCall[]) => {
        try {
          const prevTrackedCalls = this.trackedCalls || [];
          const toolCalls: TrackedToolCall[] = (updatedCoreToolCalls || []).map((coreTc) => {
            const existingTrackedCall = prevTrackedCalls.find((ptc) => ptc.request.callId === coreTc.request.callId);
            const newTrackedCall: TrackedToolCall = {
              ...coreTc,
              responseSubmittedToGemini: existingTrackedCall?.responseSubmittedToGemini ?? false,
            };
            return newTrackedCall;
          });
          const display = mapToDisplay(toolCalls);
          this.onStreamEvent({
            type: 'tool_group',
            data: display.tools,
            msg_id: this.activeMsgId ?? uuid(),
          });
        } catch (e) {
          this.onStreamEvent({
            type: 'error',
            data: 'tool_calls_update error: ' + (e.message || JSON.stringify(e)),
            msg_id: this.activeMsgId ?? uuid(),
          });
        }
      },
      // onEditorClose 回调在 aioncli-core v0.18.4 中已移除 / callback was removed in aioncli-core v0.18.4
      // approvalMode: this.config.getApprovalMode(),
      getPreferredEditor() {
        return 'vscode';
      },
      config: this.config,
    });
  }

  /**
   * 处理消息流（带弹性监控）
   * Handle message stream with resilience monitoring
   *
   * InvalidStream retry is handled by aioncli-core (geminiChat.ts streamWithRetries
   * + client.ts "Please continue." mechanism). Forjinn-Desk does NOT retry at this layer
   * to avoid redundant classifier-router calls and quota amplification.
   */
  private handleMessage(
    stream: AsyncGenerator<ServerGeminiStreamEvent, Turn, unknown>,
    msg_id: string,
    abortController: AbortController
  ): Promise<void> {
    const toolCallRequests: ToolCallRequestInfo[] = [];
    let heartbeatWarned = false;

    // 流连接事件处理
    // Stream connection event handler
    const onConnectionEvent = (event: StreamConnectionEvent) => {
      if (event.type === 'heartbeat_timeout') {
        console.warn(`[GeminiAgent] Stream heartbeat timeout at ${new Date(event.lastEventTime).toISOString()}`);
        if (!heartbeatWarned) {
          heartbeatWarned = true;
        }
      } else if (event.type === 'state_change' && event.state === 'failed') {
        console.error(`[GeminiAgent] Stream connection failed: ${event.reason}`);
        this.onStreamEvent({
          type: 'error',
          data: `Connection lost: ${event.reason}. Please try again.`,
          msg_id: uuid(),
        });
      }
    };

    return processGeminiStreamEvents(
      stream,
      this.config,
      (data) => {
        if (data.type === 'tool_call_request') {
          const toolRequest = data.data as ToolCallRequestInfo;
          toolCallRequests.push(toolRequest);
          globalToolCallGuard.protect(toolRequest.callId);
          return;
        }

        const ServerGeminiEventType = GeminiEventType;
        if (data.type === ServerGeminiEventType.ContextWindowWillOverflow) {
          this.handleContextOverflow(data.data);
          return;
        }

        // InvalidStream is surfaced as an error to the user.
        // Core layer (geminiChat.ts + client.ts) already handles retry internally.
        if (data.type === ('invalid_stream' as string)) {
          const eventData = data.data as { message: string; retryable: boolean };
          this.onStreamEvent({
            type: 'error',
            data: eventData.message || 'Invalid response stream detected. Please try again.',
            msg_id: uuid(),
          });
          return;
        }

        // Use a fresh msg_id for error events so error/tips messages don't
        // replace already-streamed content that shares the original msg_id.
        this.onStreamEvent({
          ...data,
          msg_id: data.type === 'error' ? uuid() : msg_id,
        });
      },
      { onConnectionEvent }
    )
      .then(async () => {
        if (toolCallRequests.length > 0) {
          // Emit preview_open for navigation tools, but don't block execution
          // 对导航工具发送 preview_open 事件，但不阻止执行
          // Agent needs chrome-devtools to fetch web page content
          // Agent 需要 chrome-devtools 来获取网页内容
          this.emitPreviewForNavigationTools(toolCallRequests, msg_id);

          // Schedule ALL tool requests including chrome-devtools
          // 调度所有工具请求，包括 chrome-devtools
          await this.scheduler.schedule(toolCallRequests, abortController.signal);
        } else {
          // Agentic loop finished (no pending tool calls).
          // Compact large functionResponse entries in history to prevent
          // context window overflow on subsequent turns.
          if (this.geminiClient) {
            compactToolResponsesInHistory(this.geminiClient);
          }
        }
      })
      .catch((e: unknown) => {
        const rawMessage = e instanceof Error ? e.message : JSON.stringify(e);
        const errorMessage = this.enrichErrorMessage(rawMessage);
        // 清理受保护的工具调用
        // Clean up protected tool calls on error
        for (const req of toolCallRequests) {
          globalToolCallGuard.unprotect(req.callId);
        }
        // Use a fresh msg_id so the error message does not replace
        // already-streamed content that shares the same msg_id.
        this.onStreamEvent({
          type: 'error',
          data: errorMessage,
          msg_id: uuid(),
        });
      });
  }

  /**
   * 检查是否为导航工具调用（支持带MCP前缀和不带前缀的工具名）
   * Check if it's a navigation tool call (supports both with and without MCP prefix)
   *
   * Delegates to NavigationInterceptor for unified logic
   */
  private isNavigationTool(toolName: string): boolean {
    return NavigationInterceptor.isNavigationTool(toolName);
  }

  /**
   * Emit preview_open events for navigation tools without blocking execution
   * 对导航工具发送 preview_open 事件，但不阻止执行
   *
   * Agent needs chrome-devtools to fetch web page content, so we only emit
   * preview events to show URL in preview panel, while letting tools execute normally.
   * Agent 需要 chrome-devtools 来获取网页内容，所以我们只发送预览事件在预览面板中显示 URL，
   * 同时让工具正常执行。
   */
  private emitPreviewForNavigationTools(toolCallRequests: ToolCallRequestInfo[], _msg_id: string): void {
    for (const request of toolCallRequests) {
      const toolName = request.name || '';

      if (this.isNavigationTool(toolName)) {
        const args = request.args || {};
        const url = NavigationInterceptor.extractUrl({ arguments: args as Record<string, unknown> });
        if (url) {
          // Emit preview_open event to show URL in preview panel
          // 发送 preview_open 事件在预览面板中显示 URL
          this.onStreamEvent({
            type: 'preview_open',
            data: {
              content: url,
              contentType: 'url',
              metadata: {
                title: url,
              },
            },
            msg_id: uuid(),
          });
        }
      }
    }
  }

  submitQuery(
    query: unknown,
    msg_id: string,
    abortController: AbortController,
    options?: {
      prompt_id?: string;
      isContinuation?: boolean;
    }
  ): string | undefined {
    this.lastQuery = query;
    this.lastOptions = options;
    try {
      this.activeMsgId = msg_id;
      let prompt_id = options?.prompt_id;
      if (!prompt_id) {
        prompt_id = this.config.getSessionId() + '########' + getPromptCount();
      }
      if (!options?.isContinuation) {
        startNewPrompt();
      }

      const stream = this.geminiClient.sendMessageStream(query, abortController.signal, prompt_id);

      // Send start event immediately when stream is created
      // 流创建后立即发送 start 事件，确保 UI 显示停止按钮
      this.onStreamEvent({ type: 'start', data: '', msg_id });

      this.handleMessage(stream, msg_id, abortController)
        .catch((e: unknown) => {
          const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
          this.onStreamEvent({
            type: 'error',
            data: errorMessage,
            msg_id: uuid(),
          });
        })
        .finally(() => {
          this.onStreamEvent({
            type: 'finish',
            data: '',
            msg_id,
          });
        });
      return '';
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : JSON.stringify(e);
      const errorMessage = this.enrichErrorMessage(rawMessage);
      this.onStreamEvent({
        type: 'error',
        data: errorMessage,
        msg_id: uuid(),
      });
    }
  }

  async send(message: string | Array<{ text: string }>, msg_id = '', files?: string[]) {
    try {
      await this.bootstrap;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.onStreamEvent({ type: 'error', data: errorMessage, msg_id });
      this.onStreamEvent({ type: 'finish', data: null, msg_id });
      return;
    }
    const abortController = this.createAbortController();

    const stripFilesMarker = (text: string): string => {
      const markerIndex = text.indexOf(FORJINN_DESK_FILES_MARKER);
      if (markerIndex === -1) return text;
      return text.slice(0, markerIndex).trimEnd();
    };

    if (Array.isArray(message)) {
      if (message[0]?.text) {
        message[0].text = stripFilesMarker(message[0].text);
      }
    } else if (typeof message === 'string') {
      message = stripFilesMarker(message);
    }

    // 将 files 参数中的文件路径作为 @ 引用添加到消息末尾
    // Append files from files parameter as @ references to the message
    const imageParts: any[] = [];
    if (files && files.length > 0) {
      const fs = require('fs');
      const path = require('path');

      const filesToAppend: string[] = [];

      for (const filePath of files) {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(this.workspace || process.cwd(), filePath);
        let shouldAppend = true;

        if (fs.existsSync(absolutePath)) {
          const ext = path.extname(absolutePath).toLowerCase();
          const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);

          if (isImage) {
            try {
              const base64Data = fs.readFileSync(absolutePath, 'base64');
              const mimeType = ext === '.jpg' ? 'image/jpeg' : `image/${ext.replace('.', '')}`;

              const isGoogleModel =
                this.model.platform === 'gemini' ||
                this.model.platform === 'vertex-ai' ||
                this.model.platform === 'gemini-with-google-auth';

              if (isGoogleModel) {
                imageParts.push({
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                });
              } else {
                // OpenAI format for non-Google models (like qwen3-max)
                imageParts.push({
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                } as any);
              }
              // We keep shouldAppend = true so the @path is added to the query text,
              // but we'll skip the summarization logic below for images.
            } catch (e) {
              console.error(`[GeminiAgent] Failed to read image file ${filePath}:`, e);
            }
          }

          const stats = fs.statSync(absolutePath);
          if (!isImage && stats.size > 1 * 1024 * 1024) {
            this.onStreamEvent({
              type: 'text',
              data: `\n\n*File ${path.basename(filePath)} is large. Running auto-summarization...*\n\n`,
              msg_id: uuid(),
            });

            let content = '';
            if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html'].includes(ext)) {
              content = fs.readFileSync(absolutePath, 'utf8');
            } else {
              try {
                content = await new Promise((resolve, reject) => {
                  officeparser.parseOffice(absolutePath, (data: any, err: any) => {
                    if (err) reject(err);
                    else resolve(data);
                  });
                });
              } catch (e) {
                console.error(`[GeminiAgent] Failed to parse office file ${filePath}:`, e);
              }
            }

            if (content) {
              const result = await summarizationService.summarizeFile(absolutePath, content);
              if (result.success && result.summary) {
                const summaryText = `\n\n[Auto-Summary of ${path.basename(filePath)}]:\n${result.summary}\n\n`;
                if (Array.isArray(message)) {
                  if (message[0]?.text) message[0].text += summaryText;
                } else if (typeof message === 'string') {
                  message += summaryText;
                }
                shouldAppend = false;
              }
            }
          }
        }

        if (shouldAppend) {
          filesToAppend.push(filePath);
        }
      }

      // Force save to workspace for multimodal requests so tools can access files if needed
      // This fixes ENOENT when model tries to read an image file from a temp folder outside workspace
      if (imageParts.length > 0) {
        await ProcessConfig.set('upload.saveToWorkspace', true).catch(() => {});
      }

      files = filesToAppend;
    }

    if (files && files.length > 0) {
      const fileRefs = files.map((filePath) => `@${filePath}`).join(' ');
      if (Array.isArray(message)) {
        if (message[0]?.text) {
          message[0].text = `${message[0].text} ${fileRefs}`;
        }
      } else if (typeof message === 'string') {
        message = `${message} ${fileRefs}`;
      }
    }

    // OAuth Token 预检查（仅对 OAuth 模式生效）
    // Preemptive OAuth Token check (only for OAuth mode)
    if (this.authType === AuthType.LOGIN_WITH_GOOGLE) {
      try {
        const tokenManager = getGlobalTokenManager(this.authType);
        const isTokenValid = await tokenManager.checkAndRefreshIfNeeded();
        if (!isTokenValid) {
          console.warn('[GeminiAgent] OAuth token validation failed, proceeding anyway');
        }
      } catch (tokenError) {
        console.warn('[GeminiAgent] OAuth token check error:', tokenError);
        // 继续执行，让后续流程处理认证错误
      }
    }

    // Prepend one-time history prefix before processing commands
    if (this.historyPrefix && !this.historyUsedOnce) {
      if (Array.isArray(message)) {
        const first = message[0];
        const original = first?.text ?? '';
        message = [{ text: `${this.historyPrefix}${original}` }];
      } else if (typeof message === 'string') {
        message = `${this.historyPrefix}${message}`;
      }
      this.historyUsedOnce = true;
    }

    // Skills 通过 SkillManager 加载，索引已在系统指令中
    // Skills are loaded via SkillManager, index is already in system instruction
    let skillsPrefix = '';

    if (!this.skillsIndexPrependedOnce) {
      let rulesContent = this.presetRules || this.contextContent || '';

      // Dynamically inject attached agents guide without hardcoding
      try {
        const attachedConfigs = attachedAgentService.getAllConfigs();
        if (attachedConfigs && attachedConfigs.length > 0) {
          let agentGuide = '\n\n[Available Attached Agents]\n';
          agentGuide +=
            'You can call the following attached agents directly or use their specialized capabilities. Use the list to refer to available agent names:\n';
          for (const agent of attachedConfigs) {
            if (agent.enabled) {
              agentGuide += `- \`${agent.id}\`: ${agent.description} (Type: ${agent.type})\n`;
            }
          }
          agentGuide +=
            '\nTo inspect or execute tools from these attached agents, use the `list_external_tools()` and `execute_external_tool()` capabilities.';
          rulesContent += agentGuide;
        }
      } catch (e) {
        console.warn('[GeminiAgent] Failed to inject attached agents into prompt:', e);
      }

      if (rulesContent) {
        skillsPrefix = `[Assistant Rules - You MUST follow these instructions]\n${rulesContent}\n\n`;
      }
      this.skillsIndexPrependedOnce = true;

      // 注入前缀到消息 / Inject prefix into message
      if (skillsPrefix) {
        const prefix = skillsPrefix + '[User Request]\n';
        if (Array.isArray(message)) {
          if (message[0]) message[0].text = prefix + message[0].text;
        } else {
          message = prefix + message;
        }
      }
    }

    const rawQuery = Array.isArray(message) ? message[0].text : message;
    const queryTrimmed = typeof rawQuery === 'string' ? rawQuery.trim() : '';
    let matchedAgent = null;

    try {
      const agents = DEFAULT_ATTACHED_AGENTS;
      for (const agent of agents) {
        const prefix = `@${agent.id}`;
        if (queryTrimmed.startsWith(prefix)) {
          matchedAgent = agent;
          break;
        }
      }
    } catch (e) {
      console.warn('[GeminiAgent] Failed to parse attached agents:', e);
    }

    if (matchedAgent) {
      const prefix = `@${matchedAgent.id}`;
      const instruction = queryTrimmed.substring(prefix.length).trim();

      this.onStreamEvent({ type: 'start', data: '', msg_id });
      this.onStreamEvent({
        type: 'text',
        data: `#### Direct Dispatch to **${matchedAgent.name}**\n\n`,
        msg_id,
      });

      try {
        const result = await attachedAgentService.executeTask({
          agentId: matchedAgent.id,
          taskId: `direct_${Date.now()}`,
          instruction: instruction,
        });

        if (result.success) {
          this.onStreamEvent({ type: 'text', data: result.result || 'Task completed successfully.', msg_id });
        } else {
          this.onStreamEvent({ type: 'error', data: `Agent execution failed: ${result.error}`, msg_id });
        }
      } catch (e: any) {
        this.onStreamEvent({ type: 'error', data: `Failed to execute agent: ${e.message}`, msg_id });
      }

      this.onStreamEvent({ type: 'finish', data: '', msg_id });
      return;
    }

    // Track error messages from @ command processing
    let atCommandError: string | null = null;

    const { processedQuery, shouldProceed } = await handleAtCommand({
      query: Array.isArray(message) ? message[0].text : message,
      config: this.config,
      addItem: (item: unknown) => {
        // Capture error messages from @ command processing
        if (item && typeof item === 'object' && 'type' in item) {
          const typedItem = item as { type: string; text?: string };
          if (typedItem.type === 'error' && typedItem.text) {
            atCommandError = typedItem.text;
          }
        }
      },
      onDebugMessage() {
        // 调试回调留空以避免日志噪声 / Debug hook intentionally left blank to avoid noisy logging
      },
      messageId: Date.now(),
      signal: abortController.signal,
      // 有 files 时启用懒加载：不立即读取文件内容
      // Enable lazy loading only when files are provided
      lazyFileLoading: !!(files && files.length > 0),
    });

    if (!shouldProceed || processedQuery === null || abortController.signal.aborted) {
      // Send error message to user if @ command processing failed
      // 如果 @ 命令处理失败，向用户发送错误消息
      if (atCommandError) {
        this.onStreamEvent({
          type: 'error',
          data: atCommandError,
          msg_id,
        });
      } else if (!abortController.signal.aborted) {
        // Generic error if we don't have specific error message
        this.onStreamEvent({
          type: 'error',
          data: 'Failed to process @ file reference. The file may not exist or is not accessible.',
          msg_id,
        });
      }
      // Send finish event so UI can reset state
      this.onStreamEvent({
        type: 'finish',
        data: null,
        msg_id,
      });
      return;
    }
    let finalQuery: any = processedQuery;
    if (imageParts.length > 0) {
      if (typeof finalQuery === 'string') {
        finalQuery = [{ text: finalQuery }, ...imageParts];
      } else if (Array.isArray(finalQuery)) {
        // Ensure existing parts are in Gemini format (text instead of {type: 'text', text: ...})
        const normalizedParts = finalQuery.map((part: any) => {
          if (part && typeof part === 'object' && part.type === 'text' && 'text' in part) {
            return { text: part.text };
          }
          // If it's already in {text: ...} or {inlineData: ...} format, keep it
          return part;
        });
        finalQuery = [...normalizedParts, ...imageParts];
      }
    }
    const requestId = this.submitQuery(finalQuery, msg_id, abortController);
    return requestId;
  }
  stop(): void {
    this.abortController?.abort();
  }

  setYoloMode(yoloMode: boolean): void {
    this.yoloMode = yoloMode;
    console.log(`[GeminiAgent] YOLO mode set to: ${yoloMode}`);
  }

  private async handleContextOverflow(overflowData: any) {
    console.log('[GeminiAgent] Context window will overflow, auto-triggering summarization...');
    this.onStreamEvent({
      type: 'text',
      data: '\n\n*Context window overflow detected. Running auto-summarization to free up space...*\n\n',
      msg_id: uuid(),
    });

    const historyText = this.convertHistoryToText();

    const result = await summarizationService.summarizeText(historyText);

    if (result.success && result.summary) {
      console.log('[GeminiAgent] Summarization successful, replacing history...');
      this.onStreamEvent({
        type: 'text',
        data: '\n\n*Summarization complete. Resuming conversation with compressed context.*\n\n',
        msg_id: uuid(),
      });

      if (this.geminiClient) {
        this.geminiClient.setHistory([
          {
            role: 'user',
            parts: [
              { text: `Here is a summary of the conversation so far to fit the context window:\n\n${result.summary}` },
            ],
          },
          {
            role: 'model',
            parts: [{ text: 'Understood. I will continue the conversation based on this summary.' }],
          },
        ]);
      }

      console.log('[GeminiAgent] Retrying request...');
      if (this.lastQuery) {
        this.submitQuery(this.lastQuery, this.activeMsgId ?? uuid(), this.createAbortController(), this.lastOptions);
      }
    } else {
      console.error('[GeminiAgent] Summarization failed:', result.error);
      this.onStreamEvent({
        type: 'error',
        data: `Context window overflow occurred and auto-summarization failed. ${result.error || ''}`,
        msg_id: uuid(),
      });
    }
  }

  private convertHistoryToText(): string {
    if (!this.geminiClient) return '';
    const history = this.geminiClient.getHistory();
    let text = '';
    for (const content of history) {
      const role = content.role === 'user' ? 'User' : 'Assistant';
      text += `${role}:\n`;
      if (content.parts) {
        for (const part of content.parts) {
          if ((part as any).text) {
            text += `${(part as any).text}\n`;
          } else if ((part as any).functionCall) {
            text += `[Called Tool: ${(part as any).functionCall.name}]\n`;
          } else if ((part as any).functionResponse) {
            text += `[Tool Result: ${(part as any).functionResponse.name}]\n`;
          }
        }
      }
      text += '\n';
    }
    return text;
  }

  async injectConversationHistory(text: string): Promise<void> {
    try {
      if (!this.config || !this.workspace || !this.settings) return;
      if (this.geminiClient) {
        await this.geminiClient.resetChat();
      }

      // Prepare one-time prefix for first outgoing message after (re)start
      this.historyPrefix = `Conversation history (recent):\n${text}\n\n`;
      this.historyUsedOnce = false;
      this.skillsIndexPrependedOnce = false;
      // 使用 refreshServerHierarchicalMemory 刷新 memory，然后追加聊天历史
      // Use refreshServerHierarchicalMemory to refresh memory, then append chat history
      const { memoryContent } = await refreshServerHierarchicalMemory(this.config);
      const combined = `${memoryContent}\n\n[Recent Chat]\n${text}`;
      this.config.setUserMemory(combined);
    } catch (e) {
      // ignore injection errors
    }
  }

  /**
   * Manually confirm/resume a pending tool call.
   * This ensures we are interacting with the REAL tool objects in the scheduler.
   */
  async confirmTool(callId: string, outcome: string, payload?: any): Promise<void> {
    if (!this.scheduler) return;

    // CoreToolScheduler stores active tool calls in its internal state.
    // We need to find the one matching callId.
    const toolCalls = (this.scheduler as any).toolCalls as any[];
    if (!toolCalls) {
      console.warn(`[GeminiAgent] Scheduler has no active tool calls to confirm for ${callId}`);
      return;
    }

    const tool = toolCalls.find((tc: any) => tc.request.callId === callId);
    if (tool && tool.confirmationDetails?.onConfirm) {
      try {
        // LIBRARY BUG BYPASS: CoreToolScheduler.handleConfirmationResponse (v0.30.6) 
        // fails to pass the 'payload' argument to the original onConfirm callback.
        // We must manually populate the invocation state for AskUser tools.
        if (tool.request.name === 'ask_user' && tool.invocation) {
          const answers = (payload && typeof payload === 'object' && 'answers' in payload) 
            ? payload.answers 
            : (payload || {});
          
          tool.invocation.confirmationOutcome = outcome === 'proceed_once' ? 'proceed' : outcome;
          tool.invocation.userAnswers = answers;
        }

        // Now trigger the scheduler's confirmation handler to advance the tool state
        await tool.confirmationDetails.onConfirm(outcome, payload);
      } catch (e) {
        console.error(`[GeminiAgent] Error in tool.onConfirm for ${callId}:`, e);
      }
    } else {
      console.warn(
        `[GeminiAgent] Could not find pending tool with onConfirm for ${callId}. ` +
        `Available IDs: ${toolCalls.map((tc: any) => tc.request.callId).join(', ')}`
      );
    }
  }
}

/**
 * Get current GeminiAgent instance (used by flashFallbackHandler)
 */
export function getCurrentGeminiAgent(): GeminiAgent | null {
  return currentGeminiAgent;
}
