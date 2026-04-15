/**
 * @module llmProviders
 * @ai_context
 * 定义 GoodPhoto 支持的所有 LLM 提供商及其默认配置。
 * 所有提供商均须支持视觉多模态（Vision/Multimodal）能力，
 * 因为本应用的核心功能是照片 AI 分析评分。
 *
 * 数据结构说明：
 * - LLM_PROVIDER_OPTIONS: 全部提供商的静态配置清单（含可选预设模型列表）
 * - models: 当提供商有多款主流 Vision 模型时，提供快速选择列表；
 *            用户也可手动填写任意模型名称以使用更新的模型。
 */

import type { LlmConfig, ProviderConfig } from "./types";

export const LLM_PROVIDER_OPTIONS = [
  {
    id: "qwen",
    label: "Qwen (通义千问)",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-vl-max",
    transport: "openai-compatible",
    // 阿里云旗下视觉模型，国内访问速度优秀
    models: ["qwen-vl-max", "qwen-vl-plus", "qwen2.5-vl-72b-instruct"],
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-5.4",
    transport: "openai-compatible",
    // gpt-5.4 为最新旗舰版本；gpt-4o 为成熟稳定 Vision 模型
    models: ["gpt-5.4", "gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-5.4",
    transport: "openai-compatible",
    // OpenRouter 为聚合商，模型名须带前缀 "提供商/模型名"
    models: [
      "openai/gpt-5.4",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-pro-preview",
      "anthropic/claude-3.5-sonnet",
      "meta-llama/llama-4-maverick",
    ],
  },
  {
    id: "siliconflow",
    label: "SiliconFlow (硅基流动)",
    defaultBaseUrl: "https://api.siliconflow.com/v1/chat/completions",
    defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    transport: "openai-compatible",
    models: [
      "Qwen/Qwen2.5-VL-72B-Instruct",
      "Qwen/Qwen2.5-VL-7B-Instruct",
      "Pro/Qwen/Qwen2.5-VL-7B-Instruct",
    ],
  },
  {
    id: "together",
    label: "Together AI",
    defaultBaseUrl: "https://api.together.xyz/v1/chat/completions",
    defaultModel: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
    transport: "openai-compatible",
    models: [
      "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
    ],
  },
  {
    id: "groq",
    label: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    transport: "openai-compatible",
    models: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-2.5-pro-preview-03-25",
    transport: "gemini",
    // Gemini 系列均原生支持多模态视觉
    models: [
      "gemini-2.5-pro-preview-03-25",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1/chat/completions",
    defaultModel: "deepseek-vl2",
    transport: "openai-compatible",
    // DeepSeek-VL2 为国产视觉旗舰，性价比极高
    models: ["deepseek-vl2", "deepseek-vl2-small", "deepseek-vl2-tiny"],
  },
  {
    id: "zhipu",
    label: "智谱 AI (Zhipu / GLM)",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4v-plus",
    transport: "openai-compatible",
    // GLM-4V 系列为智谱旗下视觉模型，中文理解出色
    models: ["glm-4v-plus", "glm-4v", "glm-4v-flash"],
  },
  {
    id: "doubao",
    label: "豆包 (ByteDance Doubao)",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-vision-pro-32k",
    transport: "openai-compatible",
    // 豆包 Vision Pro 为字节旗下多模态旗舰，需在火山引擎控制台创建推理接入点 (endpoint)
    // 注意：baseUrl 可按需改为具体 endpoint URL
    models: ["doubao-vision-pro-32k", "doubao-vision-lite-32k"],
  },
  {
    id: "mistral",
    label: "Mistral AI",
    defaultBaseUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "pixtral-large-latest",
    transport: "openai-compatible",
    // Pixtral 为 Mistral 专属视觉模型，欧洲数据合规优秀
    models: ["pixtral-large-latest", "pixtral-12b-2409"],
  },
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_OPTIONS)[number]["id"];

export const LLM_PROVIDER_IDS = LLM_PROVIDER_OPTIONS.map((option) => option.id) as LlmProviderId[];

/**
 * 取得指定 Provider 的可选预设模型列表。
 * 若该 provider 无预设列表，则回传空阵列（UI 将改用文字输入框）。
 */
export function getProviderModels(provider: LlmProviderId): readonly string[] {
  const option = getProviderOption(provider);
  // 因为 models 字段为 optional，安全取值避免 runtime error
  return "models" in option ? (option.models as readonly string[]) : [];
}

const DEFAULT_STABILITY_PROVIDER: ProviderConfig = {
  apiKey: "",
  baseUrl: "https://api.stability.ai/v2beta/stable-image/edit/erase",
  model: "erase",
};

export function isLlmProviderId(value: unknown): value is LlmProviderId {
  return typeof value === "string" && LLM_PROVIDER_IDS.includes(value as LlmProviderId);
}

export function getProviderOption(provider: LlmProviderId) {
  return LLM_PROVIDER_OPTIONS.find((option) => option.id === provider)!;
}

export function isGeminiProvider(provider: LlmProviderId): boolean {
  return getProviderOption(provider).transport === "gemini";
}

export function isOpenAiCompatibleProvider(provider: LlmProviderId): boolean {
  return getProviderOption(provider).transport === "openai-compatible";
}

export function usesSmallBatchWindow(provider: LlmProviderId): boolean {
  // 以下 provider 的 API 对单次请求的 token 窗口较小，须使用分批策略
  return ["openai", "openrouter", "siliconflow", "together", "groq", "deepseek", "zhipu", "doubao", "mistral"].includes(provider);
}

export function usesOpenAiRateLimitStrategy(provider: LlmProviderId): boolean {
  // 只有 OpenAI 官方有严格的 RPM（每分钟请求数）限制策略
  return provider === "openai";
}

export function createDefaultLlmConfig(): LlmConfig {
  const providers = Object.fromEntries(
    LLM_PROVIDER_OPTIONS.map((option) => [
      option.id,
      {
        apiKey: "",
        baseUrl: option.defaultBaseUrl,
        model: option.defaultModel,
      },
    ]),
  ) as Record<LlmProviderId, ProviderConfig>;

  return {
    activeProvider: "qwen",
    providers: {
      ...providers,
      stability: { ...DEFAULT_STABILITY_PROVIDER },
    },
  };
}

function mergeProviderConfig(
  baseConfig: ProviderConfig,
  maybeConfig: unknown,
): ProviderConfig {
  if (!maybeConfig || typeof maybeConfig !== "object") {
    return { ...baseConfig };
  }

  const candidate = maybeConfig as Partial<ProviderConfig>;

  return {
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey : baseConfig.apiKey,
    baseUrl: typeof candidate.baseUrl === "string" ? candidate.baseUrl : baseConfig.baseUrl,
    model: typeof candidate.model === "string" ? candidate.model : baseConfig.model,
  };
}

export function mergeLlmConfigWithDefaults(maybeConfig: unknown): LlmConfig {
  const defaults = createDefaultLlmConfig();

  if (!maybeConfig || typeof maybeConfig !== "object") {
    return defaults;
  }

  const candidate = maybeConfig as Partial<LlmConfig> & {
    providers?: Record<string, unknown>;
  };

  const providers = { ...defaults.providers };

  for (const providerId of LLM_PROVIDER_IDS) {
    providers[providerId] = mergeProviderConfig(
      defaults.providers[providerId],
      candidate.providers?.[providerId],
    );
  }

  providers.stability = mergeProviderConfig(
    defaults.providers.stability,
    candidate.providers?.stability,
  );

  return {
    activeProvider: isLlmProviderId(candidate.activeProvider)
      ? candidate.activeProvider
      : defaults.activeProvider,
    providers,
  };
}

/*
 * [For Future AI]
 * 关键假设：
 * 1. 所有加入的 Provider 均须支持视觉多模态（图片输入），这是 GoodPhoto 的硬性需求。
 * 2. models 字段为可选；没有该字段的 provider 在 UI 层会以自由文字输入框呈现。
 * 3. doubao (豆包) 的 API endpoint 通常为动态分配，用户可能需要在 baseUrl 填入自己的 endpoint。
 *
 * 潜在边界情况：
 * - 新增 provider 后须同步检查 usesSmallBatchWindow() 是否需要纳入。
 * - OpenRouter 的模型名前缀规则（"provider/model"）和其他 provider 不同，需在 UI 提示用户。
 *
 * 依赖模块：
 * - types.ts: LlmConfig, ProviderConfig 类型定义
 * - App.tsx: 消费此文件的所有 export，包含设置 UI 渲染逻辑
 */
