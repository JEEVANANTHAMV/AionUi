/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 模型平台配置模块
 * Model Platform Configuration Module
 *
 * 集中管理所有模型平台的配置信息，便于扩展和维护
 * Centralized management of all model platform configurations for extensibility and maintainability
 */

// Provider Logo imports
import ForjinnLogo from '@/renderer/assets/logos/brand/forjinn.svg';
import GeminiLogo from '@/renderer/assets/logos/ai-major/gemini.svg';
import OpenAILogo from '@/renderer/assets/logos/ai-major/openai.svg';
import AnthropicLogo from '@/renderer/assets/logos/ai-major/anthropic.svg';
import BedrockLogo from '@/renderer/assets/logos/ai-cloud/bedrock.svg';
import DeepSeekLogo from '@/renderer/assets/logos/ai-major/deepseek.svg';
import OpenRouterLogo from '@/renderer/assets/logos/ai-cloud/openrouter.svg';
import SiliconFlowLogo from '@/renderer/assets/logos/ai-cloud/siliconflow.png';
import QwenLogo from '@/renderer/assets/logos/ai-china/qwen.svg';
import KimiLogo from '@/renderer/assets/logos/ai-china/kimi.svg';
import ZhipuLogo from '@/renderer/assets/logos/ai-china/zhipu.svg';
import XaiLogo from '@/renderer/assets/logos/ai-major/xai.svg';
import VolcengineLogo from '@/renderer/assets/logos/ai-china/volcengine.svg';
import BaiduLogo from '@/renderer/assets/logos/ai-china/baidu.svg';
import TencentLogo from '@/renderer/assets/logos/ai-china/tencent.svg';
import LingyiLogo from '@/renderer/assets/logos/ai-china/lingyiwanwu.svg';
import PoeLogo from '@/renderer/assets/logos/ai-cloud/poe.svg';
import ModelScopeLogo from '@/renderer/assets/logos/ai-cloud/modelscope.svg';
import InfiniAILogo from '@/renderer/assets/logos/ai-cloud/infiniai.svg';
import CtyunLogo from '@/renderer/assets/logos/ai-cloud/ctyun.svg';
import StepFunLogo from '@/renderer/assets/logos/ai-china/stepfun.svg';
import MiniMaxLogo from '@/renderer/assets/logos/ai-china/minimax.png';
import NewApiLogo from '@/renderer/assets/logos/ai-cloud/newapi.svg';
import NovitaLogo from '@/renderer/assets/logos/ai-cloud/novita.svg';
import PPIOLogo from '@/renderer/assets/logos/ai-cloud/ppio.svg';

/**
 * 平台类型
 * Platform type
 */
export type PlatformType = 'gemini' | 'gemini-vertex-ai' | 'anthropic' | 'custom' | 'new-api' | 'bedrock';

/**
 * 模型平台配置接口
 * Model Platform Configuration Interface
 */
export interface PlatformConfig {
  /** 平台名称 / Platform name */
  name: string;
  /** 平台值（用于表单） / Platform value (for form) */
  value: string;
  /** Logo 路径 / Logo path */
  logo: string | null;
  /** 平台标识 / Platform identifier */
  platform: PlatformType;
  /** Base URL（预设供应商使用） / Base URL (for preset providers) */
  baseUrl?: string;
  /** 国际化 key（可选，用于需要翻译的平台名称） / i18n key (optional, for platform names that need translation) */
  i18nKey?: string;
}

/**
 * 模型平台选项列表
 * Model Platform options list
 *
 * 顺序：
 * 1. Gemini (官方)
 * 2. Gemini Vertex AI
 * 3. 自定义（需要用户输入 base url）
 * 4+ 预设供应商
 */
export const MODEL_PLATFORMS: PlatformConfig[] = [
  {
    name: 'Innosynth',
    value: 'Innosynth',
    logo: ForjinnLogo,
    platform: 'custom',
    baseUrl: 'http://101.53.140.44:8001/v1',
  },
];

/**
 * New API 协议选项
 * New API protocol options for per-model protocol configuration
 */
export const NEW_API_PROTOCOL_OPTIONS = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'Anthropic', value: 'anthropic' },
];

/**
 * 根据模型名称自动推断 New API 协议类型
 * Auto-detect New API protocol type based on model name
 */
export const detectNewApiProtocol = (modelName: string): string => {
  const name = modelName.toLowerCase();
  if (name.startsWith('claude') || name.startsWith('anthropic')) return 'anthropic';
  if (name.startsWith('gemini') || name.startsWith('models/gemini')) return 'gemini';
  // Default to openai (covers gpt, deepseek, qwen, o1, o3, etc.)
  return 'openai';
};

// ============ 工具函数 / Utility Functions ============

/**
 * 根据 value 获取平台配置
 * Get platform config by value
 */
export const getPlatformByValue = (value: string): PlatformConfig | undefined => {
  return MODEL_PLATFORMS.find((p) => p.value === value);
};

/**
 * 获取所有预设供应商（有 baseUrl 的）
 * Get all preset providers (with baseUrl)
 */
export const getPresetProviders = (): PlatformConfig[] => {
  return MODEL_PLATFORMS.filter((p) => p.baseUrl);
};

/**
 * 获取官方 Gemini 平台
 * Get official Gemini platforms
 */
export const getGeminiPlatforms = (): PlatformConfig[] => {
  return MODEL_PLATFORMS.filter((p) => p.platform === 'gemini' || p.platform === 'gemini-vertex-ai');
};

/**
 * 检查平台是否为 Gemini 类型
 * Check if platform is Gemini type
 */
export const isGeminiPlatform = (platform: PlatformType): boolean => {
  return platform === 'gemini' || platform === 'gemini-vertex-ai';
};

/**
 * 检查是否为自定义选项（无预设 baseUrl）
 * Check if it's custom option (no preset baseUrl)
 */
export const isCustomOption = (value: string): boolean => {
  const platform = getPlatformByValue(value);
  return value === 'custom' && !platform?.baseUrl;
};

// Re-export from common for renderer convenience
export { isNewApiPlatform } from '@/common/utils/platformConstants';

/**
 * 根据名称搜索平台（不区分大小写）
 * Search platforms by name (case-insensitive)
 */
export const searchPlatformsByName = (keyword: string): PlatformConfig[] => {
  const lowerKeyword = keyword.toLowerCase();
  return MODEL_PLATFORMS.filter((p) => p.name.toLowerCase().includes(lowerKeyword));
};
