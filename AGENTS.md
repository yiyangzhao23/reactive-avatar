# AGENTS.md

## 项目概览

桌面优先的 3D 虚拟角色（VRM「破茧」）：摄像头 + 屏幕共享感知，BYOK 调用 Gemini / DeepSeek / OpenCode，支持对话、语音、屏幕分析与剧情记忆。

可选 **Gemini Live 实时模式**：浏览器 WebSocket 直连 Live API，麦克风 PCM16 流 + 共享屏幕 1fps 帧 + 原生音频输出；需要 Gemini Key（香港可能受区域限制）。

- 前端：无构建的浏览器 ESM（importmap + CDN），入口 `avatar-live/index.html`
- 本地服务：`avatar-live/server.py`（静态托管、`/llm`、`/tts`、`/voice`、`/memory`）
- 部署：GitHub `main` → Cloudflare Pages，根目录 `avatar-live`，构建 `node build.js`，输出 `dist`
- 线上：https://reactive-avatar.pages.dev

## 必跑检查（< 1s）

每次修改后必须运行：

```bash
./scripts/check.sh
```

推送 / 部署前再跑一次完整门禁（额外执行构建，约 0.3s）：

```bash
./scripts/check.sh --full
```

检查内容：
- 所有 JS：`node --check`（语法解析，含 ESM、Pages Function、Service Worker）
- `server.py`：`python3 -c "import ast; ast.parse(...)"`（不写 `__pycache__`）
- `index.html` 必须引用 `src/main.js`
- `model-parts/manifest.json`（若存在）必须是合法 JSON

> 本项目未使用 TypeScript / Vite / ruff / mypy，因此不适用上面的工具链；上述门禁等价且更快。
> Node 不在 PATH 时，脚本会自动使用 `~/.local/node/bin/node`。

## 测试（单元 / 集成）

```bash
./scripts/test.sh        # Vitest + pytest（约 2–3s）
```

单独运行：

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm test                 # tests/js：模型切分、/llm Function、manifest 对齐
uv run pytest -q         # tests/python：记忆、HTTP 接口、证据边界、跨文件对齐
```

覆盖范围：
- **程序逻辑**：模型切分（大小/哈希/清单/旧分片清理）、`/llm` 代理（缺 Key/超大请求/上游状态透传）、manifest 与分片对齐
- **后端接口**：SQLite 记忆增删查清、静态页、`/tts` 参数校验、`/memory` HTTP 往返
- **历史证据边界**：`docs/evidence.md` 每行必须是「据 / 推断 / 设」；A 类必须有可追溯来源（文件/命令/官方来源/项目方确认）；`docs/*.md|html` 不得出现未来日期（年代防穿越）
- **跨文件 ID 对齐**：前端 `?v=` 版本、PWA 缓存名、Pages Function 上游地址、计划/证据/目标互相引用
- **可选 LLM-as-a-Judge**：`docs/judge-rubric.md` + `scripts/judge.py <transcript.jsonl>`（需 `OPENCODE_API_KEY`，无 Key 不发送任何数据）

依赖：Vitest 由 `npm i -D vitest` 安装；Python 侧用 `uv add --dev pytest httpx`。`.venv/`、`node_modules/` 已在 `.gitignore`。

## 端到端（Playwright）

首次安装内核（一次）：

```bash
npx playwright install chromium
```

运行：

```bash
npm run test:e2e        # 本地：自动启动/复用 server.py（8017）
npm run test:e2e:live   # 线上冒烟：BASE_URL=https://reactive-avatar.pages.dev
./scripts/test.sh --e2e # 单元 + 集成 + 本地 E2E
```

- `opencode.json` 已配置 `@playwright/mcp`（`npx -y @playwright/mcp@latest`），重启 opencode 后生效；agent 可自行读取 DOM、控制台、404 与截图。
- 覆盖：模型加载、资源 404/控制台错误、聊天本地回退、语言切换、分析前提示、摄像头开关（假设备）。
- 线上冒烟：同一套用例 + `/llm` 无 Key 401。
- 摄像头/麦克风用 fake device；**屏幕共享不做自动化**（需人工选择窗口）。

## 修改后约定

1. **改 JS/CSS 要升版本号**：`avatar-live/index.html` 中 `src/main.js?v=NN`；被改文件的 import 版本（如 `avatar.js?v=NN`）也要加一，避免 Pages CDN 命中旧文件。
2. **改 Service Worker 要升缓存**：`avatar-live/sw.js` 的 `CACHE = 'reactive-avatar-vN'`。
3. **换模型**：
   ```bash
   cd avatar-live
   # 替换 model.vrm 后
   node split-model.js          # 生成哈希命名分片（本机 + dist）
   node split-model.js --watch  # 或监听变化自动重切
   ```
   分片必须 <25MiB（Cloudflare Pages 单文件限制）；manifest 会记录 sha256。
4. **不要提交**：`.gsv/`、`model-parts/`、`dist/`、`memory.db`、Key、`voice/cache/`（`.gitignore` 已覆盖）。
5. **不要用 `git add -A`**：仓库根目录还有其他课程资料（`plague_presentation/`、`week-07/`、`week-09/` 等）未纳入本项目，只添加本次改动的文件。
6. **Key 只存在浏览器**（BYOK）；不得写入代码、日志或提交记录。服务器代理只透传、不落库。
7. **决策变更要回写文档**：`docs/plan.md`（计划与 Non-goals）、`docs/evidence.md`（据/推断/设）。

## 常用命令

```bash
# 本地开发（Python 服务，端口 8017）
cd avatar-live && python3 server.py

# 静态构建（部署同款）
cd avatar-live && node build.js

# 本地无头渲染冒烟（macOS）
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader \
  --hide-scrollbars --window-size=1400,900 --virtual-time-budget=60000 \
  --user-data-dir=/tmp/avatar-smoke --screenshot=/tmp/avatar-smoke.png \
  http://127.0.0.1:8017/

# 推送即部署（Cloudflare Pages 自动构建）
git push origin main
```

## 关键文件

| 路径 | 作用 |
|---|---|
| `avatar-live/src/main.js` | UI、对话流程、TTS、鼠标交互、记忆 |
| `avatar-live/src/brain.js` | 模型路由与提示词（Gemini / DeepSeek / OpenCode） |
| `avatar-live/src/avatar.js` | VRM 加载、表情、待机动作、构图 |
| `avatar-live/src/perception.js` | 摄像头、屏幕共享、MediaPipe |
| `avatar-live/src/voice.js` | 录音与语音转写 |
| `avatar-live/src/live.js` | Gemini Live WebSocket：麦克风 PCM、屏幕帧、原生音频播放 |
| `avatar-live/src/main.js` | 模型设置弹窗；Key 仅页面内存 |
| `avatar-live/server.py` | 本地开发服务（含 `/llm` 代理、本地 TTS） |
| `avatar-live/build.js` | 生成 `dist/`、安全头、模型分片 |
| `avatar-live/split-model.js` | 模型切分（哈希命名，支持 `--watch`） |
| `avatar-live/functions/llm.js` | 线上 Pages Function（旧 OpenCode 代理） |
| `avatar-live/functions/api/chat.js` | 线上 Pages Function：OpenAI/Gemini/DeepSeek/OpenRouter/自定义 BYOK 代理 |
| `docs/` | 计划、证据表、目标声明、架构与流程图 |
