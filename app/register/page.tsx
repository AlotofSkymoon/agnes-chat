import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AuthForm } from "@/components/auth-form";
import { pageTitle } from "@/lib/site";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: pageTitle("注册") };

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen-safe flex-col items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 aurora" />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回聊天
        </Link>
        <Suspense fallback={null}>
          <AuthForm mode="register" />
        </Suspense>
        <SiteFooter className="mt-8" />
      </div>
    </main>
  );
}
