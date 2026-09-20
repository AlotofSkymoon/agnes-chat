import type { Locale } from "./config";

/**
 * 界面词典。
 *
 * ⚠️ 为什么简体/繁体分开写而不是运行时转换：
 * 简繁不是一一对应的（"对话框"→"對話框"、"内存"→"記憶體"），
 * 自动转换会产出港台不用的写法，看着像机器翻的。
 *
 * ⚠️ 词条是随代码发布的资源，不是用户配置。
 * 新增界面文案时必须四门语言一起补，漏了会回落到简体（见 t 的兜底）。
 */
type Entry = Record<Locale, string>;

const DICT: Record<string, Entry> = {
  // ---- 通用 ----
  "common.save": { "zh-CN": "保存", "zh-TW": "儲存", en: "Save", fr: "Enregistrer" },
  "common.cancel": { "zh-CN": "取消", "zh-TW": "取消", en: "Cancel", fr: "Annuler" },
  "common.confirm": { "zh-CN": "确认", "zh-TW": "確認", en: "Confirm", fr: "Confirmer" },
  "common.close": { "zh-CN": "关闭", "zh-TW": "關閉", en: "Close", fr: "Fermer" },
  "common.delete": { "zh-CN": "删除", "zh-TW": "刪除", en: "Delete", fr: "Supprimer" },
  "common.edit": { "zh-CN": "编辑", "zh-TW": "編輯", en: "Edit", fr: "Modifier" },
  "common.rename": { "zh-CN": "重命名", "zh-TW": "重新命名", en: "Rename", fr: "Renommer" },
  "common.loading": { "zh-CN": "加载中…", "zh-TW": "載入中…", en: "Loading…", fr: "Chargement…" },
  "common.optional": { "zh-CN": "可选", "zh-TW": "選填", en: "Optional", fr: "Facultatif" },
  "common.enabled": { "zh-CN": "已开启", "zh-TW": "已開啟", en: "Enabled", fr: "Activé" },
  "common.disabled": { "zh-CN": "已关闭", "zh-TW": "已關閉", en: "Disabled", fr: "Désactivé" },

  // ---- 侧边栏 ----
  "sidebar.newChat": { "zh-CN": "开启新对话", "zh-TW": "開啟新對話", en: "New chat", fr: "Nouvelle discussion" },
  "sidebar.history": { "zh-CN": "历史对话", "zh-TW": "歷史對話", en: "History", fr: "Historique" },
  "sidebar.empty": { "zh-CN": "还没有对话", "zh-TW": "還沒有對話", en: "No conversations yet", fr: "Aucune discussion" },
  "sidebar.settings": { "zh-CN": "设置", "zh-TW": "設定", en: "Settings", fr: "Paramètres" },
  "sidebar.admin": { "zh-CN": "管理员面板", "zh-TW": "管理員面板", en: "Admin panel", fr: "Panneau d'administration" },
  "sidebar.account": { "zh-CN": "账户", "zh-TW": "帳戶", en: "Account", fr: "Compte" },
  "sidebar.login": { "zh-CN": "登录 / 注册", "zh-TW": "登入 / 註冊", en: "Log in / Sign up", fr: "Connexion / Inscription" },
  "sidebar.sponsor": { "zh-CN": "赞助支持", "zh-TW": "贊助支持", en: "Sponsor", fr: "Soutenir" },
  "sidebar.nav": { "zh-CN": "导航站", "zh-TW": "導航站", en: "Sites", fr: "Annuaire" },
  "sidebar.clearAll": { "zh-CN": "清空全部对话", "zh-TW": "清空全部對話", en: "Clear all", fr: "Tout effacer" },
  "sidebar.collapse": { "zh-CN": "收起侧边栏", "zh-TW": "收起側邊欄", en: "Collapse sidebar", fr: "Réduire la barre" },
  "sidebar.expand": { "zh-CN": "展开侧边栏", "zh-TW": "展開側邊欄", en: "Expand sidebar", fr: "Afficher la barre" },

  // ---- 聊天输入 ----
  "input.placeholder": { "zh-CN": "给 Agnes 发送消息", "zh-TW": "傳送訊息給 Agnes", en: "Message Agnes", fr: "Envoyer un message à Agnes" },
  "input.send": { "zh-CN": "发送", "zh-TW": "傳送", en: "Send", fr: "Envoyer" },
  "input.stop": { "zh-CN": "停止", "zh-TW": "停止", en: "Stop", fr: "Arrêter" },
  "input.think": { "zh-CN": "思考", "zh-TW": "思考", en: "Think", fr: "Réfléchir" },
  "input.web": { "zh-CN": "联网", "zh-TW": "聯網", en: "Web", fr: "Web" },
  "input.dropFile": { "zh-CN": "可拖拽文件到此处", "zh-TW": "可拖曳檔案到此處", en: "Drop files here", fr: "Déposez des fichiers ici" },
  "input.disclaimer": { "zh-CN": "内容由 AI 生成，仅供参考", "zh-TW": "內容由 AI 生成，僅供參考", en: "AI-generated content, for reference only", fr: "Contenu généré par IA, à titre indicatif" },
  "chat.newChat": { "zh-CN": "新对话", "zh-TW": "新對話", en: "New chat", fr: "Nouvelle discussion" },

  // ---- 登录 / 注册 ----
  "auth.email": { "zh-CN": "邮箱", "zh-TW": "電子郵件", en: "Email", fr: "E-mail" },
  "auth.password": { "zh-CN": "密码", "zh-TW": "密碼", en: "Password", fr: "Mot de passe" },
  "auth.login": { "zh-CN": "登录", "zh-TW": "登入", en: "Log in", fr: "Se connecter" },
  "auth.register": { "zh-CN": "注册", "zh-TW": "註冊", en: "Sign up", fr: "S'inscrire" },
  "auth.logout": { "zh-CN": "退出登录", "zh-TW": "登出", en: "Log out", fr: "Se déconnecter" },
  "auth.toRegister": { "zh-CN": "还没有账号？去注册", "zh-TW": "還沒有帳號？去註冊", en: "No account? Sign up", fr: "Pas de compte ? Inscrivez-vous" },
  "auth.toLogin": { "zh-CN": "已有账号？去登录", "zh-TW": "已有帳號？去登入", en: "Have an account? Log in", fr: "Déjà un compte ? Connectez-vous" },
  "auth.verifyCode": { "zh-CN": "验证码", "zh-TW": "驗證碼", en: "Verification code", fr: "Code de vérification" },
  "auth.verifySent": { "zh-CN": "验证码已发送到你的邮箱", "zh-TW": "驗證碼已傳送到你的信箱", en: "Code sent to your email", fr: "Code envoyé par e-mail" },
  "auth.verifyHint": { "zh-CN": "请输入邮箱收到的 6 位验证码", "zh-TW": "請輸入信箱收到的 6 位驗證碼", en: "Enter the 6-digit code from your email", fr: "Saisissez le code à 6 chiffres reçu" },
  "auth.submitCode": { "zh-CN": "验证", "zh-TW": "驗證", en: "Verify", fr: "Vérifier" },
  "auth.resend": { "zh-CN": "重新发送", "zh-TW": "重新傳送", en: "Resend", fr: "Renvoyer" },
  "auth.wrongCode": { "zh-CN": "验证码不正确", "zh-TW": "驗證碼不正確", en: "Incorrect code", fr: "Code incorrect" },
  "auth.codeExpired": { "zh-CN": "验证码已过期", "zh-TW": "驗證碼已過期", en: "Code expired", fr: "Code expiré" },
  "auth.tooMany": { "zh-CN": "尝试次数过多，请重新获取", "zh-TW": "嘗試次數過多，請重新取得", en: "Too many attempts, request a new code", fr: "Trop de tentatives, demandez un nouveau code" },

  // ---- 设置 ----
  "settings.title": { "zh-CN": "设置", "zh-TW": "設定", en: "Settings", fr: "Paramètres" },
  "settings.model": { "zh-CN": "模型", "zh-TW": "模型", en: "Model", fr: "Modèle" },
  "settings.apiKey": { "zh-CN": "API Key", "zh-TW": "API Key", en: "API Key", fr: "Clé API" },
  "settings.baseUrl": { "zh-CN": "接口地址", "zh-TW": "介面位址", en: "Base URL", fr: "URL de base" },
  "settings.provider": { "zh-CN": "自定义供应商", "zh-TW": "自訂供應商", en: "Custom provider", fr: "Fournisseur personnalisé" },
  "settings.theme": { "zh-CN": "主题配色", "zh-TW": "主題配色", en: "Theme", fr: "Thème" },
  "settings.appearance": { "zh-CN": "外观", "zh-TW": "外觀", en: "Appearance", fr: "Apparence" },
  "settings.language": { "zh-CN": "界面语言", "zh-TW": "介面語言", en: "Language", fr: "Langue" },
  "settings.storage": { "zh-CN": "对象存储", "zh-TW": "物件儲存", en: "Object storage", fr: "Stockage d'objets" },
  "settings.cloudSave": { "zh-CN": "保存聊天记录到云端", "zh-TW": "儲存聊天記錄到雲端", en: "Save chats to the cloud", fr: "Enregistrer les discussions dans le cloud" },
  "settings.appearance.light": { "zh-CN": "浅色", "zh-TW": "淺色", en: "Light", fr: "Clair" },
  "settings.appearance.dark": { "zh-CN": "深色", "zh-TW": "深色", en: "Dark", fr: "Sombre" },
  "settings.appearance.system": { "zh-CN": "跟随系统", "zh-TW": "跟隨系統", en: "System", fr: "Système" },

  // ---- 赞助页 ----
  "sponsor.back": { "zh-CN": "返回聊天", "zh-TW": "返回聊天", en: "Back to chat", fr: "Retour au chat" },
  "sponsor.support": { "zh-CN": "支持", "zh-TW": "支持", en: "Support", fr: "Soutenir" },
  "sponsor.free": { "zh-CN": "本站永久免费、无广告、不采集隐私数据。", "zh-TW": "本站永久免費、無廣告、不蒐集隱私資料。", en: "Free forever, no ads, no tracking.", fr: "Gratuit à vie, sans pub, sans suivi." },
  "sponsor.note": { "zh-CN": "服务器、域名、API 额度用的都是免费额度，站长不担心这块 —— 赞助会直接变成他的生活经费和购物基金。", "zh-TW": "伺服器、網域、API 額度用的都是免費額度，站長不擔心這塊 —— 贊助會直接變成他的生活費和購物基金。", en: "Servers, domain and API quota all run on free tiers. Sponsorship goes straight to his living expenses and shopping.", fr: "Serveurs, domaine et quota API sont tous en offre gratuite. Les dons vont directement à ses dépenses courantes." },
  "sponsor.where": { "zh-CN": "赞助用在哪", "zh-TW": "贊助用在哪", en: "Where it goes", fr: "À quoi servent les dons" },
  "sponsor.other": { "zh-CN": "不出钱也能帮忙", "zh-TW": "不出錢也能幫忙", en: "Other ways to help", fr: "Autres façons d'aider" },
  "sponsor.scan": { "zh-CN": "长按或扫描二维码 · 金额随意", "zh-TW": "長按或掃描 QR Code · 金額隨意", en: "Scan the QR code · any amount", fr: "Scannez le QR code · montant libre" },
  "sponsor.pick": { "zh-CN": "挑一个你方便的方式 · 长按或扫描二维码 · 金额随意", "zh-TW": "挑一個你方便的方式 · 長按或掃描 QR Code · 金額隨意", en: "Pick whichever suits you · scan the QR code · any amount", fr: "Choisissez la méthode qui vous convient · scannez le QR code · montant libre" },
  "sponsor.notConfigured": { "zh-CN": "收款码暂未配置", "zh-TW": "收款碼尚未設定", en: "QR code not configured", fr: "QR code non configuré" },
  "sponsor.voluntary": { "zh-CN": "赞助完全自愿，不影响任何功能使用。", "zh-TW": "贊助完全自願，不影響任何功能使用。", en: "Sponsorship is entirely voluntary and unlocks nothing extra.", fr: "Le soutien est entièrement volontaire et ne débloque rien de plus." },
  "sponsor.use.living": { "zh-CN": "生活经费", "zh-TW": "生活費", en: "Living expenses", fr: "Dépenses courantes" },
  "sponsor.use.livingDesc": { "zh-CN": "站长是名学生，赞助用来贴补日常开销", "zh-TW": "站長是名學生，贊助用來貼補日常開銷", en: "The maintainer is a student; this covers daily costs", fr: "Le mainteneur est étudiant ; cela couvre ses dépenses quotidiennes" },
  "sponsor.use.shopping": { "zh-CN": "日常购物", "zh-TW": "日常購物", en: "Everyday shopping", fr: "Achats courants" },
  "sponsor.use.shoppingDesc": { "zh-CN": "买点想要的东西，就这么简单", "zh-TW": "買點想要的東西，就這麼簡單", en: "Buy things he wants, plain and simple", fr: "Acheter ce qu'il veut, tout simplement" },
  "sponsor.use.motivation": { "zh-CN": "继续做下去的动力", "zh-TW": "繼續做下去的動力", en: "Motivation to keep going", fr: "La motivation de continuer" },
  "sponsor.use.motivationDesc": { "zh-CN": "有人愿意付钱，说明这东西真的有用", "zh-TW": "有人願意付錢，說明這東西真的有用", en: "Someone paying means it's genuinely useful", fr: "Quelqu'un qui paie, c'est que c'est vraiment utile" },
  "sponsor.way.share": { "zh-CN": "分享给朋友", "zh-TW": "分享給朋友", en: "Share with friends", fr: "Partager avec des amis" },
  "sponsor.way.shareDesc": { "zh-CN": "有人用得上，比什么都实在", "zh-TW": "有人用得上，比什麼都實在", en: "If it helps someone, that matters most", fr: "Si cela aide quelqu'un, c'est l'essentiel" },
  "sponsor.way.star": { "zh-CN": "Star 一下", "zh-TW": "Star 一下", en: "Star the repo", fr: "Mettre une étoile" },
  "sponsor.way.starDesc": { "zh-CN": "在 GitHub 上给项目点个 Star，是最省力的支持", "zh-TW": "在 GitHub 上給專案點個 Star，是最省力的支持", en: "Star it on GitHub — the easiest way to help", fr: "Mettre une étoile sur GitHub — le moyen le plus simple d'aider" },
  "sponsor.way.goRepo": { "zh-CN": "前往仓库", "zh-TW": "前往儲存庫", en: "Open repo", fr: "Ouvrir le dépôt" },
  "sponsor.way.feedback": { "zh-CN": "反馈问题", "zh-TW": "回報問題", en: "Report an issue", fr: "Signaler un problème" },
  "sponsor.way.feedbackDesc": { "zh-CN": "提 Issue 或 PR，帮项目变得更稳", "zh-TW": "提 Issue 或 PR，幫專案變得更穩", en: "Open an issue or PR to make it more solid", fr: "Ouvrez une issue ou une PR pour le rendre plus solide" },
  "sponsor.way.submit": { "zh-CN": "提交反馈", "zh-TW": "提交回饋", en: "Submit", fr: "Envoyer" },
  "sponsor.homepage": { "zh-CN": "项目主页", "zh-TW": "專案首頁", en: "Project home", fr: "Page du projet" },

  // ---- 导航站 ----
  "nav.title": { "zh-CN": "导航站", "zh-TW": "導航站", en: "Site directory", fr: "Annuaire de sites" },
  "nav.back": { "zh-CN": "返回", "zh-TW": "返回", en: "Back", fr: "Retour" },
  "nav.empty": { "zh-CN": "还没有收录站点", "zh-TW": "還沒有收錄站點", en: "No sites yet", fr: "Aucun site pour l'instant" },

  // ---- 管理员 ----
  "admin.title": { "zh-CN": "管理员面板", "zh-TW": "管理員面板", en: "Admin panel", fr: "Panneau d'administration" },
  "admin.users": { "zh-CN": "用户", "zh-TW": "使用者", en: "Users", fr: "Utilisateurs" },
  "admin.announcement": { "zh-CN": "站点公告", "zh-TW": "站台公告", en: "Announcement", fr: "Annonce" },
  "admin.siteSettings": { "zh-CN": "站点配置", "zh-TW": "站台設定", en: "Site settings", fr: "Configuration du site" },
  "admin.footer": { "zh-CN": "页脚与备案", "zh-TW": "頁尾與備案", en: "Footer & ICP", fr: "Pied de page et ICP" },
  "admin.icpText": { "zh-CN": "备案号", "zh-TW": "備案號", en: "ICP number", fr: "Numéro ICP" },
  "admin.icpUrl": { "zh-CN": "备案链接", "zh-TW": "備案連結", en: "ICP link", fr: "Lien ICP" },
  "admin.icpIcon": { "zh-CN": "备案徽章图片地址", "zh-TW": "備案徽章圖片位址", en: "ICP badge image URL", fr: "URL du badge ICP" },
  "admin.footerExtra": { "zh-CN": "页脚额外文字", "zh-TW": "頁尾額外文字", en: "Extra footer text", fr: "Texte de pied de page" },

  // ---- 页脚 ----
  "footer.freeSite": { "zh-CN": "免费聊天站", "zh-TW": "免費聊天站", en: "free chat site", fr: "site de chat gratuit" },
  "footer.by": { "zh-CN": "由", "zh-TW": "由", en: "by", fr: "par" },
  "footer.created": { "zh-CN": "创作", "zh-TW": "創作", en: "created", fr: "créé" },
};

export type DictKey = keyof typeof DICT;

/**
 * 取一条文案。
 *
 * ⚠️ 兜底顺序：目标语言 → 简体 → key 本身。
 * 最后一层不能省 —— 返回空串会让界面出现"看不见的按钮"，
 * 直接显示 key 至少能一眼看出是哪条漏翻了。
 */
export function t(key: string, locale: Locale): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry["zh-CN"] ?? key;
}

/** 词典里实际有多少条，用于自检 */
export function dictSize(): number {
  return Object.keys(DICT).length;
}
