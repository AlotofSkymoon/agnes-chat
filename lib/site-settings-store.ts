import { getRedis, getValue, KEYS } from "@/lib/redis";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/types";

/**
 * 站点设置的读写。
 *
 * ⚠️ 这里修的是一个很隐蔽的 bug：存储层 set() 内部会再做一次 JSON.stringify，
 * 而调用方自己也 stringify 了一遍 —— 双重编码。
 *
 *   set(key, JSON.stringify(obj))  → 库里存的是 "\"{\\\"a\\\":1}\""
 *   get(key)                       → 返回**字符串**，不是对象
 *   { ...DEFAULT, ...字符串 }       → 展开成字符索引 {0:'{', 1:'"', ...}
 *
 * 结果就是：管理员明明保存成功，读回来却全是默认值 ——
 * 开关永远是关的，页脚永远是空的，怎么点都没用。
 *
 * 现在统一走这里：写入传对象（正确做法），读取时兼容历史字符串。
 */

/** 把可能是字符串的值还原成对象（历史数据兼容） */
function normalize(raw: unknown): Partial<SiteSettings> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Partial<SiteSettings>;
      }
    } catch {
      /* 不是 JSON，丢弃 */
    }
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Partial<SiteSettings>;
  }
  return {};
}

/** 读取站点设置，字段缺失时回落到默认值 */
export async function readSiteSettings(): Promise<SiteSettings> {
  const raw = await getValue<unknown>(KEYS.siteSettings);
  return { ...DEFAULT_SITE_SETTINGS, ...normalize(raw) };
}

/**
 * 写入站点设置。
 *
 * 注意：这里传**对象**给 set()，不要再 stringify ——
 * 存储层内部已经会序列化，再包一层就是双重编码。
 */
export async function writeSiteSettings(next: SiteSettings): Promise<void> {
  await getRedis().set(KEYS.siteSettings, next);
}
