/**
 * 带超时的 fetch signal。
 *
 * ⚠️ 为什么不能直接用 AbortSignal.timeout()：
 * 它是 Safari 16+ 才有的 API。老版本 Safari 上调用会直接抛
 * `TypeError: AbortSignal.timeout is not a function` ——
 * 不是"超时不生效"这种降级问题，而是请求根本发不出去。
 *
 * 受影响的都是关键路径：管理员面板读配置、联网搜索。
 * 一旦抛错，面板会一直转圈、联网功能彻底不可用。
 *
 * 这里手动实现等价行为：不支持时退回 AbortController + setTimeout。
 */

/** 创建一个会在 ms 毫秒后自动 abort 的 signal */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    try {
      return AbortSignal.timeout(ms);
    } catch {
      /* 某些环境下会抛，继续走手动实现 */
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  /**
   * 已经 abort 过的 signal 再监听不到 abort 事件，
   * 所以这里挂在 signal 上清理定时器，避免 timer 泄漏。
   */
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
}

/**
 * 判断错误是否为超时。
 *
 * 手写的 abort 不会带 TimeoutError 的 name，
 * 所以 name 和 AbortError 都要认，否则超时提示会显示成"网络错误"。
 */
export function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError";
}
