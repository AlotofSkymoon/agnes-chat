"use client";

import * as React from "react";

/**
 * 备案徽章图片。
 *
 * ⚠️ 为什么单独做成客户端组件：
 * 第三方备案服务（icp.gov.moe / icp.sakura.ink 这类）给的图标是外链，
 * 域名随时可能失效。用 <img> 直接渲染会变成破图，
 * 挂在页脚上非常显眼也很难看。
 *
 * 加载失败时直接返回 null —— 整块消失，不留痕迹。
 */
export function SiteFooterBadge({
  src,
  alt,
  href,
}: {
  src: string;
  alt: string;
  href?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  if (failed) return null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      height={20}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-5 w-auto align-middle"
    />
  );

  if (!href) return img;

  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex">
      {img}
    </a>
  );
}
