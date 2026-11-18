# AGENTS.md

## 项目概览

桌面优先的 3D 虚拟角色（VRM「破茧」）：摄像头 + 屏幕共享感知，BYOK 调用 Gemini / DeepSeek / OpenCode，支持对话、语音、屏幕分析与剧情记忆。

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
| `avatar-live/server.py` | 本地开发服务（含 `/llm` 代理、本地 TTS） |
| `avatar-live/build.js` | 生成 `dist/`、安全头、模型分片 |
| `avatar-live/split-model.js` | 模型切分（哈希命名，支持 `--watch`） |
| `avatar-live/functions/llm.js` | 线上 Pages Function（BYOK 代理） |
| `docs/` | 计划、证据表、目标声明、架构与流程图 |
