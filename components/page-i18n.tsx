"use client";

import * as React from "react";

import { useI18n } from "@/components/i18n-provider";
import { pageTitle } from "@/lib/site";

/**
 * 页面级文案的客户端桥梁。
 *
 * ⚠️ 为什么需要这些东西：
 * `metadata` 和静态 JSX 文本都在服务端产出，而语言是**客户端状态**
 * —— 切到英文后，服务端渲染的那行「返回聊天」不会跟着变，
 * 浏览器标签仍是中文标题。这就是"语言系统不全局"的根源。
 *
 * 服务端保留一份简体默认值（SEO 与首屏需要），
 * 挂载后由这些组件按当前语言改写，两者不对齐也不会报错。
 */

/**
 * 同步浏览器标签标题。
 *
 * ⚠️ 为什么不用 generateMetadata：
 * 语言存在 localStorage，服务端读不到；为它牺牲静态渲染不值得。
 * metadata 保留简体默认（爬虫看到的是简体），客户端接管之后的用户可见标题。
 */
export function PageTitle({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();

  React.useEffect(() => {
    try {
      document.title = pageTitle(t(titleKey));
    } catch {
      // 极端环境 document 不可写，页面照常能用
    }
  }, [t, titleKey]);

  return null;
}

/** 渲染一条词典文案：给服务端组件里的静态中文用 */
export function I18nText({
  k,
  vars,
}: {
  k: string;
  vars?: Record<string, string | number>;
}) {
  const { t } = useI18n();
  return <>{t(k, vars)}</>;
}
