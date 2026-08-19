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

## 部署
1. 推送到 GitHub
2. Cloudflare Pages 连接仓库
3. 绑定 allsoft.asia 域名
