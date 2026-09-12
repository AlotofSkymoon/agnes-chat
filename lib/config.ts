/** 支持的模型服务商 */
export type ProviderId = "agnes" | "deepseek";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** 默认 API Base URL（OpenAI 兼容） */
  baseUrl: string;
  /** 站点是否内置了该服务商的 Key（Agnes 有，DeepSeek 没有，需用户自备） */
  hasPreset: boolean;
  /** 申请 Key 的地址 */
  keyUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  agnes: {
    id: "agnes",
    label: "Agnes AI",
    baseUrl: "https://apihub.agnes-ai.com/v1",
    hasPreset: true,
    keyUrl: "https://platform.agnes-ai.com/",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    hasPreset: false,
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
};

export interface ModelOption {
  id: string;
  label: string;
  desc: string;
  provider: ProviderId;
  /** 是否支持图片输入（vision-language） */
  vision: boolean;
}

/** 可选模型（纯聊天，不含 Agent / 工具调用） */
export const CHAT_MODELS: ModelOption[] = [
  {
    id: "agnes-2.5-flash",
    label: "agnes-2.5-flash",
    desc: "更快，日常聊天首选，支持识图",
    provider: "agnes",
    vision: true,
  },
  {
    id: "agnes-2.0-flash",
    label: "agnes-2.0-flash",
    desc: "稳定版，支持识图",
    provider: "agnes",
    vision: true,
  },
  {
    id: "deepseek-chat",
    label: "deepseek-chat",
    desc: "DeepSeek V3 · 通用对话",
    provider: "deepseek",
    vision: false,
  },
  {
    id: "deepseek-reasoner",
    label: "deepseek-reasoner",
    desc: "DeepSeek R1 · 深度推理",
    provider: "deepseek",
    vision: false,
  },
];

/** 兼容旧引用的 Agnes 模型列表 */
export const AGNES_MODELS = CHAT_MODELS.filter((m) => m.provider === "agnes");

export const DEFAULT_MODEL = "agnes-2.5-flash";

export const DEFAULT_BASE_URL = PROVIDERS.agnes.baseUrl;

export const AGENT_TIP = "仅聊天模式。需要 Agent 功能请去 AgentScope 添加 Agnes API Key。";

export function getModel(modelId: string): ModelOption | undefined {
  return CHAT_MODELS.find((m) => m.id === modelId);
}

export function isAllowedModel(modelId: string): boolean {
  return CHAT_MODELS.some((m) => m.id === modelId);
}

export function getProvider(modelId: string): ProviderId {
  return getModel(modelId)?.provider ?? "agnes";
}

/** 该模型是否支持图片输入 */
export function supportsVision(modelId: string): boolean {
  return getModel(modelId)?.vision ?? false;
}

/* ---------------------------- localStorage Keys ---------------------------- */

export const LS_KEYS = {
  // 各服务商的 Key 分开存
  keys: "agnes:keys", // JSON: { agnes?: string; deepseek?: string }
  apiKey: "agnes:apiKey",
  baseUrl: "agnes:baseUrl",
  model: "agnes:model",
  messages: "agnes:messages",
  conversationId: "agnes:conversationId",
  theme: "agnes:theme",
  cloudSync: "agnes:cloudSync",
  sidebarCollapsed: "agnes:sidebarCollapsed",
  s3: "agnes:s3",
} as const;
