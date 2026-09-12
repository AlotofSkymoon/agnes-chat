import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { NavBoard } from "@/components/nav/nav-board";
import { NavChrome } from "@/components/nav/nav-chrome";
import { pageTitle } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = {
  title: pageTitle("导航"),
  description: "站长工具、免费资源导航与全球域名后缀速查",
};

export default function NavPage() {
  return (
    <main className="relative min-h-[100dvh]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 aurora" />
      <NavChrome />
      <div className="relative">
        <NavBoard />
      </div>
      <div className="pb-10 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageSquare className="h-4 w-4" />
          返回聊天
        </Link>
      </div>
    </main>
  );
}
