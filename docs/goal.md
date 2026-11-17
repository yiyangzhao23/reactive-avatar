# /goal 声明模板（课程展示 / 执行）

> 用法：在 OpenCode 中提交 `/goal <目標>` 时，把下列内容作为目标正文（或引用本文件）。
> 本文件绑定：计划 `docs/plan.md`、证据表 `docs/evidence.md`、视觉示意 `docs/architecture-explainer.html`。

## 1. 目标（Goal）

**在公开 Beta 形态下上线 Reactive Avatar 桌面 Web 版**：香港与海外用户可用（BYOK），具备 3D 角色实时反应、打字/语音聊天、屏幕分析、剧情记忆（本地）、系统语音；完成 Turnstile 反滥用、后端代理、PWA 版本化与合规基础。

## 2. 边界（Non-goals，摘录）

- 不做移动端 / iOS 屏幕共享
- 不做账号、支付、订阅（BYOK）
- 服务器不保存 Key / 截图 / 音频 / 聊天原文
- 不自建 GPU TTS、不开放用户自传音色
- 不做服务端跨设备记忆
- 不做中国大陆直连可用性承诺

## 3. 计划绑定（Plan Binding）

| 阶段 | 交付物 | 验收标准 |
|------|--------|----------|
| P0 基础与法务 | 域名/HTTPS、隐私政策、同意弹窗、安全头、Turnstile widget | 无同意不开启摄像头/屏幕；`/api/*` 未验证不可用 |
| P1 后端与 Key 路径 | `/api/session`、`/api/llm`、`/api/stt`、限流 | 香港网络可走网关完成对话/看图/转写；Key 不落库不落日志 |
| P2 前端生产化 | 模型分片、PWA 版本化、错误处理、监控 | 每个模型分片 <25MiB 且可完整加载；弱网/无 Key 有降级 |
| P3 兼容与 QA | 桌面矩阵、滥用测试 | Chrome/Safari/Edge × macOS/Windows 通过 |
| P4 Beta 发布 | 灰度 → 公开、告警、回滚 | 回滚演练一次；上线检查清单全绿 |

详见 `docs/plan.md`。

## 4. 证据绑定（Evidence Binding）

- 现状与外部约束见 `docs/evidence.md`（A 据 / B 推断 / C 设）
- **规则**：新的"据"必须先写入证据表并注明来源；"推断/设"被验证后升级为"据"；被推翻则修改计划
- 课堂展示引用：A1–A12（现状/外部限制）、B1–B5（待验证）、C1–C8（已确认设计）

## 5. 可执行测试命令（Test Commands）

> 前提：本地开发服务器已启动（`cd avatar-live && python3 server.py`，端口 8017）。  
> 失败即视为该阶段未完成。

### 5.1 冒烟

```bash
curl -s -o /dev/null -w 'index: %{http_code}\n' http://127.0.0.1:8017/
curl -s -o /dev/null -w 'main:  %{http_code}\n' 'http://127.0.0.1:8017/src/main.js?v=39'
```

期望：两行均为 `200`。

### 5.2 代理安全（未带有效 Key 必须拒绝）

```bash
curl -s -o /tmp/llm.json -w 'llm: %{http_code}\n' -X POST http://127.0.0.1:8017/llm \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer test' \
  -d '{"model":"gemini-3.5-flash-lite","messages":[{"role":"user","content":"hi"}]}'
```

期望：`401`（上游拒绝伪造 Key；不得出现 200）。

### 5.3 本地 TTS（仅开发模式）

```bash
curl -s -o /tmp/tts.wav -w 'tts: %{http_code} %{content_type}\n' \
  'http://127.0.0.1:8017/tts?lang=zh&text=%E4%BD%A0%E5%A5%BD'
```

期望：`200 audio/wav`。（公网 v1 不使用该端点）

### 5.4 资源体积（优化目标）

```bash
for f in avatar-live/model-parts/*.bin avatar-live/dist/model-parts/*.bin; do [ -f "$f" ] && du -h "$f"; done
cat avatar-live/model-parts/manifest.json   # 换模型后先运行 node split-model.js
```

期望：每个分片 <25MiB；manifest 的 `parts` 与实际分片数一致（当前 4 片，总计约 75MB）。

### 5.5 无头渲染冒烟（macOS）

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader \
  --hide-scrollbars --window-size=1400,900 --virtual-time-budget=40000 \
  --user-data-dir=/tmp/avatar-smoke --screenshot=/tmp/avatar-smoke.png \
  http://127.0.0.1:8017/ && ls -lh /tmp/avatar-smoke.png
```

期望：截图文件生成且体积 >200KB（角色已渲染；过小通常代表模型未加载）。

### 5.6 泄露检查（人工复核）

```bash
grep -rn "Authorization" avatar-live/src avatar-live/server.py
grep -rniE "console\.(log|info).*(key|token)" avatar-live/src
```

期望：无把 Key/token 写入日志的代码；代理透传处不打印凭证。

### 5.7 Turnstile（P1 完成后）

```bash
# 未建 session 直接调用 → 必须拒绝
curl -s -o /dev/null -w 'api-no-session: %{http_code}\n' \
  -X POST http://127.0.0.1:8017/api/llm -H 'Content-Type: application/json' \
  -d '{"model":"gemini-3.5-flash-lite","messages":[{"role":"user","content":"hi"}]}'
```

期望：`401/403`。测试 key：site `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA`。

## 6. 角色分工（可选）

若拆分研究与开发：

- `researcher`（只读）：查证外部限制、维护 `docs/evidence.md`
- `developer`（可写代码）：按 `docs/plan.md` 实施；每次实施后运行第 5 节命令

建议配置文件：`.opencode/agents/researcher.md`、`.opencode/agents/developer.md`（未创建，按需添加）。

## 7. Definition of Done

- [ ] P0–P4 验收标准全部达成
- [ ] 第 5 节命令全部符合期望
- [ ] `docs/evidence.md` 无未标注类别的结论
- [ ] 已确认事实写回文档并提交 Git
