/**
 * 导航站数据（照搬 leoi.org 的栏目结构）
 *
 * 内置默认数据；管理员可在 /admin 的「导航管理」里增删改，
 * 自定义后的数据存在 Redis（key: nav:data）。
 */

export interface NavItem {
  id: string;
  name: string;
  url: string;
  desc?: string;
  /** 是否标注「推荐」 */
  recommended?: boolean;
}

export interface NavCategory {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

export const DEFAULT_NAV: NavCategory[] = [
  {
    id: "search",
    title: "查询工具",
    icon: "🔍",
    items: [
      {
        id: "whois",
        name: "Whois查询",
        url: "https://www.whois.com/whois/",
        desc: "查询域名注册信息",
      },
      {
        id: "icann-tld",
        name: "ICANN搜后缀",
        url: "https://www.iana.org/domains/root/db",
        desc: "IANA 根区数据库，权威后缀列表",
      },
      {
        id: "icann-whois",
        name: "ICANN权威whois查询",
        url: "https://lookup.icann.org/",
        desc: "ICANN 官方 whois",
      },
    ],
  },
  {
    id: "speed",
    title: "测速 & IP",
    icon: "⚡",
    items: [
      {
        id: "speed-test",
        name: "网站测速",
        url: "https://pagespeed.web.dev/",
        desc: "Google PageSpeed Insights",
      },
      { id: "ip", name: "查ip", url: "https://ip.sb/", desc: "查看本机 IP 与归属" },
      { id: "seo", name: "查SEO", url: "https://www.aizhan.com/", desc: "SEO 综合查询" },
      {
        id: "dns",
        name: "查DNS传播",
        url: "https://www.whatsmydns.net/",
        desc: "全球 DNS 解析传播检查",
      },
    ],
  },
  {
    id: "price",
    title: "域名价格 & 注册商",
    icon: "💰",
    items: [
      {
        id: "tld-list",
        name: "搜最便宜的域名价格",
        url: "https://tld-list.com/",
        desc: "对比各后缀注册/续费价",
      },
      {
        id: "gname",
        name: "新晋域名提供商（可支付宝）",
        url: "https://www.gname.com/",
        desc: "支持支付宝",
        recommended: true,
      },
      {
        id: "namesilo",
        name: "老牌域名提供商",
        url: "https://www.namesilo.com/",
        desc: "免费 WHOIS 隐私保护",
      },
      {
        id: "regery",
        name: "提供近2000种后缀购买的域名提供商",
        url: "https://www.regery.com/",
        desc: "后缀种类极全",
      },
    ],
  },
  {
    id: "freedomain",
    title: "免费域名",
    icon: "🎁",
    items: [
      {
        id: "gname-free",
        name: "Gname免费域名计划",
        url: "https://www.gname.com/",
        desc: "Gname 免费域名活动",
      },
      { id: "cccc", name: "cc.cc聚合页", url: "https://cc.cc/", desc: "免费二级域名" },
      {
        id: "katabump",
        name: "katabump免费域名",
        url: "https://katabump.com/",
        desc: "免费二级域名",
        recommended: true,
      },
      {
        id: "digitalplat",
        name: "DigitalPlat Domain",
        url: "https://domain.digitalplat.org/",
        desc: "免费域名，可接入 Cloudflare",
        recommended: true,
      },
      {
        id: "dnshe",
        name: "DNSHE免费域名",
        url: "https://dnshe.com/",
        desc: "免费域名 + DNS",
        recommended: true,
      },
      {
        id: "stackryze",
        name: "Stackryze免费域名",
        url: "https://stackryze.com/",
        desc: "防滥用挺严格，相对的域名更干净",
      },
    ],
  },
  {
    id: "deploy",
    title: "免费部署静态页面",
    icon: "📃",
    items: [
      {
        id: "cloudflare-pages",
        name: "Cloudflare",
        url: "https://pages.cloudflare.com/",
        desc: "神可能会被超越，但神永远是神",
        recommended: true,
      },
      { id: "gh-pages", name: "GitHub", url: "https://pages.github.com/", desc: "GitHub Pages" },
      {
        id: "freepage",
        name: "FreePage",
        url: "https://free.page/",
        desc: "纯小白，一分钱不想花，只会复制粘贴，还想要一个网站，就用这个",
        recommended: true,
      },
      {
        id: "cf-drop",
        name: "Cloudflare Drop",
        url: "https://drop.cloudflare.com/",
        desc: "临时部署整个静态站，链接大陆用不了",
      },
      {
        id: "pagedrop",
        name: "pagedrop",
        url: "https://pagedrop.io/",
        desc: "临时部署单页面，链接大陆可用，二级域名",
      },
      {
        id: "pagebowl",
        name: "Page Bowl",
        url: "https://pagebowl.io/",
        desc: "临时部署整个静态站，链接大陆可用",
        recommended: true,
      },
    ],
  },
  {
    id: "hosting",
    title: "免费主机",
    icon: "🖥️",
    items: [
      {
        id: "infinityfree",
        name: "infinityfree",
        url: "https://www.infinityfree.com/",
        desc: "老牌免费主机",
      },
      {
        id: "byethost",
        name: "byethost",
        url: "https://www.byethost.com/",
        desc: "跟 infinityfree 同根，主机在欧洲",
        recommended: true,
      },
      {
        id: "hyperphp",
        name: "hyperphp",
        url: "https://hyperphp.com/",
        desc: "控制台跟 byethost 一毛一样",
        recommended: true,
      },
      {
        id: "tinkerhost",
        name: "Tinkerhost",
        url: "https://tinkerhost.com/",
        desc: "可自定义域名，自带证书",
        recommended: true,
      },
      {
        id: "mofh",
        name: "Mofh",
        url: "https://mofh.net/",
        desc: "相当于给你一个经销商账户，需自签证书",
      },
    ],
  },
  {
    id: "ai",
    title: "免费工作流AI与免费key",
    icon: "🧰",
    items: [
      {
        id: "trae",
        name: "Trae",
        url: "https://www.trae.ai/",
        desc: "国内用还行的 AI IDE",
      },
      {
        id: "grok",
        name: "Gork",
        url: "https://grok.com/",
        desc: "懂得都懂，趁早爽",
        recommended: true,
      },
      {
        id: "aistudio",
        name: "Google AI Studio",
        url: "https://aistudio.google.com/",
        desc: "好用，且没有额度限制，门槛稍高",
      },
      {
        id: "zhipu",
        name: "智谱",
        url: "https://bigmodel.cn/",
        desc: "新用户送 2000 万 tokens，4.7 flash 免费调用",
        recommended: true,
      },
      {
        id: "siliconflow",
        name: "硅基流动",
        url: "https://siliconflow.cn/",
        desc: "一大堆免费模型",
        recommended: true,
      },
      { id: "manus", name: "Manus", url: "https://manus.im/", desc: "AI Agent 产品" },
      {
        id: "qwenpaw",
        name: "QwenPaw国际版",
        url: "https://qwen.ai/",
        desc: "多说无用，用了才知道",
        recommended: true,
      },
      {
        id: "agnes",
        name: "Agnes",
        url: "https://agnes-ai.com/",
        desc: "新加坡公司，agent 非常强，搭配 AgentScope Platform 神中神，有中国站",
        recommended: true,
      },
    ],
  },
];
