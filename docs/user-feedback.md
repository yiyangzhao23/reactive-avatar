# External Playtest Feedback · Reactive Avatar

**Date:** 24 November 2026  
**Live URL:** https://reactive-avatar.pages.dev  
**Method:** two external testers used the live URL on their own devices; feedback
was summarised by the project owner. No personal data or recordings were saved.

## Tester A · first-time onboarding

**Task:** open the live URL without instructions; decide what to do next.

**Finding:** “首次进入要让用户在 30 秒内知道‘能做什么、要什么权限、会发生什么’。现在 About 偏概念和技术说明，首次用户可能不知道该怎么玩。”

**Fix**

- Added a dismissible **30 秒开始 / Start in 30 seconds** panel above the controls:
  - turn on the camera or share the screen → speak or type → watch the response;
  - camera/screen are analysed locally; observations, screenshots, and text go
    to the selected model provider when needed;
  - the server does not save or log them;
  - memory is local SQLite, 30 days by default, and can be cleared;
  - model choices: OpenAI / Gemini / DeepSeek / OpenRouter / custom.
- Kept the longer **About** footer for the historical and `据 / 推断 / 设` framing.

**Regression test**

- `tests/e2e/app.spec.js` → `first-time quick start explains permissions and can be dismissed`

## Tester B · state and exit

**Task:** use camera, voice, mute, and stop controls; decide whether the avatar is
listening, thinking, or speaking.

**Finding:** “实时语音和摄像头需要‘状态感’和‘可退出感’：显示监听中 / 思考中 / 说话中 / 已静音；支持打断、静音、切换到文本兜底；延迟超过 1 秒给‘正在处理’反馈；摄像头和屏幕要有明显的使用指示和随时停止按钮。”

**Fix**

- Added a live **voice state badge**: 待机 / 监听中 / 思考中 / 说话中 / 已静音.
- Added a **mute** button; muting stops TTS and voice input but keeps text chat.
- Added a **stop camera/screen** control and a persistent media status line.
- Existing barge-in stops speech when the user starts talking; text chat remains
  available as fallback.
- Slow requests update the thinking line to **正在处理…** after one second.

**Regression tests**

- `tests/e2e/app.spec.js` → `camera in-use state and stop-media control`
- `tests/e2e/app.spec.js` → `mute shows a muted state and restores idle`

## What is still not covered

- Real screen sharing (the browser needs a human to choose a window).
- Real camera quality, TTS naturalness, and long-session memory.
- A larger usability study; two testers are the course minimum, not a claim of
  general usability.
