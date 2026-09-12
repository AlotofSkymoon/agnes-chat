/**
 * 图片压缩（仅浏览器端）。
 *
 * 为什么需要：图片作为 base64 data URL 塞进聊天请求时会膨胀约 33%，
 * 一张 1.1MB 的照片编码后就是 1.5MB —— 很容易撞上请求体上限，
 * 报「单条消息内容过大」。而模型识图其实不需要原图分辨率，
 * 1024~1600px 足够看清内容。
 *
 * 策略：逐步降采样 + 降质量，直到 base64 体积达标；
 * 若原图本来就小，则原样返回（不为了"压缩"反而变大）。
 */

/**
 * 压缩目标：单张图片 base64 的字节上限。
 *
 * 取 1MB 的原因：最多同时挂 5 个附件，5 × 1MB = 5MB 会超过 Vercel
 * 请求体 4.5MB 硬上限；压到 1MB 后，3 张以内必定通过，
 * 更多张会被前端预检拦下并引导去配置对象存储（图片走链接就不占请求体了）。
 * 1MB base64 ≈ 750KB JPEG，1200~1600px，识图完全够用。
 */
export const IMAGE_TARGET_BASE64 = 1_000_000;

/** 长边像素上限，超过就等比缩小 */
const MAX_DIMENSION = 1600;

/** 最多尝试几轮，避免极端情况死循环 */
const MAX_ROUNDS = 5;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = url;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("读取失败"));
    fr.readAsDataURL(file);
  });
}

/**
 * 把图片压缩成较小的 JPEG data URL。
 *
 * @param file    原始图片文件
 * @param target  base64 字符串长度上限
 * @returns 压缩后的 data URL；若原图更小或压缩失败，返回原图 data URL
 */
export async function compressImageToDataUrl(
  file: File,
  target: number = IMAGE_TARGET_BASE64,
): Promise<{ dataUrl: string; compressed: boolean }> {
  const original = await readAsDataUrl(file);

  // 原图已达标，直接返回，不做无谓的重编码
  if (original.length <= target) return { dataUrl: original, compressed: false };

  try {
    const img = await loadImage(original);
    let dimension = MAX_DIMENSION;
    let quality = 0.82;
    let best = original;

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const scale = Math.min(1, dimension / Math.max(img.width, img.height));
      // 只缩不放：原图比目标尺寸小时保持原尺寸
      const w = Math.max(1, Math.round(img.width * Math.min(scale, 1)));
      const h = Math.max(1, Math.round(img.height * Math.min(scale, 1)));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;

      // 白底：避免透明 PNG 转 JPEG 后变成黑块
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const out = canvas.toDataURL("image/jpeg", quality);
      if (out.length < best.length) best = out;

      if (out.length <= target) {
        return { dataUrl: out, compressed: out.length < original.length };
      }

      // 还没达标：继续缩小、降低质量
      dimension = Math.round(dimension * 0.75);
      quality = Math.max(0.4, quality - 0.12);
    }

    // 尽力了：如果压缩后的结果仍比原图小，就用压缩版
    return { dataUrl: best, compressed: best.length < original.length };
  } catch {
    // 压缩失败（如非浏览器环境、格式不支持）→ 退回原图
    return { dataUrl: original, compressed: false };
  }
}
