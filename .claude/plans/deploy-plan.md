# 部署方案：Cloudflare Workers + Static Assets

## 思路
用 Cloudflare Workers Static Assets 功能，让一个 Worker 同时服务前端静态文件和 API 接口。

## 步骤

### 1. 配置 wrangler.toml 添加 static assets
在 wrangler.toml 中添加 `[assets]` 配置，指向前端目录 `src/frontend`。

### 2. 修改 Worker 路由逻辑
- `/api/*` → 走现有 API 逻辑
- 其他所有请求 → Cloudflare 自动从 assets 返回静态文件（index.html, style.css, app.js）

因为 assets 配置会让 Cloudflare 自动处理静态文件，Worker 只需要处理 `/api/*` 路径。需要在 wrangler.toml 里设置 `[assets] binding = "ASSETS"` 和路由。

### 3. 前端 API_BASE 改为相对路径
`app.js` 中 `const API_BASE = 'http://localhost:8787'` → `const API_BASE = ''`（空字符串 = 同域）。本地开发时需要保留 localhost，所以用环境判断。

### 4. 部署
```bash
wrangler secret put ANTHROPIC_API_KEY   # 设置密钥
wrangler deploy                          # 部署
```

### 5. 验证
部署后访问 `https://evidence-family-doctor.<你的子域名>.workers.dev`

## 关键文件改动
- `wrangler.toml` — 添加 [assets] 配置
- `src/worker/index.ts` — 路由中 default case 移除 404（让 assets 处理）
- `src/frontend/app.js` — API_BASE 改为自适应
