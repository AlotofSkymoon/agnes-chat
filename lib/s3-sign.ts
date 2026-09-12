/**
 * AWS Signature Version 4（S3）—— 零依赖实现，基于 Web Crypto。
 * 兼容 Cloudflare R2 / AWS S3 / MinIO / COS / OSS 等所有 S3 协议存储。
 * 仅服务端使用（密钥不落前端）。
 */

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buf as ArrayBuffer);
  return toHex(digest);
}

async function hmacRaw(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(msg));
}

async function hmacHex(key: ArrayBuffer, msg: string): Promise<string> {
  return toHex(await hmacRaw(key, msg));
}

/**
 * S3 要求对 URI 每段单独编码（保留 / 不编码）。
 * 这与 encodeURIComponent 的区别：后者会编码 !'()* 等，S3 不要求但可接受；
 * 关键是 / 必须保留。
 */
function encodeS3Path(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg).replace(/%2F/g, "/"))
    .join("/");
}

/** RFC 3986 编码（比 encodeURIComponent 更严格，额外编码 !'()*） */
function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

export interface S3PresignParams {
  endpoint: string;
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** 有效期（秒），默认 15 分钟 */
  expiresIn?: number;
}

/**
 * 生成预签名 PUT URL。
 * 浏览器拿到后直接 PUT 到对象存储，文件不经过 Vercel
 * （Vercel Serverless 请求体上限仅 4.5MB，无法代理大文件）。
 */
export async function presignS3Put(params: S3PresignParams): Promise<string> {
  const {
    endpoint,
    bucket,
    key,
    region,
    accessKeyId,
    secretAccessKey,
    expiresIn = 900,
  } = params;

  const base = endpoint.replace(/\/+$/, "");
  const pathEncoded = encodeS3Path(`/${bucket}/${key.replace(/^\/+/, "")}`);
  const parsed = new URL(base + pathEncoded);
  const host = parsed.host;

  const amzDateStr = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDateStr.slice(0, 8);
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDateStr,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "PUT",
    parsed.pathname,
    canonicalQueryString,
    canonicalHeaders,
    "host",
    payloadHash,
  ].join("\n");

  const stringToSign = [
    algorithm,
    amzDateStr,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region);
  const signature = await hmacHex(signingKey, stringToSign);

  return `${parsed.toString()}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export interface S3SignParams {
  method: "PUT" | "GET" | "DELETE" | "HEAD";
  /** 完整 URL，例如 https://xxx.r2.cloudflarestorage.com/bucket/key.png */
  url: string;
  body: ArrayBuffer;
  contentType: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** 自定义元数据（可选） */
  amzDate?: Date;
}

export interface S3SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/** 生成 Signing Key：HMAC 链 */
export async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service = "s3",
): Promise<ArrayBuffer> {
  const kDate = await hmacRaw(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  return hmacRaw(kService, "aws4_request");
}

/** 对一次 S3 请求签名，返回可直接 fetch 的 url + headers */
export async function signS3Request(params: S3SignParams): Promise<S3SignedRequest> {
  const {
    method,
    url,
    body,
    contentType,
    accessKeyId,
    secretAccessKey,
    region,
    amzDate = new Date(),
  } = params;

  const parsed = new URL(url);
  const host = parsed.host;
  const canonicalUri = encodeS3Path(parsed.pathname) || "/";

  const amzDateStr = amzDate.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDateStr.slice(0, 8);

  const payloadHash = await sha256Hex(body);

  // 参与签名的 header 必须按字母序排列
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDateStr,
  };
  if (contentType) headers["content-type"] = contentType;
  const outHeaders: Record<string, string> = { ...headers };

  // CanonicalQueryString：按参数名排序后 URI 编码（PUT 通常为空，此处保证通用性）
  const canonicalQueryString = parsed.search
    ? Array.from(parsed.searchParams.entries())
        .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)] as const)
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("&")
    : "";

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${String(headers[k]).trim()}\n`).join("");
  const signedHeaders = sortedKeys.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDateStr,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region);
  const signature = await hmacHex(signingKey, stringToSign);

  const authorization =
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: parsed.toString(),
    headers: {
      ...outHeaders,
      ...(contentType ? { "content-type": contentType } : {}),
      authorization,
    },
  };
}
