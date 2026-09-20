import { SITE_NAME } from "@/lib/site";

/**
 * Resend 发信。
 *
 * ⚠️ 为什么直接调 HTTP API 而不装 `resend` 包：
 * 只需要发一种邮件，SDK 会连带引入依赖树，而项目刚因为 peer 依赖冲突
 * 折腾过一轮（wrangler / workers-types）。一个 fetch 就够的事不值得增加依赖。
 *
 * ⚠️ fail-open 的设计取舍：
 * 没配 RESEND_API_KEY 时 `isEmailConfigured()` 返回 false，
 * 注册流程会**跳过验证**而不是报错 ——
 * 否则站长没配邮件服务时，所有新用户都注册不了，站点等于废掉一半。
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(
    (process.env.RESEND_API_KEY ?? "").trim() &&
      (process.env.RESEND_FROM ?? "").trim(),
  );
}

export function mailFrom(): string {
  const from = (process.env.RESEND_FROM ?? "").trim();
  if (!from) return "";
  // Resend 接受 "Name <a@b.com>" 或纯地址，两种都原样用
  return from;
}

/**
 * 发送验证码邮件。
 *
 * @returns true 发送成功；false 失败（调用方应据此决定是否报错）
 */
export async function sendVerificationCode(
  to: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const from = mailFrom();
  if (!apiKey || !from) {
    return { ok: false, error: "未配置 Resend" };
  }

  const subject = `${SITE_NAME} · 邮箱验证码`;
  const text = [
    `你的 ${SITE_NAME} 验证码是：${code}`,
    "",
    "30 分钟内有效。如果不是你本人操作，忽略这封邮件即可。",
  ].join("\n");

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">验证你的邮箱</h2>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#444;">
      你正在注册 ${escapeHtml(SITE_NAME)}，请输入下面的验证码完成验证：
    </p>
    <div style="margin:0 0 20px;padding:16px;text-align:center;background:#f5f6fb;border-radius:12px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:'SF Mono',Menlo,Consolas,monospace;color:#2b2b2b;">${escapeHtml(code)}</span>
    </div>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.7;color:#666;">
      验证码 30 分钟内有效。如果不是你本人操作，忽略这封邮件即可，账号不会创建成功。
    </p>
  </div>`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });

    if (!res.ok) {
      // 不要把响应体直接回给前端，可能含内部信息
      const detail = await res.text().catch(() => "");
      console.error("[email] Resend 返回错误状态", res.status, detail.slice(0, 200));
      return { ok: false, error: "邮件发送失败" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] 请求 Resend 异常", error instanceof Error ? error.message : error);
    return { ok: false, error: "邮件发送失败" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
