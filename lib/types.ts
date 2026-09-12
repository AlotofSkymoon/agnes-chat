export type AttachmentKind = "text" | "image" | "file";

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

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
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

  if (file.size > MAX_FILE_SIZE) {
    return { ...base, note: "文件超过 5MB，已跳过内容读取" };
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

    return { ...base, kind: "file", note: "暂不支持解析该类型，仅记录文件名" };
  } catch {
    return { ...base, note: "读取失败" };
  }
}
