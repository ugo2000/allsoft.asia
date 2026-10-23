# AllSoft.asia

AI驱动的智能软件解决方案 - 静态多页网站

## 技术栈
- 纯 HTML/CSS/JS（无框架依赖）
- Cloudflare Pages 托管
- GitHub 版本控制
- chathub.asia 通过 iframe 集成

## 页面结构
- `index.html` - 首页
- `products.html` - 产品
- `products/smallfigure.html` - smallfigure 原创素材图鉴
- `chat.html` - 在线聊天（iframe嵌入chathub.asia）
- `pricing.html` - 定价
- `faq.html` - 常见问题
- `blog.html` - 博客列表
- `blog/` - 博客文章
- `about.html` - 关于
- `contact.html` - 联系
- `privacy.html` - 隐私政策
- `terms.html` - 服务条款
- `404.html` - 404页面

## SEO/GEO
- 每页独立 meta 标签（title/description/keywords）
- Open Graph + Twitter Card
- JSON-LD 结构化数据（Organization/WebSite/Article/FAQPage/BreadcrumbList/HowTo）
- sitemap.xml
- robots.txt（允许AI爬虫）
- llms.txt（GEO优化）
- **Markdown for Agents**：`Accept: text/markdown` 内容协商（见下）

## Markdown for Agents（AI 智能体优化）

`functions/_middleware.js` 实现内容协商：请求带 `Accept: text/markdown` 头时返回 markdown 版页面，浏览器和不带该头的请求照常拿 HTML。

- 输出结构：YAML frontmatter（title/description/image）+ 正文 markdown + 末尾 JSON-LD `json` 代码块
- 响应头：`Content-Type: text/markdown; charset=utf-8`、`Vary: Accept`、`x-markdown-tokens`（估算 token 数）、`content-signal`
- 转换器零依赖（`functions/_middleware.js` 内），Workers 运行时和 Node 通用
- 单测：`node --test test/markdown-negotiation.test.mjs`（25 条：转换器 + 中间件 + 全站页面冒烟）
- 中间件同时拦截内部文件路径（`.workbuddy`、`*.py`、`*.bat` 等）返回 404，防部署泄露
- 参考：Cloudflare Markdown for Agents 免费套餐不自带，故应用层实现

```bash
curl -H "Accept: text/markdown" https://allsoft.asia/products
```

## 部署
1. 推送到 GitHub
2. Cloudflare Pages 连接仓库
3. 绑定 allsoft.asia 域名
