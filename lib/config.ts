/** 允许的模型列表（纯聊天，不含 Agent / 工具调用） */
export const AGNES_MODELS = [
  { id: "agnes-2.5-flash", label: "agnes-2.5-flash", desc: "更快，日常聊天首选" },
  { id: "agnes-2.0-flash", label: "agnes-2.0-flash", desc: "稳定版" },
] as const;

export type AgnesModelId = (typeof AGNES_MODELS)[number]["id"];

export const DEFAULT_MODEL: AgnesModelId = "agnes-2.5-flash";

export const DEFAULT_BASE_URL = "https://apihub.agnes-ai.com/v1";

export const AGENT_TIP = "仅聊天模式。需要 Agent 功能请去 AgentScope 添加 Agnes API Key。";

export function isAllowedModel(model: string): boolean {
  return AGNES_MODELS.some((m) => m.id === model);
}

/* ---------------------------- localStorage Keys ---------------------------- */

export const LS_KEYS = {
  apiKey: "agnes:apiKey",
  baseUrl: "agnes:baseUrl",
  model: "agnes:model",
  messages: "agnes:messages",
  conversationId: "agnes:conversationId",
  theme: "agnes:theme",
  cloudSync: "agnes:cloudSync",
} as const;
