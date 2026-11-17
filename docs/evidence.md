# 证据表（Evidence Table）

> 类别：**据 = evidenced（已核实）** · **推断 = inferred（由证据推出但未直接实测）** · **设 = invented（设计选择 / 假设，未验证）**  
> 用途：支撑 `docs/plan.md` 与课程 `/goal` 声明；任何"推断/设"被证实后，应改写为"据"并提交 Git。

## A. 项目现状（据）

| # | 主张 | 类别 | 证据 / 来源 | 影响 |
|---|------|------|-------------|------|
| A1 | 前端是无构建静态站（importmap + CDN） | 据 | `avatar-live/index.html`（importmap: three / three-vrm / tasks-vision） | 部署可纯静态托管 |
| A2 | 本机 Python 服务承担静态托管、代理与本地能力 | 据 | `avatar-live/server.py`（`/llm` 413、`/tts` 459、memory 313–451、voice 343–374） | 上线需替换为正式后端 |
| A3 | OpenAI 兼容代理指向 OpenCode 网关 | 据 | `server.py` 413 起；转发 `https://opencode.ai/inference/openai/v1/chat/completions` | 香港可用路径 |
| A4 | 浏览器直连 OpenCode 网关会被 CORS 拦截 | 据 | `curl -X OPTIONS` 返回 404 且无 `Access-Control-Allow-Origin`；POST 返回 401 | 必须经后端代理 |
| A5 | Key 只存浏览器 localStorage | 据 | `src/main.js`（`keyStore`、`deepseekKey/geminiKey/opencodeKey`） | BYOK 可行；服务器零 Key 存储 |
| A6 | VRM 模型体积约 71MB | 据 | `du -sh avatar-live/model.vrm` → 71M | 首屏性能风险 |
| A7 | 已具备 PWA 资源 | 据 | `manifest.webmanifest`、`sw.js`、`icon-*.png` | 可做可安装壳 |
| A8 | 本地 TTS 指向 9880 服务 | 据 | `server.py` 第 30 行 `TTS_API=...:9880/tts`；`voice/` 目录 | 仅本机可用，不能直接上线 |
| A9 | 剧情记忆上限 25 条（原型） | 据 | `src/main.js` `saveMemory`（`slice(-25)`） | 记忆策略参考 |
| A10 | 香港不在 Gemini API 可用地区名单内 | 据 | Google 官方 Available regions（2026-10 更新）；网页/App 可用但 API 不可用 | 香港必须走网关 |
| A11 | VRM「破茧」可商用 | 据（用户陈述） | 项目方确认 | 可公网分发角色 |
| A12 | 当前音色为站主本人声音 | 据（用户陈述） | 项目方确认 | 需要授权文件归档；v1 不托管 |

## B. 推断（inferred）

| # | 主张 | 类别 | 依据 | 待验证方式 |
|---|------|------|------|-----------|
| B1 | 71MB 首屏在弱网/移动端体验不可接受 | 推断 | A6 + 常规 Web 性能经验 | 用 4G 限速实测 LCP / 首帧时间 |
| B2 | 香港用户无法使用 Gemini 的语音转写与 TTS | 推断 | A10（地区限制覆盖 API 能力） | 香港网络实测 400 错误 |
| B3 | OpenCode 网关的 gemini 模型支持音频输入 | 推断 | 网关 `/v1/models` 元数据列出 `audio/wav` 等输入 | 用真实 Key 做一次转写请求 |
| B4 | 静态托管 + 轻后端足以承载 Beta 流量 | 推断 | 架构简单、模型计算在第三方 | 压测与成本模拟 |
| B5 | GPU TTS 24/7 成本约 $150–700/月 | 推断 | 云 GPU 公开报价区间 | 询价与实测算力 |

## C. 设计选择 / 假设（设）

| # | 决定 | 类别 | 理由 | 状态 |
|---|------|------|------|------|
| C1 | 公开 Beta、桌面优先、iOS 排除 | 设 | `getDisplayMedia` 在 iOS 不可用 | 已确认 |
| C2 | 正式版 BYOK | 设 | 零模型成本、无账号体系 | 已确认 |
| C3 | v1 统一系统音色，不做 GPU TTS | 设 | 成本与运维 | 已确认 |
| C4 | 剧情记忆用 localStorage（不同步） | 设 | 零存储成本、隐私简单 | 已确认 |
| C5 | 海外直连 Gemini；香港走网关 | 设 | A10 + 成本/延迟 | 已确认 |
| C6 | Turnstile 保护 `/api/*`（一次验证换 cookie） | 设 | 防代理滥用 | 已确认（未实现） |
| C7 | 服务器不保存 Key / 截图 / 音频 / 聊天原文 | 设（红线） | 隐私最小化 | 需在实现与日志中验证 |
| C8 | 记忆上限沿用 25 条 | 设 | 原型行为 | 可调 |

## D. 与计划的映射

| 计划阶段 | 依赖证据 |
|----------|----------|
| P0 合规 / Turnstile | A10、C6 |
| P1 后端代理 / 音频 | A3、A4、B3 |
| P2 前端生产化 | A1、A6、A7、B1 |
| 语音方案 | A8、A12、B2、C3 |
| 记忆方案 | A9、C4 |

## E. 复核记录

| 日期 | 复核人 | 变更 |
|------|--------|------|
| 2026-11-18 | 课程项目组 | 初版：依据 `docs/plan.md` 与仓库实测 |
