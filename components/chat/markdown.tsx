"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language?: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0b0b12]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-white/60">
        <span className="uppercase tracking-wide">{language || "code"}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-6">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code({ className: codeClassName, children }) {
            const text = String(children ?? "").replace(/\n$/, "");
            const langMatch = /language-(\w+)/.exec(codeClassName ?? "");
            const isBlock = Boolean(langMatch) || text.includes("\n");

            if (!isBlock) {
              return <code className={codeClassName}>{children}</code>;
            }
            return <CodeBlock language={langMatch?.[1]} code={text} />;
          },
          a: ({ children: c, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {c}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
