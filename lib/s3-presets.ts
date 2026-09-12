/**
 * S3 兼容对象存储预设。
 * 图片 / 视频等大文件不再走 base64 塞进消息，而是上传到对象存储，只回传一个 URL。
 */

export interface S3Preset {
  id: string;
  label: string;
  /** 端点示例（用户需替换尖括号部分） */
  endpointHint: string;
  /** 常见 region；S3 协议必填，即使存储商不使用也要给个值 */
  regionHint: string;
  /** 一句话点评 */
  note: string;
  /** 文档 / 控制台地址 */
  docs: string;
  /** 是否推荐 */
  recommended?: boolean;
  /** 是否不推荐（如 Backblaze B2 的 S3 兼容层有坑） */
  discouraged?: boolean;
}

export const S3_PRESETS: S3Preset[] = [
  {
    id: "r2",
    label: "Cloudflare R2（推荐）",
    endpointHint: "https://<accountid>.r2.cloudflarestorage.com",
    regionHint: "auto",
    note: "零出站流量费，10GB 免费额度，S3 完全兼容，个人站首选",
    docs: "https://dash.cloudflare.com/",
    recommended: true,
  },
  {
    id: "minio",
    label: "MinIO（自建，推荐）",
    endpointHint: "https://s3.example.com",
    regionHint: "us-east-1",
    note: "自己服务器跑，完全免费可控，适合已有 VPS 的人",
    docs: "https://min.io/docs/minio/linux/index.html",
    recommended: true,
  },
  {
    id: "cos",
    label: "腾讯云 COS",
    endpointHint: "https://cos.<region>.myqcloud.com",
    regionHint: "ap-guangzhou",
    note: "国内访问快，新用户长期免费额度，需实名",
    docs: "https://cloud.tencent.com/product/cos",
    recommended: true,
  },
  {
    id: "oss",
    label: "阿里云 OSS",
    endpointHint: "https://oss-<region>.aliyuncs.com",
    regionHint: "oss-cn-hangzhou",
    note: "节点覆盖广，新用户免费额度，稳定",
    docs: "https://www.aliyun.com/product/oss",
  },
  {
    id: "s3",
    label: "AWS S3",
    endpointHint: "https://s3.<region>.amazonaws.com",
    regionHint: "us-east-1",
    note: "行业标准，功能最全，但出站流量贵",
    docs: "https://s3.console.aws.amazon.com/",
  },
  {
    id: "qiniu",
    label: "七牛云 Kodo",
    endpointHint: "https://s3-<region>.qiniucs.com",
    regionHint: "cn-east-1",
    note: "10GB 免费空间，支持图片处理",
    docs: "https://www.qiniu.com/products/kodo",
  },
  {
    id: "upyun",
    label: "又拍云 USS",
    endpointHint: "https://s3.api.upyun.com",
    regionHint: "cn-east-1",
    note: "国内老牌，有免费联盟额度",
    docs: "https://www.upyun.com/products/uss",
  },
  {
    id: "tos",
    label: "火山引擎 TOS",
    endpointHint: "https://tos-s3-<region>.volces.com",
    regionHint: "cn-beijing",
    note: "字节系，新用户免费额度",
    docs: "https://www.volcengine.com/product/tos",
  },
  {
    id: "do",
    label: "DigitalOcean Spaces",
    endpointHint: "https://<region>.digitaloceanspaces.com",
    regionHint: "nyc3",
    note: "价格固定，含 CDN，适合海外站",
    docs: "https://cloud.digitalocean.com/spaces",
  },
  {
    id: "wasabi",
    label: "Wasabi",
    endpointHint: "https://s3.<region>.wasabisys.com",
    regionHint: "us-east-1",
    note: "无出站费，但有最小存储期计费",
    docs: "https://wasabi.com/",
  },
  {
    id: "b2",
    label: "Backblaze B2（不推荐）",
    endpointHint: "https://s3.<region>.backblazeb2.com",
    regionHint: "us-west-004",
    note: "S3 兼容层不完整，部分操作不支持，容易踩坑",
    docs: "https://www.backblaze.com/b2/",
    discouraged: true,
  },
];

/** S3 配置（保存在浏览器本地，随上传请求一起发到服务端代理） */
export interface S3Config {
  enabled: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** 自定义公开访问域名，留空则用 endpoint/bucket/key 拼 */
  publicBaseUrl?: string;
  /** 存储中的目录前缀 */
  prefix?: string;
}

export const DEFAULT_S3_CONFIG: S3Config = {
  enabled: false,
  endpoint: "",
  region: "auto",
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
  publicBaseUrl: "",
  prefix: "agnes-chat",
};

/** 上传体积上限 */
export const UPLOAD_LIMITS = {
  image: 10 * 1024 * 1024, // 10 MB
  video: 100 * 1024 * 1024, // 100 MB
  other: 20 * 1024 * 1024, // 20 MB
} as const;
