/**
 * 图片可达性探测 + 自动解码回退。
 *
 * 解决一个很隐蔽的坑：
 *   对象存储「配置成功了、上传也返回 200」，但桶没开公开读，
 *   或者自定义域名没配好 —— 这时拿到的是一个**外部访问不了**的 URL。
 *   AI 是服务端去拉这个 URL 的，拉不到就等于"图发出去了但它看不见"。
 *
 * 用户看到的症状就是"明明配了对象存储，AI 还是看不到图片"，
 * 却没有任何报错提示，非常难排查。
 *
 * 所以上传后主动探测一次：加载得出来才用 URL，
 * 加载不出来就自动把图片转回 base64 内嵌 —— 内嵌是一定能被 AI 读到的。
 */

/**
 * 探测图片 URL 是否真的能被加载出来。
 *
 * 用 Image 对象而不是 fetch：
 *   - 图片加载不需要 CORS 许可（canvas 读取才需要），语义上正好是
 *     "AI 能不能看到这张图"；
 *   - fetch 会被跨域策略拦成 opaque response，反而误判。
 */
export function probeImageUrl(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !url) {
      resolve(false);
      return;
    }

    let settled = false;
    const img = new Image();

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };

    const timer = setTimeout(() => {
      // 超时按失败处理：慢到这个程度的图，AI 那边大概率也拉不动
      img.src = "";
      done(false);
    }, timeoutMs);

    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);

    // 加时间戳绕开缓存，确保探测的是真实可达性
    img.src = url + (url.includes("?") ? "&" : "?") + "_probe=" + Date.now();
  });
}

/**
 * 把 File 读成 base64 data URL。
 * AI 侧不需要任何额外处理 —— OpenAI 的 image_url 本身就接受 data URL，
 * 这就是「自动解码」：不用用户操心格式转换。
 */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

/**
 * 把远程图片拉回本地 data URL。
 *
 * 用于「上传成功了但 URL 访问不了」的补救：
 * 图还在本地内存里，直接编码内嵌，不必让用户重新选一次文件。
 */
export async function urlToDataUrl(url: string, timeoutMs = 10_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await fileToDataUrl(blob);
  } finally {
    clearTimeout(timer);
  }
}
