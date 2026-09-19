/**
 * IP 解析与 CIDR 匹配（IPv4 / IPv6）。
 *
 * ⚠️ 为什么要自己写：
 * Workers 环境没有 `net` 模块，也不能引入带原生扩展的 IP 库，只能用纯 JS 实现。
 *
 * ⚠️ 为什么不用 BigInt：
 * IPv6 是 128 位，最自然的写法是 BigInt，但项目的 tsconfig target 是
 * ES2017（Next.js 构建时自动设置），**BigInt 字面量在 ES2020 以下直接编译报错**
 * （TS2737），会卡死整个构建。
 * 所以这里把地址拆成 32 位字数组：IPv4 存 1 个字，IPv6 存 4 个字（大端序），
 * 逐字做掩码比较 —— 效果等价，且不依赖 ES2020。
 */

export type ParsedIp = {
  version: 4 | 6;
  /**
   * 32 位字，大端序（下标 0 是最高位）。
   * IPv4 长度 1，IPv6 长度 4。值一律按无符号处理。
   */
  words: number[];
};

/** 转无符号 32 位（JS 位运算结果为有符号，比较前统一归一化） */
function u32(n: number): number {
  return n >>> 0;
}

function parseHexGroup(g: string): number | null {
  if (g.length === 0 || g.length > 4) return null;
  for (let i = 0; i < g.length; i++) {
    const code = g.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isHexLower = code >= 97 && code <= 102;
    if (!isDigit && !isHexLower) return null;
  }
  return parseInt(g, 16);
}

export function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    // 拒绝空段、前导空格、"+1" 这类会被 Number/parseInt 悄悄接受的形式
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = (n << 8) | v;
  }
  return u32(n);
}

function parseIpv6(input: string): ParsedIp | null {
  let body = input;
  let v4Tail: number | null = null;

  // IPv4 内嵌写法：最后一段含 '.'，如 ::ffff:1.2.3.4
  const lastColon = body.lastIndexOf(":");
  if (lastColon >= 0 && body.slice(lastColon + 1).includes(".")) {
    const v4 = parseIpv4(body.slice(lastColon + 1));
    if (v4 === null) return null;
    v4Tail = v4;
    body = body.slice(0, lastColon + 1);
  }

  let head: string[];
  let tail: string[];
  let compressed = false;

  const dc = body.indexOf("::");
  if (dc >= 0) {
    // "::" 只允许出现一次
    if (body.indexOf("::", dc + 1) >= 0) return null;
    compressed = true;
    const h = body.slice(0, dc);
    const t = body.slice(dc + 2);
    head = h ? h.split(":").filter((x) => x !== "") : [];
    tail = t ? t.split(":").filter((x) => x !== "") : [];
  } else {
    head = body.split(":").filter((x) => x !== "");
    tail = [];
  }

  const extra = v4Tail !== null ? 2 : 0;
  const known = head.length + tail.length + extra;

  if (compressed) {
    if (known > 8) return null;
  } else if (known !== 8) {
    return null;
  }

  const groups: number[] = [];
  for (const g of head) {
    const v = parseHexGroup(g);
    if (v === null) return null;
    groups.push(v);
  }
  if (compressed) {
    for (let i = 0; i < 8 - known; i++) groups.push(0);
  }
  for (const g of tail) {
    const v = parseHexGroup(g);
    if (v === null) return null;
    groups.push(v);
  }
  if (v4Tail !== null) {
    groups.push((v4Tail >>> 16) & 0xffff);
    groups.push(v4Tail & 0xffff);
  }

  if (groups.length !== 8) return null;

  // 两个 16 位组合成一个 32 位字
  const words: number[] = [];
  for (let i = 0; i < 8; i += 2) {
    words.push(u32((groups[i] << 16) | groups[i + 1]));
  }
  return { version: 6, words };
}

/**
 * 解析 IP 字符串。
 *
 * 带 zone id（`fe80::1%eth0`）会先去掉 zone ——
 * zone 只对本机有意义，不会出现在远端地址里。
 */
export function parseIp(ip: string): ParsedIp | null {
  if (typeof ip !== "string") return null;
  const s = ip.trim().toLowerCase();
  if (!s) return null;

  const zone = s.indexOf("%");
  const clean = zone >= 0 ? s.slice(0, zone) : s;

  if (clean.includes(":")) {
    const v6 = parseIpv6(clean);
    if (!v6) return null;
    /**
     * ::ffff:a.b.c.d 归一成 IPv4。
     * 不归一的话，客户端以 IPv4 到达、请求头却写成映射格式时，
     * 会去匹配 IPv6 规则而漏掉 IPv4 规则 ——
     * 表现为"明明在白名单里却被拦"，极难排查。
     */
    if (v6.words[0] === 0 && v6.words[1] === 0 && v6.words[2] === 0x0000ffff) {
      return { version: 4, words: [v6.words[3]] };
    }
    return v6;
  }

  const v4 = parseIpv4(clean);
  return v4 === null ? null : { version: 4, words: [v4] };
}

export type Cidr = {
  version: 4 | 6;
  /** 网络地址（主机位已清零） */
  base: number[];
  /** 掩码，与 base 等长 */
  mask: number[];
};

/** 按字生成掩码：bits 落在第 i 个字内的部分才保留 */
function buildMask(bits: number, wordCount: number): number[] {
  const masks: number[] = [];
  for (let i = 0; i < wordCount; i++) {
    const remaining = bits - i * 32;
    if (remaining <= 0) {
      masks.push(0);
    } else if (remaining >= 32) {
      masks.push(0xffffffff);
    } else {
      // 0xffffffff 是有符号 -1，左移后必须 >>> 0 转回无符号
      masks.push(u32(0xffffffff << (32 - remaining)));
    }
  }
  return masks;
}

export function parseCidr(cidr: string): Cidr | null {
  if (typeof cidr !== "string") return null;
  const s = cidr.trim();
  const slash = s.lastIndexOf("/");
  if (slash < 0) return null;

  const addrPart = s.slice(0, slash);
  const bitsPart = s.slice(slash + 1);
  if (!/^\d{1,3}$/.test(bitsPart)) return null;

  const ip = parseIp(addrPart);
  if (!ip) return null;

  const bits = Number(bitsPart);
  const maxBits = ip.version === 4 ? 32 : 128;
  if (bits < 0 || bits > maxBits) return null;

  const mask = buildMask(bits, ip.words.length);
  const base = ip.words.map((w, i) => u32(w & mask[i]));
  return { version: ip.version, base, mask };
}

/** 判断单个 IP 是否落在 CIDR 内 */
export function cidrContains(cidr: Cidr, ip: ParsedIp): boolean {
  if (cidr.version !== ip.version) return false;
  for (let i = 0; i < ip.words.length; i++) {
    if (u32(ip.words[i] & cidr.mask[i]) !== u32(cidr.base[i])) return false;
  }
  return true;
}

/** 判断 IP 是否落在任一条 CIDR 内 */
export function matchesAny(cidrs: Cidr[], ip: ParsedIp): boolean {
  for (const c of cidrs) {
    if (cidrContains(c, ip)) return true;
  }
  return false;
}
