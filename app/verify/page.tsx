import { PageTitle } from "@/components/page-i18n";
import { VerifyForm } from "@/components/verify-form";
import { SiteFooter } from "@/components/site-footer";
import { pageTitle } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: pageTitle("验证邮箱"),
  description: "输入邮箱验证码完成注册",
};

export default function VerifyPage() {
  return (
    <main className="relative flex min-h-screen-safe flex-col items-center justify-center px-4 py-10">
      <PageTitle titleKey="verify.title" />
      <VerifyForm />
      <div className="mt-8 w-full">
        <SiteFooter />
      </div>
    </main>
  );
}
