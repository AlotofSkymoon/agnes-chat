export type AttachmentKind = "text" | "image" | "video" | "file";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
  /** 文本文件：抽取出的正文；图片：data URL */
  content?: string;
  /** 读取失败或被跳过的提示 */
  note?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  /** 出错时的标记，用于渲染重试按钮 */
  error?: string;
  /** 用户随消息一起发送的附件 */
  attachments?: Attachment[];
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ----------------------------- 附件工具 ----------------------------- */

/**
 * 浏览器「本地读取」的大小上限。
 *
 * ⚠️ 这只限制「是否把文件内容读进浏览器内存」，
 *    不限制上传到对象存储的文件大小 —— 图片/视频走 R2 预签名直传时，
 *    文件根本不经过浏览器转 base64，多大的文件都能传（R2 单次 PUT 上限 5 GB）。
 *
 * 未配置对象存储时才会走本地读取，此时才受这里的限制。
 * 按类型区分：文本文件本来就该进上下文，给足额度；
 * 图片走 base64 会膨胀约 33%，保守一些。
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB（普通文件）
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB（图片本地读取）
export const MAX_TEXT_SIZE = 5 * 1024 * 1024; // 5 MB（文本抽正文，再大就截断）
export const MAX_FILES = 5;

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "json", "jsonl", "csv", "tsv", "log", "xml", "yaml", "yml",
  "toml", "ini", "conf", "env", "sh", "bash", "zsh", "sql", "html", "htm", "css", "scss",
  "less", "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt",
  "swift", "c", "h", "cpp", "hpp", "cs", "php", "pl", "lua", "r", "scala", "vue", "svelte",
  "dart", "gradle", "dockerfile", "makefile", "gitignore", "lock", "properties", "bat", "ps1",
]);

const TEXT_MIME = new Set([
  "text/plain", "text/markdown", "application/json", "text/csv", "application/xml",
  "text/xml", "application/x-yaml", "text/yaml", "application/javascript",
  "application/typescript", "text/x-python", "text/x-go", "text/x-c", "text/x-java",
]);

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function isTextFile(file: File): boolean {
  if (file.type && TEXT_MIME.has(file.type)) return true;
  if (file.type === "") return TEXT_EXT.has(extOf(file.name));
  return TEXT_EXT.has(extOf(file.name));
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return ["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(extOf(file.name));
}

/** 人类可读的体积 */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 读取文件 → Attachment（文本抽正文，图片转 data URL，其余只留元信息） */
export async function readFileToAttachment(file: File): Promise<Attachment> {
  const base: Attachment = {
    id: createId(),
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
    kind: "file",
  };

  // 超过本地读取上限：不读内容，但文件仍在附件列表里。
  // 真正能传大文件的路径是「配置对象存储 → 预签名直传」，
  // 所以这里把用户往那个方向引导，而不是简单说"太大了"。
  if (file.size > MAX_FILE_SIZE) {
    return {
      ...base,
      note: `${file.name} 超过 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB，未读取内容。如需上传大文件，请在设置里配置对象存储（Cloudflare R2）`,
    };
  }

  try {
    if (isImageFile(file)) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("read error"));
        fr.readAsDataURL(file);
      });
      return { ...base, kind: "image", content: dataUrl };
    }

    if (isTextFile(file)) {
      const text = await file.text();
      const clipped = text.length > 100_000 ? text.slice(0, 100_000) : text;
      return {
        ...base,
        kind: "text",
        content: clipped,
        note: text.length > 100_000 ? "内容过长，只取前 100000 字符" : undefined,
      };
    }

    if (isVideoFile(file)) {
      return { ...base, kind: "video", note: "未配置对象存储，视频未上传" };
    }

    return { ...base, kind: "file", note: "暂不支持解析该类型，仅记录文件名" };
  } catch {
    return { ...base, note: "读取失败" };
  }
}

/** 站点级配置（仅管理员可改，全站生效） */
export interface SiteSettings {
  /** 全站默认 Base URL，留空则用内置地址 */
  defaultBaseUrl: string;
  /** 全站默认模型，留空则用内置默认 */
  defaultModel: string;
  /** 是否默认开启「保存聊天记录到云端」 */
  cloudSaveDefault: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  defaultBaseUrl: "",
  defaultModel: "",
  cloudSaveDefault: false,
};
