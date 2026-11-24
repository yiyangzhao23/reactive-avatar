# main.tex Outline · Reactive Avatar

**Target:** 2,100–2,300 English words · 4–5 PDF pages · XeLaTeX + Biber
**Thesis:** A believable real-time virtual companion should be designed as an
*auditable interface*, not as a person: it should show what it captures, what it
remembers, and what it cannot understand.

**Core conversation:** Weizenbaum 1966 (illusion of understanding) + Agre 1994
(capture) + Bender et al. 2021 (stochastic parrots / believable mimicry).
**Design contribution:** *auditable companionship* — synthetic label, perception
ledger, pause control, bounded memory, and uncertainty-preserving language.

---

## Abstract · 120–150 words

- One sentence: the project is a real-time 3D companion with camera, screen,
  voice, memory, and browser tools.
- One sentence: the research question is how to keep anthropomorphic illusion
  and data capture visible and contestable.
- One sentence: the method is a design prototype + three-part scholarly frame
  (ELIZA / capture / stochastic parrots).
- One sentence: contribution is an interaction pattern, not a new model.
- One sentence: evidence = live Cloudflare deployment, automated tests, and
  (pending) two external playtests.

## 1. Historical Question and Medium · 250–320 words

**Purpose:** establish the cultural problem and justify an interactive medium.

- Open with the lineage: ELIZA (1966) → voice assistants → real-time 3D
  companions; the fantasy is not new, but the sensing and memory are.
- Research question: *When a virtual character sees your face, remembers your
  words, and speaks in a human voice, how can it remain an interface you can
  inspect rather than a person you over-trust?*
- Why not an essay/film: the argument is about a loop — perception → model →
  expression/voice → memory → next perception. A static text can describe it but
  cannot let a reader feel the capture, the latency, the interruption, or the
  pause.
- State the intervention: synthetic label, perception ledger, pause, bounded
  memory, uncertainty language.
- Preview the three scholars and the contribution (auditable companionship).
- No citations needed here except perhaps one framing citation; keep it light.

## 2. Sources and Scholarly Conversation · 500–600 words

**Purpose:** primary materials + exactly three scholarly works, with locators.

### 2.1 Primary materials and their limits (100–130 words)

- The prototype itself (`avatar-live/`), `docs/plan.md`, `docs/evidence.md`,
  `docs/architecture-explainer.html`, `paper/evidence.csv`, test logs, and the
  live URL.
- Limits: the prototype is not a historical archive; model outputs are
  non-deterministic; there is no completed external user study yet; code changes
  over time, so cite commit/URL and date.
- Distinguish `据 / 推断 / 设` explicitly; the evidence table carries locators.

### 2.2 Weizenbaum: the illusion of understanding (120–150 words)

- ELIZA’s keyword/reassembly rules and the Rogerian script.
- Quote: “illusion of understanding” and “vestments of plausibility” (p. 42).
- Quote: the test of understanding is drawing valid conclusions, not continuing
  a conversation; ELIZA discards its inputs (p. 43).
- Design response: the 3D body, voice, and gaze are new vestments; the synthetic
  label and uncertainty language are deliberate counter-design.
- Cite after punctuation: `...credibility.\autocite[42]{weizenbaum1966eliza}`

### 2.3 Agre: capture, not surveillance (140–170 words)

- Surveillance = visual/Big Brother; capture = linguistic grammar of action that
  reorganizes activity so a computer can track it (pp. 743–750 reprint).
- Quote: a system can only track what it can capture, and only what fits the
  imposed grammar (p. 750).
- Map to the prototype: face detected, center/left/right, smile score, blink
  score, screen sharing, brightness; this is a grammar, not “seeing.”
- Design response: perception ledger displays the grammar; pause stops new
  observations; no claim of neutral vision.
- Cite: `...imposed grammar.\autocite[750]{agre1994surveillance}`

### 2.4 Bender et al.: form, meaning, and mimicry (140–170 words)

- LLMs manipulate linguistic form, not NLU (p. 610).
- Humans impute meaning where there is none (p. 611).
- Believable mimicry of humans is an ethical bright line (p. 619).
- Map to the prototype: fluent one-line replies, voice, memory list; the risk is
  not “the model knows me” but “I treat the form as a person.”
- Design response: synthetic label, bounded 25-item memory, “I don’t have a
  record” language, no emotional claims.
- Cite: `...mimicry.\autocite[610–611, 619]{bender2021parrots}`

### 2.5 Synthesis (60–80 words)

- The avatar layers three critiques: conversation illusion + capture + synthetic
  mimicry. The contribution is to make all three visible in one interface.
- This sets up Section 3’s architecture and Section 4’s evidence table.

## 3. Architecture and Boundaries · 350–420 words + figure

**Purpose:** explain the technical stack and the limits that protect the design.

- Three layers:
  1. Browser: Three.js + VRM, MediaPipe face landmarks, screen capture,
     Web Audio, hand-free speech, viseme/gesture, perception ledger.
  2. Local/edge: Python stdlib `/api/chat` for local dev; Cloudflare Pages
     Function `/api/chat` for production; model settings are memory-only.
  3. Models: OpenAI / Gemini / DeepSeek / OpenRouter / custom; Gemini Live
     (16 kHz PCM in, 24 kHz PCM out, JPEG ≤1 fps); GPT-SoVITS local-only voice.
- Deployment: `node build.js` → `dist/`; VRM split into four <25MiB hash-named
  parts; Cloudflare Pages + Pages Function; live URL.
- Boundaries:
  - No server-side key storage; no key in logs; no chat/audio/screenshot
    persistence in production.
  - No cross-device memory; SQLite memory is local and expirable.
  - No hosted voice cloning; local GPT-SoVITS only; consent required.
  - Browser automation is allowlisted and requires confirmation for clicks; no
    full desktop/mouse/keyboard control.
  - Region/model availability (Gemini API restrictions) and preview status.
- Figure: `schematic.png` (architecture + interaction flow).
- One sentence on what the architecture deliberately does *not* do, to avoid
  overclaiming.

## 4. Evidence Table · 100–140 words + table

- Explain the CSV schema: `claim,evidence,locator,level,limit`.
- Explain the generator: `paper/make_evidence_table.py` reads `evidence.csv` and
  writes `evidence-table.tex`; no hand-typed LaTeX rows.
- Current table: 11 rows; `据` = documented, `推断` = inferred, `设` = design
  invention.
- Point to 2–3 representative rows: Weizenbaum p. 42; Agre pp. 743–750; VRM split
  manifest; gesture heuristic as `设`.
- State the limit: the table records evidence boundaries, not proof of user
  impact.
- Include `\input{evidence-table.tex}` in the table environment.

## 5. Verification and Playtesting · 350–420 words

**Purpose:** show what the tests prove and turn external feedback into
permanent tests.

### 5.1 Automated layers (150–180 words)

- Static gate: `./scripts/check.sh --full` — syntax, imports, build, manifest.
- Unit: Vitest 10 passed — model split/hash/manifest, Pages Function `/api/chat`
  missing key / custom URL / Gemini `response_format`, old parts cleanup.
- Integration: pytest 15 passed — static page, `/api/chat` 400, TTS parameter
  validation, SQLite memory roundtrip, evidence lint (`据/推断/设`, sources, no
  future dates), cross-file IDs/versions/PWA cache.
- E2E: Playwright 10 passed locally + 1 live smoke — model loads, zero 404/console
  errors, chat fallback, language switch, camera fake device, model settings
  memory-only and clears on reload; live URL + `/api/chat` 401.
- State what is **not** tested: real camera/screen sharing, real model quality,
  TTS naturalness, long-session memory.

### 5.2 External playtesting (160–200 words)

- Tester A, first-time visitor: could not tell what to do, what permissions were
  needed, or what would be uploaded. Fix: dismissible "30 seconds" panel with the
  loop, permissions, model routing, local SQLite memory, retention, and delete
  controls. Regression test: onboarding quick start.
- Tester B, desktop user: could not tell whether the avatar was listening,
  thinking, or speaking, and wanted a way to stop/mute media. Fix: voice-state
  badge (idle/listening/thinking/speaking/muted), mute button, media in-use line,
  stop camera/screen control, and a "still working" message after one second.
  Regression tests: media in-use/stop and mute state.
- Source: `docs/user-feedback.md`. No real screen-share automation, no claim of
  general usability from two testers.

### 5.3 What the tests mean (40–60 words)

- Tests verify code behaviour and source boundaries; they do not prove historical
  truth or user trust. That distinction is the point.

## 6. Post-Mortem · 350–420 words

Four numbered points required by the template:

1. **What worked**
   - Static-first deployment; local fallback; split model parts; Playwright MCP
     reading DOM/console/404; evidence lint; model settings memory-only.
2. **What failed / drifted, and fixes**
   - 71MB VRM vs Cloudflare 25MiB: compression broke texture/material indices;
     fixed by 4 hash-named <25MiB parts + manifest + tests.
   - CORS: browser direct to OpenCode/Gemini gateway blocked; fixed with Pages
     Function `/api/chat`; tests 401/413/upstream.
   - Local TLS: `CERTIFICATE_VERIFY_FAILED`; fixed with `certifi`/SSL context.
   - Playwright live smoke: system proxy reset `*.pages.dev`; fixed by
     `--proxy-server=direct://` in test config.
   - Model default drift: `gemini-2.0-flash` → `gemini-2.5-flash` →
     `gemini-3.8-flash`; exposed by a real API error; added “测试连接”.
3. **What changed**
   - From fixed voice/local prototype to model settings + `/api/chat` + Gemini
     Live + SQLite memory + PWA + browser tools.
   - From “more human” to “more auditable.”
4. **Remaining limits and AI tools**
   - No completed two-user study yet; no Turnstile/rate limit on production;
     API key in page memory but direct browser/edge path; no full desktop
     control; no hosted voice cloning; region/model availability.
   - AI tools: OpenCode for planning/coding/tests; Gemini/DeepSeek/OpenRouter/
     OpenAI-compatible models for replies; GPT-SoVITS for local voice;
     Playwright/MCP for browser inspection.

## Final sentence

The project does not claim that 小可 understands or feels. It claims that a
companion can be built so that its illusions and captures remain visible — and
that this is a better design goal than “more human.”

---

## Citation placement checklist

- `\autocite[42]{weizenbaum1966eliza}` after the sentence, not before punctuation.
- `\autocite[43]{weizenbaum1966eliza}` for the understanding test.
- `\autocite[743--750]{agre1994surveillance}` for capture; `[750]` for the quote.
- `\autocite[610--611]{bender2021parrots}` for form/meaning; `[619]` for mimicry.
- `\autocite{reactiveavatar2026}` for the live URL/repo, never as scholarly
  evidence.
- Check every page locator against the PDFs before submitting.

## Word budget

| Section | Words |
|---|---:|
| Abstract | 120–150 |
| 1 Historical Question & Medium | 250–320 |
| 2 Sources & Scholarly Conversation | 500–600 |
| 3 Architecture & Boundaries | 350–420 |
| 4 Evidence Table | 100–140 |
| 5 Verification & Playtesting | 350–420 |
| 6 Post-Mortem | 350–420 |
| **Total** | **2,020–2,470** |
