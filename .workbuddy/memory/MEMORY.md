# allsoft.asia 项目长期记忆

## 项目事实
- Cloudflare Pages 免费套餐，根目录即构建输出目录（`pages_build_output_dir = "."`），functions/ 下 Pages Functions + D1（VISITORS_DB）
- 部署命令：`npx wrangler pages deploy . --branch main`（wrangler 已登录本机）
- 仓库：github.com/ugo2000/allsoft.asia，双机协作协议见 SYNC.md，本机 device = pc-yotk

## Markdown for Agents（2026-10-21 上线）
- `functions/_middleware.js` 应用层实现内容协商：`Accept: text/markdown` → markdown 版页面（YAML frontmatter + 正文 + JSON-LD 块），浏览器照常 HTML
- CF 原生 Markdown for Agents 需 Pro/Business，免费套餐必须自己实现
- 转换器零依赖内置在中间件，单测 `node --test test/markdown-negotiation.test.mjs`（25 条）
- isitagentready.com 扫描 markdownNegotiation: pass，站点 Level 3「Agent-Readable」

## 旗下产品清单（2026-10-23 共 7 款，全部已上线）
1. ChatHub 在线聊天 — chathub.asia — `/products/chathub`
2. 魔鬼代言人 · AI 决策质检 — MCP/REST，USDT(TRC20) — `/products/devils-advocate`
3. TradeCN · 全球外贸询盘 — tradecn.asia — `/products/tradecn`
4. **smallfigure · 原创素材图鉴 — smallfigure.com — `/products/smallfigure`**
5. 科幻中国象棋 — `/games/neon-xiangqi/`
6. 霓虹突袭 NEON STRIKE — `/games/neon-strike/`
7. 汉字解锁 · 学汉字 — `/apps/hanzi-demo.html`

### smallfigure 素材图鉴（2026-10-23 加入集合站）
- 独立站 smallfigure.com，原创手绘素材：人物立绘 / 武器装备 / 动物 / 徽章，全透明背景 PNG
- 素材数据源 `https://www.smallfigure.com/data/images.json`（实测 30 件：立绘 18、武器 6、动物 3、徽章 3），尺寸 512 & 1024
- 站点中英双语；筛选（分类/尺寸/体积）+ 名称搜索 + 灯箱下载；Pages Functions + D1 记下载计数
- **授权条款站内未写明**：集合站文案只能写"站内免费浏览下载，商用/再分发需先联系谈条款"，禁止编造 CC0 等许可

## 部署与安全教训
- **`.assetsignore` 对 `wrangler pages deploy` 无效**（点文件不上传），内部文件防泄露靠中间件请求层拦截（/.workbuddy、*.py、*.bat 等 → 404），已实装
- 曾发生 `.workbuddy/memory/SYNC.md`（含手机号）线上可读，已修复；新部署后应抽查内部路径
- HTML 经 Function 响应后 Cache-Control 变为 `max-age=0, must-revalidate`（动态响应不占静态缓存），属预期

## 待办
- **git push 待恢复**：本机 GitHub 凭证全失效（GCM 空 / gh keyring invalid / SSH 未注册 / connector 403）。U 哥执行一次 `gh auth login`（gh 位于 `C:\Users\Administrator\AppData\Local\gh-cli\bin\gh.exe`，不在 PATH）后，`git push origin main` 同步本地 commit ba4c2de + 84d0d25 + 83b88fb + 66c0166
