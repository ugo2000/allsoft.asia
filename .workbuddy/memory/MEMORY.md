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

## 部署与安全教训
- **`.assetsignore` 对 `wrangler pages deploy` 无效**（点文件不上传），内部文件防泄露靠中间件请求层拦截（/.workbuddy、*.py、*.bat 等 → 404），已实装
- 曾发生 `.workbuddy/memory/SYNC.md`（含手机号）线上可读，已修复；新部署后应抽查内部路径
- HTML 经 Function 响应后 Cache-Control 变为 `max-age=0, must-revalidate`（动态响应不占静态缓存），属预期

## 待办
- **git push 待恢复**：本机 GitHub 凭证全失效（GCM 空 / gh keyring invalid / SSH 未注册 / connector 403）。U 哥执行一次 `gh auth login`（gh 位于 `C:\Users\Administrator\AppData\Local\gh-cli\bin\gh.exe`，不在 PATH）后，`git push origin main` 同步本地 commit ba4c2de + 84d0d25
