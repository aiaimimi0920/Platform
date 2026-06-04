# Gemini 三实现线重构 MASTER

## 第一百五十八轮结果：第三条线的 `image` 也移除了 residual JSON bypass，strict runtime fresh full live 再次全绿

这轮继续只做 `gemini canvas web reverse / program-owned / no-key`，不碰已冻结的 `gemini web reverse`。目标不是再扩新能力，而是按用户重新确认过的第三线标准，把最后一个“虽然不是聊天框，但还不够纯”的 residual fallback 切掉：

- `program-owned image`
- `StreamGenerate`
- `image JSON fallback`

### 1. 本轮真正起作用的改动

1. `gateway/src/upstream/client.rs`
   - `GeminiCanvasDirectHttpImageJsonPolicy::from_request(...)`
   - 对 `gemini_canvas_program_web_reverse_compatible`：
     - `fallback_enabled` 现在也被彻底关掉
   - 这意味着 program-owned `image`：
     - 不再允许在 `StreamGenerate` 失败后退到纯 HTTP `image JSON` lane

2. `gateway/src/upstream/client.rs`
   - 删除了旧的：
     - `gemini_canvas_program_no_key_generate_content_fetch_mode(...)`
   - 因为在当前更严格的第三线定义下，这个 helper 已不再表达真实主线语义

3. `gateway/src/upstream/client.rs`
   - 新增定向测试：
     - `program_owned_image_b64_policy_disables_inline_json_prefill`
   - 当前 program-owned `image.b64` 已显式固定为：
     - `initial_action = Skip`
     - `on_stream_failure = ReturnOriginal`
     - `on_materialize_failure = ReturnOriginal`

4. `deploy/test-gateway-protocol-matrix.py`
   - 当前第三线 live suite 的说明文本也已经一起收紧：
     - `text`
       - 不得再 silently 回到 generic Gemini chatbox submit
     - `tts`
       - 不得再 silently 回到 browser-owned prompt submission / relay
     - `media`
       - 不得再把 `program-owned image JSON fallback` 当成第三线正式热路径

### 2. 新证据

- strict runtime：
  - container:
    - `deploy-gateway-canvas-no-key-v39r6d`
  - URL:
    - `http://127.0.0.1:42443`

- focused:
  - `output/gemini_canvas_program_media_live-image-b64-20260512-v39r6d-unify5`
    - `pass`
  - `output/gemini_canvas_program_media_live-music-20260512-v39r6d-unify6`
    - `pass`

- fresh strict full live：
  - `output/gemini_canvas_program_media_live-20260512-v39r6d-unify7`
    - `5/5`
  - `output/gemini_canvas_program_text_live-20260512-v39r6d-unify7`
    - `5/5`
  - `output/gemini_canvas_program_tts_live-20260512-v39r6d-unify7`
    - `2/2`

### 3. 当前最准确结论

- 第三条线当前不仅：
  - 不走网页聊天框 owner
  - 不走 browser relay steady-state
- 现在连最后一个 residual mixed point：
  - `program-owned image JSON fallback`
  也已经切掉

- 因此截至这一轮，第三条线的 strict 语义可以正式收口成：
  - `create = Canvas app bootstrap`
  - `invoke = program-owned / no-key / browserless pure-http`
  - `text / tts / image / music / video / models`
    - 全部 fresh live 通过

## 第一百五十七轮结果：`text / tts / image / music / video` 已统一收口到更纯的 `program-owned / no-key` Canvas 程序接口，并在 fresh live 上重新全绿

这轮继续只做 `gemini canvas web reverse / program-owned / no-key`，不碰已冻结的 `gemini web reverse`。目标不是再补一条 browser relay 兜底，而是把仍然残留混线的 `text / tts / image` 一起推进到更纯的 Canvas 程序接口，使它们与已经 page-owned 的 `music / video` 在正式主链语义上收敛。

### 1. 本轮真正起作用的代码改动

1. `gateway/src/upstream/client.rs`
   - `program-owned text`
     - `execute_gemini_canvas_modular_browser_relay_text(...)` 现在对
       - `gemini_canvas_program_web_reverse_compatible`
       只允许：
       - `execute_gemini_canvas_direct_http_stream_generate_text(...)`
       - 或显式 fail-closed：
         - `gemini_canvas_program_text_pure_http_required`
     - 不再允许 browser-pool preview `/fetch` 继续充当正式主链

2. `gateway/src/upstream/client.rs`
   - `program-owned tts`
     - `execute_gemini_canvas_modular_browser_relay_tts(...)`
     - `execute_gemini_canvas_tts(...)`
     - 现在都对 program-owned 直接优先走：
       - `execute_gemini_canvas_direct_http_tts(...)`
     - 若 pure-http contract 不可用，则显式 fail-closed：
       - `gemini_canvas_program_tts_pure_http_required`

3. `gateway/src/upstream/client.rs`
   - `program-owned image`
     - `execute_gemini_canvas_program_pure_http_image(...)`
       当前不再把 preview/browser relay 当默认 steady-state owner
     - `GeminiCanvasDirectHttpImageJsonPolicy`
       当前对 program-owned `image.b64` 也不再优先走 preview-style inline prefill
     - `fetch_gemini_canvas_direct_http_image_asset(...)`
       这轮改为复用更稳的：
       - `materialize_gemini_canvas_direct_http_media_asset(...)`
       使 `image.b64` 的 final asset materialization 也继承：
       - explicit `cookieHeader`
       - redirect/handoff 处理
       - direct media fetch cookie/session 语义

### 2. 新证据

- fresh isolated runtime：
  - container:
    - `deploy-gateway-canvas-no-key-v39r6c`
  - URL:
    - `http://127.0.0.1:42441`

- fresh full live：
  - `output/gemini_canvas_program_text_live-20260512-v39r6c-unify4`
    - `5/5`
  - `output/gemini_canvas_program_tts_live-20260512-v39r6c-unify4`
    - `2/2`
  - `output/gemini_canvas_program_media_live-20260512-v39r6c-unify4`
    - `5/5`

- focused `image.b64`：
  - `output/gemini_canvas_program_media_live-image-b64-20260512-v39r6c-unify3`
    - `pass`

### 3. 当前最准确结论

- `text / tts / image / music / video / models`
  - 当前 fresh live 已全部 caller-visible 通过
- 当前这条实现线的正式语义应固定为：
  - `gemini canvas web reverse`
  - `program-owned`
  - `no-key`
  - `browserless pure-http steady-state`
- 更准确地说：
  - `text / tts / image`
    - 当前已经不再停留在 preview/browser relay 证据态
    - 已收口到更纯的 program contract 主线
  - `music / video`
    - 继续保持 page-owned `StreamGenerate + follow-up`
- 因此当前 canonical 结论必须更新为：
  - 这条线不再只是“不是聊天框”
  - 而是已经 caller-visible 重新全绿，并且默认主链已进一步从 mixed preview/browser path 收成更纯的 `Canvas program interface`

## 第一百五十六轮结果：`music` 的 no-key 默认主链开始正式接受 `18/21/11/26/Track Details` 进度态

这轮继续只做 `gemini canvas web reverse / program-owned / no-key`，不碰已冻结的 `gemini web reverse`。核心不是继续走浏览器页面提交，而是把 `music` 当前已经实证存在的 app-owned 进度态正式接回 Rust 默认主链：

- `music_generation + action_input`
- `Track Details`
- `Generating your music...`
- `18 / 21 / 44`
- `11 = Electronic Music Cue Generation`
- `26 + 44`

### 1. 本轮真正落地的收口

1. `gateway/src/upstream/client.rs`
   - `program-owned / no-key / music` 现在不再只在：
     - `initial StreamGenerate body`
     - `replay_after_prelude_body`
     上判断 accepted-progress。
   - 这轮把更深一层的 follow-up body 也正式纳入：
     - 若 follow-up 已进入上述 `accepted progress`
     - 即使暂时没有真实 `audio/mpeg`
     - 也返回 `accepted=true, completed=false`
   - 同时新增统一 helper：
     - `build_gemini_canvas_music_accepted_response_from_body(...)`

2. `gateway/src/upstream/client.rs`
   - `extract_gemini_canvas_media_assets_after_primary_failure(...)`
   - 当前当 `music` follow-up body 已进入 accepted-progress、但 page-blob/page-poll 仍未拿到 asset 时，
     不再直接把它压回硬失败，而是把这份 body 继续向上返回，交给 caller-visible 层收成正式 pending。

3. `gateway/src/upstream/gemini/canvas_web_reverse/result.rs`
   - browser-owned modular result 这边也同步补齐了同一类判定：
     - `Generating your music...`
     - `Electronic Music Cue Generation`
     - `26 + 44`
   - 保持 browser-owned 与 program-owned 对 `music pending` 的语义一致，不再一个认、一个不认。

4. `gateway/scripts/probe-gemini-canvas-program-streamgenerate-no-key-replay.mjs`
   - replay 诊断脚本新增了更贴近 `music` 的 summary 字段：
     - `containsMusicAcceptedProgress`
     - `containsMusicResponseIdToken18`
     - `containsMusicOpaqueToken21`
     - `containsMusicOpaqueToken26`
   - 不再只会告诉我们 `status=200/400`，而是能直接看出是否已经进入 app-owned 生成态。

### 2. 新证据

- `output/gemini_canvas_music_streamgenerate_exact_replay_20260510_v6/summary.json`
  - 当前 pure HTTP no-key replay 已明确给出：
    - `status = 200`
    - `containsMusicAcceptedProgress = true`
    - `containsMusicResponseIdToken18 = true`
    - `containsMusicOpaqueToken21 = true`
  - 这说明当前默认 no-key contract 至少已经能稳定进入 app-owned 音乐生成态，不再只是 `1060` 或 transport error。

- `output/gemini_canvas_music_streamgenerate_replay_from_browser_v2_hostexport_20260510_v2/response.txt`
  - 用旧成功样本的 exact request 做纯 HTTP replay，即便把 `referer` 对齐到 concrete `/app/<id>`，当前仍会落到 `BardErrorInfo [1097]`。
  - 这说明 `music` 的最终成功条件仍比 `video` 更苛刻，不是“少一个普通 referer”这么简单。

### 3. 当前最准确结论

- `music` 仍未 final `mp3/audio` 完成。
- 但这轮之后：
  - 默认 `program-owned / no-key` 主链不再把已经进入 `18/21/11/26/Track Details` 的 body 误报成硬失败。
  - caller-visible 语义已经继续前移成：
    - `accepted / pending`
- 当前剩余的真正 blocker 继续收缩为：
  - **在已进入 accepted-progress 之后，哪条 continuation 才能稳定拿到最终 `audio/mpeg / .mp3`。**

## 第一百五十五轮结果：`music` 的 browser-owned pending 语义已收口，`snag/mp4` 不再拖成无限超时

这轮继续只做 `gemini canvas web reverse / program-owned / no-key`，不碰已冻结的 `gemini web reverse` 行为线。重点不是宣布 `music` 已完成，而是把当前最稳定的一类 browser result 收成正确的 caller-visible 语义：

- 如果页面已经进入：
  - `music_generation + action_input`
  - `Track Details`
  - `I've hit a bit of a snag / please try again later`
- 且还没有真正 `audio` 资产
- 那么：
  - browser-pool 不再继续无限等待到 transport timeout
  - Rust modular result 也不再把 `video/mp4` 占位媒体误判成最终音乐资产
  - caller-visible 会返回：
    - `accepted = true`
    - `completed = false`

### 1. 本轮代码改动

1. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - 新增：
     - `bodyIndicatesMusicPendingOrBusy(...)`
   - 当前 `music` settle 规则改成：
     - 若还没有 `audio` 资产
     - 但页面 body 已进入 `action_input / Track Details / snag / busy`
     - 就停止继续死等 `audio target`，直接返回当前 pending 结果

2. `gateway/src/upstream/gemini/canvas_web_reverse/result.rs`
   - `build_music_generation_response_from_invocation(...)` 当前会先判断：
     - body 是否已进入 `pending/busy`
     - 且结果里是否仍只有 `video/mp4` 占位媒体
   - 若是，则改回：
     - `build_music_generation_accepted_response(...)`
   - 不再把 `video/mp4` 错当成最终 `music` caller-visible 成功

3. `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`
   - 新增定向测试：
     - `build_music_generation_response_from_invocation_marks_pending_when_only_video_and_busy`

### 2. focused 现象

- 使用真实 session 的 `host-export-20260428/storage-state.json` 触发 `music /invoke` 时，当前稳定现象已明确：
  - 页面进入：
    - `0:00 / 0:30`
    - `I've hit a bit of a snag`
  - 同时只暴露：
    - `morning_logic.mp4`
    - `mental_monument.mp4`
    - `copper_ascent.mp4`
  - 这说明该 session 下的 browser-owned 页面态并不会自然长出 `mp3`

- 与之相对，旧成功归档：
  - `output/gemini_canvas_music_browser_result_20260510_v2.json`
  - 仍明确证明另一条热样本里 `StreamGenerate` response body 内曾同时出现：
    - `morning_logic.mp3`
    - `audio/mpeg`
    - 以及对应 download URL
  - 因此当前 blocker 已收口成：
    - **不同热 session / 页面态是否会暴露真正 `mp3` follow-up**
    - 而不再是 parser 完全看不懂 `mp3`

### 3. 当前最准确结论

- `music` 仍然没有 final `mp3/audio` contract 成功收口
- 但这轮之后：
  - `music` 不再因为 `snag + mp4` 页面态把调用拖成 transport timeout
  - caller-visible 语义已经先被收成：
    - `accepted / pending`
- 下一轮最该继续追的点仍是：
  - 哪一条 `follow-up` 或哪一种热 session 能把当前 `music` 从
    - `action_input / Track Details / snag`
    推进到
    - 真正 `audio/mpeg`

## 第一百五十四轮结果：`music` 已接入 `PCck7e -> recent conversation page poll` 主链接线，并修掉 follow-up body 丢失

这轮继续只做 `gemini canvas web reverse / program-owned / no-key`，不碰已冻结的 `gemini web reverse` 行为线。重点不是再猜“还缺不缺普通 header”，而是把 `music` 当前最有证据的一条 continuation 线正式接进 Rust 主链：

- `response_id -> PCck7e`
- `PCck7e` 回出的 `18 / 21 / 44`
- recent conversation page recovery
- concrete `/app/<id>` page poll

### 1. 本轮真正落地的代码改动

1. `gateway/src/upstream/client.rs`
   - `music` 现在不再只会：
     - `StreamGenerate`
     - `ESY5D`
     - `aPya6c`
     - 然后直接结束
   - 这轮新增了：
     - `execute_gemini_canvas_music_post_preflight_followup(...)`
     - `finalize_gemini_canvas_music_followup_result(...)`
     - `try_recover_gemini_canvas_recent_conversation_page_url(...)`
   - 当前 `music` 的 no-key 后处理语义变成：
     - 先跑既有 `ESY5D + aPya6c`
     - 若仍未拿到 asset，则进一步：
       - 用 `response_id` 打 `PCck7e`
       - 以 `PCck7e` 回包作为新的 `page_seed_body`
       - 先尝试普通 page poll
       - 再尝试 `MaZiqc` recent conversation recovery 后的 concrete app page poll

2. `gateway/src/protocol/gemini_canvas.rs`
   - 新增：
     - `build_music_trigger_request(...)`
   - 当前显式把 `music` 的 `PCck7e(response_id)` builder 作为独立语义公开出来，不再只靠 TTS 线的同构 helper 隐式复用。

3. `gateway/src/upstream/client.rs`
   - 同时修掉了一个会遮蔽最新页面态的问题：
     - `extract_gemini_canvas_media_assets_after_primary_failure(...)`
   - 之前 follow-up 已经拿到更近一步的 `followup_body` 后，page poll 仍然错误地继续喂旧 `primary_body`
   - 这轮已改成：
     - page poll 优先吃最新 `followup_body`
   - 否则 second-chance 刚前移出来的 `responseId / action / pending state` 会在下一跳被丢掉

### 2. 这轮代码侧验证

通过：

- `cargo check --manifest-path gateway/Cargo.toml`
- `cargo test --manifest-path gateway/Cargo.toml build_music_generation_accepted_response_marks_pending_state -- --nocapture`
- `cargo test --manifest-path gateway/Cargo.toml build_music_trigger_request_uses_response_id_payload -- --nocapture`

独立目标目录：

- `.runtime/cargo-target-canvas-no-key-music-v3`

关键日志：

- `.runtime/cargo-check-music-v3.log`
- `.runtime/cargo-test-music-accepted-v3.log`
- `.runtime/cargo-test-music-trigger-v3.log`

结果：

- `cargo check` 通过
- `music accepted` 定向测试通过
- 新增 `build_music_trigger_request` 定向测试通过

### 3. focused 新证据

1. 现有 `music` strongest continuation seam 进一步收口成：
   - `PCck7e(response_id)`
   - 证据仍以：
     - `output/tmp-music-current.json`
   - 为主
   - 里面当前最关键的连续状态是：
     - `responseId = r_a7578d122722b7b5`
     - `PCck7e`
     - 回出：
       - `18 = r_a7578d122722b7b5`
       - `21 = 9cSdYM592TzMxTYpOs5Uq1oqLQBIiUW7wUHPzluaTOA`
       - `44 = true`
   - 因此这轮后，`music` 最该继续追的 no-key continuation key 已明确是：
     - **field `21` token**

2. 新增 focused 归档：
   - `output/gemini_canvas_music_pc_followup_20260510_v1/summary.json`
   - `output/gemini_canvas_music_pc_followup_20260510_v1/pc.txt`
   - `output/gemini_canvas_music_pc_followup_20260510_v1/mazi.txt`
   - `output/gemini_canvas_music_pc_followup_20260510_v1/page.html`

这轮 focused 的最准确结论是：

- 直接手工 `PCck7e` exact replay 这次仍没成功拿到 continuation body：
  - `pcStatus = 400`
- 直接手工 `MaZiqc full` 这次也没有马上返回当前 conversation：
  - `maziHasConversation = false`
- 但 concrete `/app/<id>` page fetch 已 caller-visible 证明：
  - `pageStatus = 200`
  - `pageHasTrackDetails = true`
- 同时也明确证明：
  - 这页 HTML 里**没有直接裸露真实音乐资产 URL**
  - 当前不是“页面上已经有下载链接，只是 parser 没扫到”这种浅问题

### 4. 当前最准确的结论

这轮之后，`music` 的主阻塞再次前移：

- 现在已经不是：
  - old exact body 永远 1060
  - second-chance prelude 不起作用
  - follow-up body 丢失
- 现在更准确地收口成：
  - `music` 已有：
    - `StreamGenerate -> accepted`
    - `PCck7e(response_id)` 这条明确 continuation seam
    - recent conversation page recovery
    - concrete app page poll
  - 但仍然**没有拿到真正音频资产的 final contract**
  - 且 concrete `/app/<id>` page HTML 本身也没有直接裸露 asset URL

所以当前真正剩下的 blocker 已经继续收缩成一句话：

- **如何把 `PCck7e` 回出的 `21` token，再推进到真正音乐 asset 的下一跳 contract。**

## 第一百五十三轮结果：`music` 已接入 second-chance no-key replay，失败面从纯 `1060` 前移到 `responseId + action/track-details`

这轮继续只做 `gemini canvas web reverse / program-owned / no-key`，不碰已冻结的 `gemini web reverse` 行为线。重点不再是泛泛怀疑“是不是少 header”，而是把：

- `video` 已被证明成功的 page-owned `StreamGenerate`
- `music` 当前已经前移的 page-owned `StreamGenerate`

分别收成更明确的默认主线与阻塞面。

### 1. `video` 这轮真正完成的收口

1. `gateway/src/protocol/gemini/api/media.rs`
   - 新增：
     - `build_video_generation_accepted_response(...)`
   - 语义：
     - 当 `video` 已 caller-visible 进入：
       - `video_placeholder`
       - `pending`
       - `busy / try again later`
     - 但尚未拿到真实视频资产时，不再只能报硬错误
     - 而是允许返回：
       - `accepted = true`
       - `completed = false`

2. `gateway/src/protocol/gemini/api/mod.rs`
   - 导出上述 builder

3. `gateway/src/protocol/gemini_canvas.rs`
   - 新增 wrapper：
     - `build_video_generation_accepted_response(...)`

4. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_program_preview_no_key_video(...)`
   - 当前 page-owned `StreamGenerate` 分支已改成：
     - 先 replay
     - 再尝试 follow-up / asset extraction
     - 若 body 已进入：
       - `video_placeholder`
       - `response_indicates_video_generation_pending(...)`
       - `busy message`
     - 且尚未拿到真实资产，则返回正式 accepted/pending 响应
   - 不再在这一步直接把 `busy` 一律判成最终失败

### 2. `video` 的代码侧验证

通过：

- `cargo test --manifest-path gateway/Cargo.toml build_video_generation_accepted_response_marks_pending_state -- --nocapture`
- `cargo test --manifest-path gateway/Cargo.toml build_program_stream_generate_request_from_invoke_contract_preserves_query_and_replaces_prompt -- --nocapture`
- `cargo check --manifest-path gateway/Cargo.toml`

独立目标目录：

- `.gcv-main1`

关键日志：

- `.runtime/cargo-build-video-accepted.log`
- `.runtime/cargo-build-streamgenerate.log`
- `.runtime/cargo-check-main1.log`

结果：

- 两条定向测试通过
- `cargo check` 通过

### 3. `music` 这轮最关键的新证据

1. 当前 focused direct replay 已经不再只停在 `1060`

- `output/gemini_canvas_music_sequence_replay_20260510_v2/results.json`
  - 旧 exact body + 一组 capture-aligned prelude
  - 已拿到：
    - `conversationId / responseId`
    - 非 `1060` 的 stream body
    - 且后续 `PCck7e / ESY5D / aPya6c` 都进入正常 `200`

- `output/gemini_canvas_music_sequence_replay_20260510_v3/summary.json`
  - 同一条 old exact body 当前已 caller-visible 前移到：
    - `containsAction = true`
    - `responseId = r_f6aa117cef25bd3c`

- `output/gemini_canvas_music_n0_current_20260510_v1.txt`
  - 说明当前热 session 下，哪怕不额外 replay prelude
  - old exact body 也已经不再稳定掉回 `1060`
  - 而是会返回：
    - `responseId`
    - 一段 `cue summary / Track Details` 文本

- `output/gemini_canvas_music_synth_prelude_probe_20260510_v1.json`
  - 说明 Rust 可合成的最小 prelude 里，当前最值钱的是：
    - `L5adhe(last_selected_mode_id_on_web, source_path = 当前 app_path)`
  - 只做这一轮 minimal prelude，再 replay old exact body，就已可稳定前移到：
    - `music_generation + action_input`
    - 或 `Track Details`

2. 旧的 `1060` 证据仍有价值，但现在只代表“冷态 / 错态 replay”

- `output/gemini_canvas_music_streamgenerate_exact_replay_20260510_v1/summary.json`
- `output/gemini_canvas_music_page_fetch_probe_20260510_v1.json`
- `output/gemini_canvas_music_fresh_streamgenerate_20260510_v1.json`
- `output/gemini_canvas_music_fresh_pagecontext_20260510_v2.json`
  - 这些归档共同说明：
    - fresh synthesized request 仍然容易掉到 `1060`
    - 但 old exact body + 当前页状态已经不再必然如此

### 4. 这轮关于 `music` 的最准确结论

现在可以明确收口成：

- `music` 当前已经不是“exact replay 永远只会 1060”
- 旧 exact body 在当前热 session 下，已经能前移到：
  - `responseId`
  - `music_generation + action_input`
  - 或 `Track Details / cue summary`
- 当前最小合成 prelude 也已经被压缩到：
  - `L5adhe(last_selected_mode_id_on_web, current app_path)`

也就是说：

- old exact body：可前移
- minimal synthesized prelude + old exact body：可前移
- fresh synthesized request：仍容易失败

因此这轮之后，`music` 的 blocker 已经从“猜测缺环境参数”前移成：

- **已经拿到 `music_generation/action_input` 或 `Track Details` 之后，如何继续拿到真正音频资产**
- **当前真正缺的已经不是 first-hop submit contract，而是 final generation / asset retrieval contract**

### 5. `music` 主线语义也已开始收口

这轮同时把 `music` 的 Rust 主链也往 no-key 目标推进了一步：

1. `gateway/src/protocol/gemini/api/media.rs`
   - 新增：
     - `build_music_generation_accepted_response(...)`

2. `gateway/src/protocol/gemini/api/mod.rs`
   - 导出上述 builder

3. `gateway/src/protocol/gemini_canvas.rs`
   - 新增 wrapper：
     - `build_music_generation_accepted_response(...)`

4. `gateway/src/upstream/client.rs`
   - `program-owned music` 当前已开始接受：
     - `program_music_streamgenerate_candidate`
     - `page_stream_generate_form`
   - 现在的主链语义是：
     - 先用 old exact body 做 first replay
     - 若还没进入 `music_generation + action_input / Track Details`
       - 自动借当前 app page bootstrap 做一轮最小 `L5adhe` prelude
       - 再 second-chance replay 同一条 `StreamGenerate`
     - 只要进入：
       - `music_generation + action_input`
       - 或 `Track Details / cue summary`
       - 就返回 `accepted = true / completed = false`
     - 若 second-chance 后仍然掉回：
       - `BardErrorInfo [1060]`
       - 才显式报：
         - `gemini_canvas_program_music_no_key_stage_incomplete`
   - 同时，最外层 modular 入口现在也已禁掉：
     - `program-owned music -> browser execution fallback`
     - `program-owned video -> browser execution fallback`
   - 如果 direct no-key 合同没有被 materialize 出来，正式主链现在会显式报：
     - `gemini_canvas_program_music_browser_fallback_forbidden`
     - `gemini_canvas_program_video_browser_fallback_forbidden`

### 6. 新的最小验证

通过：

- `node --check gateway/scripts/probe-gemini-canvas-program-streamgenerate-no-key-replay.mjs`
- `cargo fmt --manifest-path gateway/Cargo.toml --all`
- `cargo test --manifest-path gateway/Cargo.toml build_music_generation_accepted_response_marks_pending_state -- --nocapture`
- `cargo check --manifest-path gateway/Cargo.toml`

新增关键归档：

- `output/gemini_canvas_music_streamgenerate_exact_replay_20260510_v2/summary.json`
- `output/gemini_canvas_music_streamgenerate_exact_replay_20260510_v3/summary.json`
- `output/gemini_canvas_music_sequence_replay_20260510_v2/results.json`
- `output/gemini_canvas_music_sequence_replay_20260510_v3/summary.json`
- `output/gemini_canvas_music_n0_current_20260510_v1.txt`
- `output/gemini_canvas_music_synth_prelude_probe_20260510_v1.json`
- `output/gemini_canvas_music_page_fetch_probe_20260510_v1.json`
- `output/gemini_canvas_music_fresh_streamgenerate_20260510_v1.json`
- `output/gemini_canvas_music_fresh_pagecontext_20260510_v2.json`

它们共同证明：

- old exact body 在当前热 session 下已不再稳定停在 `1060`
- minimal `L5adhe` prelude + old exact body 已可稳定前移到：
  - `music_generation + action_input`
  - 或 `Track Details`
- fresh synthesized request 仍然容易掉回 `1060`

所以这轮之后，`music` 的结论已经从“可能缺普通 header”进一步前移成：

- **旧 body 不是单纯可复放合同**
- **fresh synthesized request 也还不够**
- **当前真正缺的是比 request body 更高一层的 page-state / session-bound contract**

## 第一百五十一轮结果：`video` 的 no-key page-owned `StreamGenerate` 已被 pure HTTP exact replay 成功复放

这轮继续只做 `gemini canvas web reverse / program-owned`，不碰已冻结的 `gemini web reverse` 行为线。目标不是再围绕 `predictLongRunning` 猜 header，而是把当前 live 页面里真正提交 `video` prompt 的 no-key 合同直接拿出来做无浏览器复放。

### 1. 本轮真正起作用的改动

1. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - `deriveProgramRpcInvokeCandidate(...)`
     - `video` 当前会优先提取：
       - `StreamGenerate`
     - 不再继续只把：
       - `hNvQHb / kwDCne`
       当成 `video` 的第一候选合同
   - 新增：
     - `requestEnvelopeKind = page_stream_generate_form`
     - `transportKind = program_video_streamgenerate_candidate`

2. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - 同步做了与上面一致的 `video` contract 提取纠偏：
     - 优先保留 `StreamGenerate`
     - batchexecute 只退成 fallback candidate
   - 这意味着以后 materialize/handle probe 若再次抓到当前 live `video` 页面提交，会优先沉淀：
     - `requestUrl`
     - `requestBody`
     - `requestRpcId = StreamGenerate`
     - `requestEnvelopeKind = page_stream_generate_form`

3. 新增正式脚本：
   - `gateway/scripts/probe-gemini-canvas-program-streamgenerate-no-key-replay.mjs`
   - 作用：
     - 读取 `storage-state.json`
     - 读取已抓到的 `StreamGenerate` request
     - 自动构造：
       - `cookie`
       - `SAPISIDHASH`
       - `Origin / Referer / X-Origin / X-Same-Domain / X-Goog-AuthUser`
     - 对当前 `video` no-key `StreamGenerate` 合同做 pure HTTP exact replay

### 2. focused 证据

当前关键归档：

- `output/tmp-video-streamgenerate-current.json`
- `output/gemini_canvas_video_streamgenerate_exact_replay_20260510_v2/summary.json`
- `output/gemini_canvas_video_streamgenerate_exact_replay_20260510_v3/summary.json`
- `output/gemini_canvas_video_streamgenerate_exact_replay_20260510_v4/summary.json`
- `output/gemini_canvas_video_streamgenerate_exact_replay_20260510_v5/summary.json`

已经被 caller-visible 证明的事实：

1. 当前 `video` 的页面主提交点不是：
   - `predictLongRunning`
2. 当前 `video` 的真实 no-key 页面主提交点是：
   - `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?...`
3. 纯 HTTP exact replay 当前已经成功命中并返回：
   - `status = 200`
   - 新的 `responseId`
   - 新的 `conversationId`
   - `video_placeholder`
4. 延长读取窗口后，同一条 pure HTTP 流还会继续返回与浏览器相同的最终 busy 文本：
   - `I couldn't do that because I'm getting a lot of requests right now. Please try again later.`

也就是说，这轮之后：

- `video` 的 no-key app-native contract 已不再只是“猜测可能存在”
- 而是已经被 **无浏览器 pure HTTP exact replay** 直接证明可复放

### 3. 验证

通过：

- `node --check gateway/scripts/probe-gemini-canvas-program-streamgenerate-no-key-replay.mjs`
- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
- `node gateway/scripts/probe-gemini-canvas-program-streamgenerate-no-key-replay.mjs --outDir output/gemini_canvas_video_streamgenerate_exact_replay_20260510_v5`

关键结果：

- `v2`
  - 已得到：
    - `status = 200`
    - 新的 `responseId`
  - 说明浏览器依赖已经被去掉，开始真正 caller-visible 命中页面 stream 合同
- `v3`
  - 已得到：
    - `video_placeholder`
  - 说明 pure HTTP replay 已经不只是“拿到首帧 locator”，而是进入了真实视频生成页面态
- `v4`
  - 已得到：
    - `video_placeholder`
    - `I couldn't do that because I'm getting a lot of requests right now. Please try again later.`
  - 说明纯 HTTP replay 与浏览器页面最终失败语义已经对齐

### 4. 当前最准确结论

这轮之后，关于 `gemini canvas program-owned / no-key / video` 的结论必须更新为：

- `predictLongRunning` 不是当前 app-native no-key 的正确主线
- 当前正确主线是：
  - `Canvas app page-owned StreamGenerate`
- 并且这条主线已经被：
  - `storage-state + cookie + SAPISIDHASH`
  - `无浏览器 pure HTTP exact replay`
  真正复放成功

当前还没完成的只剩一件事：

- 把这条已经验证成功的 `page-owned StreamGenerate` 合同正式接入默认 `program-owned / no-key video` 主链
- 并决定最终 accepted gate 应如何表达：
  - `video_placeholder only`
  - `busy / rate-limited`
  - 还是继续做后续 `PCck7e` / locator-based follow-up

它已经不再是“能不能 browserless”的问题，而是“如何把已证实可行的 browserless contract 正式工程化接入”。

## 第一百五十轮结果：`program-owned TTS` 已切到 preview-frame no-key 主链并 caller-visible 成功，`video` 失败面继续前移到 preview-frame 内部 fetch 本身

这轮继续只做 `gemini canvas web reverse / program-owned`，不碰已冻结的 `gemini web reverse` 行为线。

### 1. 代码层收口

1. `gateway/src/upstream/client.rs`
   - 新增：
     - `gemini_canvas_program_no_key_generate_content_fetch_mode(...)`
   - 当前 `program-owned` 的 `generateContent` 型 no-key 路线正式收成：
     - `text -> canvas_preview_no_key`
     - `tts -> canvas_preview_no_key`
     - `image -> canvas_preview_no_key`
   - 不再让 `tts` 默认停留在旧的：
     - `canvas_page_no_key`

2. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `ensureCanvasProxyPreviewFrame(...)`
     - preview frame 发现逻辑从“一次 stamp”改成带 deadline 的短轮询
     - 不再把“页面还没 ready”过早判成：
       - `gemini_canvas_preview_frame_missing`
   - `runFetchOperation(...)`
     - 当 `canvas_preview_no_key` 失败时，错误体现在会一并带出：
       - `previewFrameUrl`
       - `probeResult`
       - 最近 `networkEvents`
       - 最近 `rpcCaptures`
     - 用于区分：
       - frame 尚未 ready
       - frame 已 ready，但官方 no-key fetch 本身失败

### 2. focused 结果

新增归档：

- `output/gemini_canvas_preview_no_key_tts_variants_20260510_v1/`
- `output/gemini_canvas_preview_no_key_video_probe_20260510_v5/`

当前已经 caller-visible 证明：

1. `tts`
   - 通过 browser pool `/fetch`
   - `googleFetchMode = canvas_preview_no_key`
   - 请求：
     - `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`
   - 成功样本：
     - `generate_no_voice.json`
     - `generate_kore.json`
   - 两个样本都返回：
     - `status = 200`
     - `candidates[0].content.parts[0].inlineData`
     - `mimeType = audio/L16;codec=pcm;rate=24000`
   - 这说明：
     - `preview-frame no-key TTS` 已 caller-visible 成功
     - 旧的 `finishReason = OTHER` 归档不再代表当前上限

2. `video create`
   - 先前失败面是：
     - `gemini_canvas_preview_frame_missing`
   - 这一轮在 preview frame 轮询修复后，失败面继续前移为：
     - `gemini_canvas_preview_no_key_fetch_failed`
     - `PreviewProbeFetchError Failed to fetch`
   - 同时诊断体已经证明：
     - `previewFrameUrl` 真实存在
     - `probeResult.finalUrl` 已经组装成：
       - `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning`
     - 但最近 `networkEvents` 里仍只看到 Gemini 页面自己的 `batchexecute / StreamGenerate / q4uTj`
     - 没有 caller-visible 抓到成功发出的官方 `predictLongRunning`
   - 因此当前最准确的结论是：
     - `video` 现在不再是 frame 缺失
     - 而是 preview-frame 内部对官方 `predictLongRunning` 的 no-key fetch 本身失败

### 3. 验证

通过：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
- `CARGO_TARGET_DIR=.runtime/cargo-target-canvas-preview-nokey-v2 cargo test --manifest-path gateway/Cargo.toml program_no_key_generate_content_fetch_modes_prefer_preview_contract -- --nocapture`
- `CARGO_TARGET_DIR=.runtime/cargo-target-canvas-preview-nokey-v2 cargo check --manifest-path gateway/Cargo.toml`
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`

## 第一百四十九轮结果：真实 Canvas 预览 frame 的 no-key official fetch contract 已 caller-visible 打通 `text + image`，`video` 仍未打通

这轮继续只做 `gemini canvas web reverse / program-owned`，不碰已冻结的 `gemini web reverse` 行为线。核心纠偏不是再去猜 Google 还缺哪个 header，而是把我们自己的 `canvas_preview_no_key` 真正补成与 `Browser API Proxy Client` 一致的请求语义。

### 1. 代码层修正

1. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `stampCanvasProxyPreviewFrames(...)`
     - 预览 frame 的 `probeFetch` 现在补上了：
       - `credentials: "include"`
       - `mode: "cors"`
       - 官方 host 自动补空 `?key=`
       - 与 `Browser API Proxy Client` 一致的 forbidden header 清洗
   - `executeCanvasProxyPreviewNoKeyFetch(...)`
     - 同步补上：
       - `credentials: "include"`
       - `mode: "cors"`
       - 官方 host 自动补空 `?key=`
       - forbidden header 清洗
   - 这一步的意义是：
     - 旧的 `canvas_preview_no_key` 失败面，之前并不等价于真实 `Browser API Proxy Client` 语义

2. `gateway/src/upstream/client.rs`
   - `program-owned text`
     - 默认 no-key fetch mode 从：
       - `canvas_page_no_key`
     - 切到：
       - `canvas_preview_no_key`
   - `program-owned image`
     - 默认 no-key fetch mode 也从：
       - `canvas_page_no_key`
     - 切到：
       - `canvas_preview_no_key`
   - 当前没有把：
     - `tts`
     - `video`
     - `music`
     一起强行切过去，因为这三条 caller-visible 证据还没有完全收口

### 2. focused 结果

新增归档：

- `output/gemini_canvas_preview_no_key_direct_contract_20260509_v1/summary.json`

当前已经 caller-visible 证明：

1. `text`
   - 通过 browser pool `/invoke`
   - `googleFetchMode = canvas_preview_no_key`
   - 返回：
     - `status = 200`
     - `finalUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`
     - body 中直接有：
       - `candidates[0].content.parts[0].text = "ok"`

2. `image`
   - 同样通过 browser pool `/invoke`
   - `googleFetchMode = canvas_preview_no_key`
   - 返回：
     - `status = 200`
     - `finalUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
     - body 中直接有：
       - `inlineData.image/jpeg`

3. `tts`
   - 当前 request 已返回：
     - `status = 200`
     - `finalUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`
   - 但这轮还没有继续把它收口成完整音频 caller-visible 成功
   - 因为当前回包 body preview 里只有：
     - `finishReason = OTHER`
   - 还需要继续验证 `AUDIO` payload / followup 语义

4. `video create`
   - 当前仍失败：
     - `gemini_canvas_preview_no_key_fetch_failed`
     - `PreviewProbeFetchError Failed to fetch`

### 3. 同轮关键发现

这轮还顺手把一个长期混淆点彻底分开了：

- 真实 Canvas 预览 frame 里的 `Browser API Proxy Client` websocket 到：
  - `wss://127.0.0.1:9998?authIndex=0`
  - 仍然被上游页面策略拦住：
    - `WebSocket connection ... is not allowed in Canvas`
- 但同一个预览 frame 内：
  - `generateContent` 风格的 no-key official fetch
  - 已经 caller-visible 成功

也就是说，当前真正打通的是：

- `preview-frame no-key official fetch contract`

而不是：

- `preview-frame websocket relay contract`

### 4. 验证

通过：

- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
- `CARGO_TARGET_DIR=.runtime/cargo-target-canvas-preview-nokey-v1 cargo check --manifest-path gateway/Cargo.toml`
- `CARGO_TARGET_DIR=.runtime/cargo-target-canvas-preview-nokey-v1 cargo test --manifest-path gateway/Cargo.toml connected_fetch_mode_helpers_recognize_canvas_page_no_key_variants -- --nocapture`

另外已通过独立 focused live 调用：

- browser pool `/invoke` + `canvas_preview_no_key`
  - `text = 200`
  - `image = 200`
  - `tts = 200 but needs audio validation`
  - `video create = Failed to fetch`

## 第一百四十八轮结果：`CanvasToAPI` 的真实成功机制已被独立部署与 standalone live 对照坐实，当前证据更支持“浏览器 relay + 调用方 official key”

这轮没有继续在主仓里盲改 `gemini canvas web reverse`，而是先按用户要求在**全新空目录**独立部署参考项目：

- 外部参考 checkout：`../CanvasToAPI-fresh-main`

目标不是照抄实现，而是用 live 证据确认它到底为什么成功，以及它到底是不是“Canvas 免费额度 / 无 key 后端”的证据。

### 1. 独立部署结果

在新目录里已完成最小部署：

- `npm install`
- `.env.example -> .env`
- first instance：
  - `API_KEYS=canvas-probe-key`
  - `PORT=47861`
- second instance：
  - `API_KEYS=<redacted-google-api-key>`
  - `PORT=47864`

关键运行日志：

- 外部 checkout 下：
  - `.runtime/run-47861/stdout.log`
  - `.runtime/run-47864-official/stdout2.log`

这两个实例都已成功启动并监听：

- `47861`
- `47864`

### 2. live 对照：standalone 浏览器页即可连上它的 `/ws`

这轮不再依赖 Gemini 页面或 Canvas 页面，而是直接起了本地静态页：

- `http://127.0.0.1:47863/canvas.html`

然后把该 standalone 页面连接到：

- `ws://127.0.0.1:47864/ws`

当前页面日志已经明确出现：

- `Connecting to server: ws://127.0.0.1:47864/ws (browser identifier: browser-OFFICIAL-TEST)`
- `✅ Connection successful!`
- `Connection authenticated successfully!`

这一步的意义是：

- `CanvasToAPI` 的浏览器会话 relay 本身并不要求“必须运行在 Gemini 页面里”
- 它真正要求的是：
  - 一个能连它自己 `/ws` 的浏览器执行器
  - 以及与服务端一致的会话 API key

### 3. live 对照：`Authorization: Bearer AIza...` 会被原样转发给 Google，并直接失败

standalone 页面连上 `47864` 后，对 `CanvasToAPI` 发：

- `POST /v1beta/models/gemini-3-flash-preview:generateContent`
- `Authorization: Bearer <redacted-google-api-key>`

页面日志明确出现：

- `Received request: POST /v1beta/models/gemini-3-flash-preview:generateContent`
- `Request processing failed: Google API returned error: 401 ...`
- `ACCESS_TOKEN_TYPE_UNSUPPORTED`

这说明：

- `CanvasToAPI` 的 relay 会把调用方带进来的 Bearer 值原样交给 Google
- 但 Google 不把 `AIza...` 当 Bearer token 接受
- 因此这条成功机制并不是“Canvas 页面替你补免费身份”

### 4. live 对照：`x-goog-api-key: AIza...` 时 standalone relay 可 caller-visible 完成

同一条 standalone relay，重新连上后再发：

- `x-goog-api-key: <redacted-google-api-key>`

这次：

- standalone 页面日志出现：
  - `Received request: POST /v1beta/models/gemini-3-flash-preview:generateContent`
  - `Data stream read complete.`
  - `Task completed, stream end signal sent`
- 服务端日志出现：
  - `Response ended, reason: STOP`
  - `Complete non-stream response sent to client.`

对应服务端日志位置：

- `CanvasToAPI-fresh-main/.runtime/run-47864-official/stdout2.log`

这一步说明：

- 只要调用方自己带的是 Google 能识别的 official API key 形态
- `CanvasToAPI` 的 standalone 浏览器 relay 就能成功
- 它并不需要 Gemini 页面上下文来“变出免费调用权”

### 5. 当前最准确结论

这一轮之后，关于 `CanvasToAPI` 的结论必须正式纠偏成：

- 它证明的是：
  - `browser-required relay`
  - `浏览器执行器 + 调用方 official key/header/query`
- 它**没有**证明：
  - `program-owned no-key direct contract`
  - `Canvas 免费额度已被 browserless 复放`
  - `存在一个已被我们拿到的、无需官方 key 的 Canvas 私有 invoke backend`

这意味着当前主仓后续方向必须继续保持：

- `share -> app create`
  - 已 HTTP 化
- `program-owned invoke`
  - 仍然需要继续寻找真正的 `no-key app-native contract`
  - 在没找到之前必须继续 `fail-closed`

## 第一百四十七轮结果：`canvas program-owned` 的 no-key direct contract 已被继续压缩到明确的上游 gate，但仍未拿到可复放成功合同

这轮继续只做 `gemini canvas web reverse / program-owned`，不碰已冻结的 `gemini web reverse` 行为线。目标不是再泛泛地说“浏览器/官方/clients6 哪条可能行”，而是把 **无官方 key** 的 direct invoke 失败面继续压成最具体的上游信号。

### 1. 代码层收口

1. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - 新增了：
     - `executeCanvasProgramPageNoKeyMusic(...)`
   - 作用：
     - 不再只在 `blob/scf preview frame` 里起音乐 websocket
     - 改为允许在真实 `gemini.google.com/app/...` 顶层页面上下文里起 no-key 官方音乐 websocket
   - `runFetchOperation(...)` 现在新增识别：
     - `canvas_page_no_key`
     - `canvas_page_music_no_key`
   - 这意味着 no-key focused probe 不再只依赖 `preview/blob frame` 这一种 surface。

2. `gateway/src/upstream/client.rs`
   - `program-owned` 的 no-key direct invoke 入口已经从：
     - `canvas_preview_no_key`
     - `canvas_preview_music_no_key`
   - 切到：
     - `canvas_page_no_key`
     - `canvas_page_music_no_key`
   - 覆盖：
     - `text`
     - `tts`
     - `image`
     - `video create / poll / download`
     - `music`
   - 这一步的意义不是宣布成功，而是把 no-key direct 尝试明确落到更接近真实 app page 的上下文里。

3. `gateway/src/upstream/gemini/canvas_program_web_reverse/browser_operation.rs`
   - 新增 mode helper：
     - `connected_fetch_mode_is_canvas_page_no_key(...)`
     - `connected_fetch_mode_is_canvas_page_music_no_key(...)`

4. `gateway/src/upstream/gemini/canvas_program_web_reverse/tests.rs`
   - 新增定向测试：
     - `connected_fetch_mode_helpers_recognize_canvas_page_no_key_variants`

### 2. focused no-key 证据

新增 focused 归档：

- `output/gemini_canvas_program_no_key_contract_probe_20260509_v1/summary.json`

这轮最终沉淀出的 direct no-key 结论是：

1. `browser_pool + canvas_page_no_key -> official generateContent`
   - 已拿到稳定 caller-visible 上游错误：
     - `403 PERMISSION_DENIED`
   - 关键信号：
     - `Method doesn't allow unregistered callers`

2. `browser_pool + session-backed signed headers -> official generateContent`
   - 已拿到稳定 caller-visible 上游错误：
     - `400 INVALID_ARGUMENT`
   - 关键信号：
     - `Bad request: Origin doesn't match Host for XD3.`

3. `browser_pool + canvas_page_music_no_key -> official music ws`
   - 已拿到稳定 websocket close：
     - `1008 PolicyViolation`
   - 关键信号：
     - `Request is missing required authentication credential`

4. `browser_pool + canvas_page_no_key -> clients6 video preview model`
   - 当前仍停在浏览器级失败：
     - `page.evaluate: TypeError: Failed to fetch`

5. `server-side direct HTTP + signed session -> official hosts`
   - 已明确分化成：
     - `400 XD3`
     - `401 CREDENTIALS_MISSING`

6. `server-side direct HTTP + signed session -> clients6 video preview model`
   - 当前稳定返回：
     - Google `400 HTML` 错页

7. `server-side direct WebSocket + signed session -> official music ws`
   - 已明确 close 原因：
     - `1008 PolicyViolation`
     - `Request is missing required authentication credential`

### 3. 验证

通过：

- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
- `CARGO_TARGET_DIR=.runtime/cargo-target-canvas-page-nokey-v1 cargo check --manifest-path gateway/Cargo.toml`
- `CARGO_TARGET_DIR=.runtime/cargo-target-canvas-page-nokey-v1 cargo test --manifest-path gateway/Cargo.toml connected_fetch_mode_helpers_recognize_canvas_page_no_key_variants -- --nocapture`

### 4. 当前结论

这轮之后，关于 `canvas program-owned / no-key` 的最准确结论是：

- `share -> app create`
  - 仍然已 HTTP 化
  - 这条结论没有回退
- `invoke`
  - 当前**还没有**找到一个：
    - 无 official API key
    - caller-visible 成功
    - 可稳定复放
    的 direct invoke 合同
- 当前已验证到的 direct no-key 失败面，已经不再是模糊的“超时/挂住”，而是压缩成了：
  - `403 unregistered callers`
  - `400 XD3`
  - `401 credentials missing`
  - `1008 PolicyViolation`
  - `clients6 400 HTML`
  - `clients6 Failed to fetch`

因此当前正式语义仍应保持：

- `program-owned`
  - `no official key`
  - `default fail-closed`
  - `尚未发现可稳定复放的 no-key direct contract`

## 第一百四十六轮结果：`canvas program-owned` 默认主链切到无官方 key fail-closed 边界

这轮只继续推进 `gemini canvas web reverse / program-owned`，没有改动已冻结的 `gemini web reverse` 行为线。

本轮真正收口的是两件事：

1. Rust 主链现在不再允许 `program-owned` 默认消费显式 official Google API key。
   - `gateway/src/upstream/client.rs`
   - 新增了对 `googleApiKey / apiKeys / payload.api_key(AIza...)` 的硬检查
   - `prepare_gemini_canvas_runtime_api_payload_for_target(...)` 对 `gemini_canvas_program_web_reverse_compatible` 现在直接分成：
     - 若 payload / runtime material 仍带 official key：`gemini_canvas_program_official_api_key_forbidden`
     - 若没有 official key：`gemini_canvas_program_no_key_invoke_contract_missing`
   - `text / tts / image` 的 `program-owned` 路径也同步不再回 generic page chat / direct-http 旧语义，而是按 no-key contract 缺失显式失败。

2. Canvas program runtime/live/folder-sync 不再把 official key 当成 canonical 主链材料继续写回。
   - `deploy/test-gateway-protocol-matrix.py`
     - `gemini_canvas_program_live` 不再默认把 `googleApiKey / apiKeys` 写进 state 和 live provider payload
   - `deploy/materialize-gemini-canvas-program-runtime.ps1`
     - `browser-state.json` 不再默认写入 `googleApiKey / apiKeys`
   - `gateway/src/provider_credential_folder_sync.rs`
     - `program-owned` 的 browser-state import 现在忽略 `googleApiKey / apiKeys`
   - `gateway/src/upstream/gemini/canvas_program_web_reverse/handle.rs`
     - strip handle hints 时，会一并清掉 `googleApiKey / apiKeys / authToken`

这轮之后，`canvas program-owned` 的正式结论应固定为：

- `share -> app create` 仍然已 HTTP 化
- 之前 `text / tts / music / image / video` 的 browserless official invoke 成功或 gate 命中，全部降级为 **evidence-only**
- 当前 `program-owned` 默认主链的正式标准已经收口成：
  - **无 official API key**
  - **无浏览器兜底**
  - **无 no-key contract 就 fail-closed**

下一步不再是继续复用 official key 成功，而是只剩一个问题：

- 找到真正可被 `program-owned` 使用的 **no-key app-native contract**
- 在没有 `googleApiKey / apiKeys` 的前提下 caller-visible 成功

## 目的

本文件用于跟踪 `Gemini official_api`、`Gemini web_reverse`、`Gemini canvas_web_reverse`
这一轮结构性重构的实际推进状态。

它属于执行跟踪文档，不是新的仓库级规则 owner。

当前正式规则仍以：

- `AGENTS.md`
- `rules/多Surface模块化开发守则.md`
- `rules/gemini-modular-development-rule.md`
- `rules/多AI重任务声明与轮询守则.md`
- `docs/20-ai-gateway/*`

为准。

---

## 当前目标

这一轮不是要求 Gemini 三条线立刻达到“完全独立编译”的终态。

这一轮的真实目标是：

1. 先把三条实现线的代码 ownership 继续拆清楚
2. 先把 modular 入口整理得更像长期 owner
3. 先阻止新逻辑继续回流到 legacy 巨型文件
4. 再为后续逐步逼近 line-level 独立编译打基础

---

## 当前边界

### 1. `official_api`

- owner `google_gemini_api`
- owner `google_vertex_gemini`
- owner conversation / live / model catalog 的官方 API 语义

### 2. `web_reverse`

- owner generic Gemini Web reverse
- owner generic StreamGenerate replay
- 可承接从 legacy web 线迁出的 generic reverse 逻辑

### 3. `canvas_web_reverse`

- owner true Canvas 线
- 当前再细分：
  - `browser-owned relay`
  - `program-owned relay`
  - 必要的 runtime / relay helper

---

## 当前判断

- `Gemini web_reverse` 当前需求完成度已经较高
- `Gemini canvas_web_reverse` 当前属于部分完成、但已有可用 modular 基线
- 当前第一优先级不是继续扩功能
- 当前第一优先级是**按三条线把代码结构做优雅化重构**

---

## 当前验证基线

当前已确认存在以下 modular 归档，可作为本轮重构的行为基线：

- `official_api`
  - `output/gemini-three-surface-google-gemini-api-modular-full-fixture-20260505-v2`
- `web_reverse`
  - `output/gemini-three-surface-gemini-web-reverse-modular-full-fixture-20260505-v1`
- `canvas_web_reverse` text / tts
  - `output/gemini-three-surface-gemini-canvas-browser-relay-modular-text-tts-fixture-20260505-v5`
- `canvas_web_reverse` media
  - `output/gemini-three-surface-gemini-canvas-browser-relay-modular-media-fixture-20260505-v1`

这意味着：

- 第一轮结构性重构必须优先保住这些 modular 行为面
- 不允许为了“目录更漂亮”把这些基线重新打坏

---

## 重任务规则

本轮默认采用“多 agent 并行轻任务 + 单重任务令牌串行重验证”的模式。

当前约束：

1. 子 agent 可以并行阅读、编辑、迁移各自线内代码
2. `cargo check / build / test`
3. fixture
4. browser live
5. Docker build

以上动作都必须走：

- `deploy/claim-heavy-task.ps1`
- `deploy/release-heavy-task.ps1`
- `.runtime/ai-heavy-task-declaration.json`

同一时刻默认只允许一个 `heavy_active`。

---

## Phase 列表

### Phase 0. 边界冻结与执行跟踪

- [x] 创建本轮 MASTER 跟踪
- [x] 初始化重任务声明文件
- [x] 明确三条线的 owner 边界

### Phase 1. 模块入口结构化

- [x] `official_api` 从单文件模块整理成目录模块
- [x] `web_reverse` 从单文件模块整理成目录模块
- [x] `canvas_web_reverse` 从单文件模块整理成目录模块
- [x] `shared/common` 入口整理成长期可扩展结构
- [ ] 不再把 Gemini 新逻辑直接堆进 legacy 大文件

### Phase 2. official_api owner 收口

- [ ] official modular 协议层继续薄化并明确 owner
- [ ] official modular upstream 层继续薄化并明确 owner
- [ ] official 与 legacy `gemini_api.rs` 的剩余迁移清单落文档

### Phase 3. web_reverse owner 收口

- [ ] web reverse bootstrap / request / response 的 owner 边界继续收口
- [ ] web reverse 与 legacy `gemini_web.rs` / `upstream/client.rs` 的剩余迁移清单落文档

### Phase 4. canvas_web_reverse owner 收口

- [ ] browser-owned relay 边界继续收口
- [ ] program-owned relay 边界继续收口
- [ ] canvas runtime / handle / relay helper 边界继续收口
- [ ] 不把 generic web reverse 冒充成 true Canvas owner

### Phase 5. 协议层 legacy façade 收口

- [x] `official_api` legacy 收成 façade + 最小兼容测试
- [x] `web_reverse` legacy 收成 `re-export + thin wrappers`
- [ ] `canvas_web_reverse` 继续下沉 builder / template / signaller 以进一步压薄 legacy

### Phase 6. 控制面与运行时追平

- [ ] routing / keepalive / folder sync 中 Gemini 三线语义继续显式化
- [ ] 逐步减少基于旧 adapter 名和旧 payload 形状的隐式特判

### Phase 7. 独立编译逼近

- [ ] 先做到独立 ownership + 独立验证产物 + 独立 `CARGO_TARGET_DIR`
- [ ] 再逐步逼近 feature-gated line-level compile

---

## 当前状态

- Current Status: `gemini official_api 本轮已继续 owner 化并重新完成 fresh smoke + full fixture 验证；legacy/modular live 都已收窄成最小 smoke 且 10/10，全矩阵 fixture 两条线都 45/45。下一阶段先冻结 official_api，再继续转向 canvas 无 key 主线。`
- Active Focus:
  - `official_api` 剩余 client.rs 薄壳/重复 helper 继续下沉
  - `canvas_web_reverse` 后续改成明确无官方 API key 的 fail-closed 主线
  - 路由 / keepalive / folder sync 对 Gemini 三线语义的显式化

## 第一百四十六轮结果：`official_api` 的 music/video 根因已修正，legacy/modular live 与 full fixture 全部打绿

本轮重新把重点拉回 `Gemini official_api`，不动已冻结的 `gemini web reverse` 行为线，也不继续推进 `canvas_web_reverse`。目标是把当前 official owner 彻底站稳，再作为后续 `canvas` 无 key 改造的稳定基线。

### 1. 当前已确认并修掉的两个真实根因

1. `music`
   - `gateway/src/upstream/gemini/api/media.rs`
   - `consume_music_server_content(...)` 原先只尝试从：
     - `serverContent.modelTurn.parts[].inlineData`
     抽音频
   - 但当前真实官方 ws 成功样本走的是：
     - `serverContent.audioChunks[]`
   - 本轮已改成优先消费 `audioChunks`，仍兼容旧 `modelTurn.parts[].inlineData` 形状
2. `video`
   - `gateway/src/protocol/gemini/api/media.rs`
   - 当前官方 `predictLongRunning` 不接受默认 `1:1`
   - 本轮新增：
     - `video_aspect_ratio_from_request(...)`
   - 语义固定为：
     - 若 caller 未显式提供 `size/aspect_ratio`
     - official video 默认宽高比使用 `16:9`
   - `gateway/src/upstream/gemini/api/media.rs`
     - `execute_official_video(...)` 已改成消费这条默认视频宽高比

### 2. official live suite 已收窄成最小 smoke

- `deploy/test-gateway-protocol-matrix.py`
  - 新增 `GOOGLE_GEMINI_API_LIVE_SMOKE_CASE_IDS`
  - 当前 `google_gemini_api_live` / `google_gemini_api_modular_live` 默认 text bridge 不再遍历整套 `GEMINI_FULL_CASE_IDS`
  - 最小 smoke 现在固定为：
    - `gemini_generate_content.basic.nonstream`
    - `gemini_generate_content.basic.stream`
    - `oa_chat.basic.nonstream`
    - `oa_responses.basic.nonstream`
    - `oa_audio_speech.basic`
    - `images_generations.image.url`
    - `images_generations.image.b64`
    - `music_generations.music.basic`
    - `videos_generations.video.basic`
    - `oa_models.list.get`
  - `video.basic` 的 live request 也显式补了：
    - `size = 16:9`

### 3. official owner 继续从 `client.rs` 收回模块

- `gateway/src/upstream/client.rs`
  - `execute_gemini_canvas_official_media(...)`
    - 现在已退成薄壳，直接调用：
      - `gateway/src/upstream/gemini/api/media.rs::execute_official_media(...)`
  - 当前已删除不再需要的旧 wrapper：
    - `execute_gemini_canvas_official_text(...)`
    - `execute_gemini_canvas_official_tts(...)`
    - `execute_gemini_canvas_official_image(...)`
- 仍保留在 `client.rs` 的 official 残留：
  - `execute_gemini_canvas_official_music(...)`
  - `execute_gemini_canvas_official_video(...)`
  - 这两条目前仍承接 `program/runtime override seam`，后续应继续下沉到 `official_api` owner

### 4. 本轮验证

编译与定向测试：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - `pass`
- `python -m py_compile deploy/test-gateway-protocol-matrix.py`
  - `pass`
- `CARGO_TARGET_DIR=.ggoff2 cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- `CARGO_TARGET_DIR=.ggoff2 cargo test --manifest-path gateway/Cargo.toml official_video_defaults_to_sixteen_by_nine_when_size_unspecified -- --nocapture`
  - `1 passed`
- `CARGO_TARGET_DIR=.ggoff2 cargo test --manifest-path gateway/Cargo.toml consume_music_server_content_accepts_audio_chunks_shape -- --nocapture`
  - `1 passed`
- `CARGO_TARGET_DIR=.ggoff2 cargo test --manifest-path gateway/Cargo.toml gemini_api_surface_supports_text_tts_and_media_families -- --nocapture`
  - `1 passed`

isolated official gateway：

- 重新构建镜像：
  - `neuro-gateway:gemini-official-v5`
- 重新启动隔离容器：
  - `deploy-gateway-gemini-official-42374`
  - `http://127.0.0.1:42374`

fresh live：

- `output/google_gemini_api_live_smoke_20260509_v3`
  - `10/10`
- `output/google_gemini_api_modular_live_20260509_v1`
  - `10/10`

full fixture：

- `output/google_gemini_api_full_fixture_20260509_v1`
  - `45/45`
- `output/google_gemini_api_modular_full_fixture_20260509_v1`
  - `45/45`

### 5. 当前结论

- `Gemini official_api`
  - 当前 legacy / modular 两条 caller-visible official 线都已经重新打绿
  - `text / stream / tts` caller-visible 成功
  - `music` caller-visible 成功
  - `image / video` 当前 caller-visible 落在官方 quota/plan gate accepted
  - 这意味着：
    - official owner 已命中真实官方端点
    - 当前阻碍主要是 provider gate，而不是实现未完成
- `gemini web reverse`
  - 本轮没有改动其行为线
- 下一阶段
  - 先正式冻结/提交 `official_api`
  - 然后再把 `canvas_web_reverse` 改成明确无官方 API key 的 fail-closed 主线

## 第一百四十五轮结果：默认 `canvas program-owned` 主链切成 fail-closed 的纯 browserless/app-interface 路由

本轮继续只做 `gemini canvas web reverse / program-owned`，不碰已冻结的 `gemini web reverse` 行为线。目标不是再新增一条 browserless 支线，而是把当前默认主链里残留的 connected client / browser execution fallback 真正切掉。

### 1. Rust 默认主链本轮收口

- `gateway/src/upstream/client.rs`
  - `text`
    - `execute_gemini_canvas_program_direct_http_json_with_context(...)` 失败后不再回退 connected client `canvas_proxy`
    - `execute_gemini_canvas_direct_http_stream_generate_text(...)` 失败后不再回退旧的 program-owned browser execution
    - 若没有可用 browserless contract，直接返回：
      - `gemini_canvas_program_text_browserless_contract_missing`
  - `tts`
    - `generateContent` 失败后不再回退 connected client `canvas_proxy`
    - pure HTTP TTS 失败后不再回退旧的 program-owned browser execution
    - 若没有可用 browserless contract，直接返回：
      - `gemini_canvas_program_tts_browserless_contract_missing`
  - `image`
    - program-owned image direct invoke 失败后不再静默回退 connected client `canvas_proxy`
  - `video create / poll / download`
    - 三段 direct invoke 失败后都不再回退 connected client `canvas_proxy`
  - `should_treat_gemini_canvas_program_modular_media_direct_http_as_authoritative(...)`
    - 对 `gemini_canvas_program_web_reverse_compatible` 默认返回 `true`
    - 这意味着默认 `program-owned` media 主链现在就是 fail-closed 的 browserless authoritative 路由

### 2. focused browserless 复验

- `text`
  - `output/gemini_canvas_program_browserless_failclosed_text_20260509_v1/summary.json`
  - `status = 200`
- `tts`
  - `output/gemini_canvas_program_browserless_failclosed_tts_20260509_v1/summary.json`
  - `status = 200`
- `music`
  - `output/gemini_canvas_program_browserless_failclosed_music_20260509_v1/summary.json`
  - `status = 101`
  - `executionPath = official_music_ws_browserless`
  - 远端官方 websocket 仍可直连成功
- `image`
  - `output/gemini_canvas_program_browserless_failclosed_image_20260509_v1/summary.json`
  - `status = 429`
  - `error = image_official_gate`
  - 失败面仍是官方 quota gate，而不是浏览器 relay
- `video create`
  - `output/gemini_canvas_program_browserless_failclosed_video_20260509_v1/summary.json`
  - `status = 429`
  - `error = video_official_gate`
  - 失败面仍是官方 quota gate，而不是浏览器 relay

### 3. 编译与定向验证

- `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
  - 独立 target：`.gcv-browserless3`
- `cargo test --manifest-path gateway/Cargo.toml program_direct_http_authoritative_when_adapter_is_program_owned -- --nocapture`
  - `1 passed`

### 4. 当前结论

- `share -> app create`
  - 已正式 HTTP 化
- `invoke`
  - `text / tts / music`
    - 已 caller-visible browserless 成功
  - `image / video create`
    - 已 browserless 命中官方端点
    - 当前 caller-visible 失败面是 provider gate，不是浏览器依赖
- 更关键的是：
  - 默认 `canvas program-owned` 主链现在已经不再默认回退：
    - connected client `canvas_proxy`
    - 旧的 program-owned browser execution
  - 当前这条实现线默认应按 `fail-closed browserless` 来理解
- 仍未在本轮完成的事：
  - full live steady-state 的整体验证还没重新 fresh 跑
  - 所以不能把本轮 focused 结论直接夸大成“整条 live 已全量无浏览器”

## 第一百四十四轮结果：`canvas program-owned` 的 create 已正式 HTTP 化，invoke 的 browserless focused 证据已分层收口

本轮继续只做 `gemini canvas web reverse / program-owned`，不碰已冻结的 `gemini web reverse` 行为线。目标固定为两段式判断：

1. `share -> canvas app` 创建是否可 browserless
2. 后半段 invoke 是否可 browserless，以及哪些模态已经拿到实证

### 1. create：已正式 HTTP 化并接入 Rust 主链

- `gateway/src/upstream/gemini/canvas_program_web_reverse/bootstrap.rs`
  - 已具备 `ujx1Bf` 纯 HTTP create request builder / response parser
- `gateway/src/upstream/client.rs`
  - `ensure_gemini_canvas_program_payload_handle(...)` 现在默认先尝试 pure HTTP create
  - 只有拿不到 concrete handle 时，才回退浏览器 discovery
- focused 证据：
  - `output/gemini_canvas_program_create_pure_http_20260509_v1/summary.json`
  - 返回：
    - `programUrl = https://gemini.google.com/app/4abc4e7577b6149f`
    - `appPath = /app/4abc4e7577b6149f`
    - `conversationId = c_4abc4e7577b6149f`
    - `responseId = r_1d583cfb0fa7aee4`

### 2. invoke：browserless focused 结果已按模态分层落定

- 新增正式脚本：
  - `gateway/scripts/probe-gemini-canvas-program-browserless-invoke.mjs`
- 该脚本当前 focused 覆盖：
  - `text`
  - `tts`
  - `music`
  - `image`
  - `video-create`
- 脚本语义：
  - 只读 materialized `browser-state.json` 与导出的 `storage-state.json`
  - 不调用 connected client
  - 不调用 browser pool
  - 不走 `ws://127.0.0.1:9998`
  - 只做 browserless direct invoke focused probe

#### 2.1 已 caller-visible 成功

- `text`
  - `output/gemini_canvas_program_browserless_invoke_2026-05-09T01-08-54-053Z/summary.json`
  - `status = 200`
  - `responseText = "ok"`
- `tts`
  - `output/gemini_canvas_program_browserless_invoke_2026-05-09T01-09-20-969Z/summary.json`
  - `status = 200`
  - 已落出 `tts-audio.pcm / tts-audio.wav`
- `music`
  - `output/gemini_canvas_program_browserless_invoke_2026-05-09T01-08-53-995Z/summary.json`
  - `status = 101`
  - `audioChunkCount = 1`
  - 已落出 `music-audio.pcm / music-audio.wav`
  - 这条证据说明 `music` 后半段不是本地 connected client 必需，服务端可直连远端官方 websocket

#### 2.2 已命中官方端点，但当前被 provider gate 挡住

- `image`
  - exact minimal request 证据：
    - `output/gemini_canvas_program_browserless_image_exact_20260509_v1/summary.json`
  - 当前失败面：
    - `429 quota gate`
  - 这说明 `image` 后半段已能 browserless 命中官方 `generateContent`
- `video create`
  - exact minimal request 证据：
    - `output/gemini_canvas_program_browserless_video_exact_20260509_v1/summary.json`
  - 当前失败面：
    - `429 quota gate`
  - 这说明 `video create` 后半段已能 browserless 命中官方 `predictLongRunning`
  - 正式脚本也已收口到相同 gate：
    - `output/gemini_canvas_program_browserless_invoke_2026-05-09T01-38-38-740Z/summary.json`

#### 2.3 仍未完全收口的点

- `image` 的正式脚本 summary 目前仍会在后续多尝试中继续落到 `imagen` paid-plan gate
  - 但第一跳最强证据仍是：
    - `output/gemini_canvas_program_browserless_invoke_2026-05-09T01-14-59-623Z/image.google-api-official.attempt-01.response.json`
    - 对应 `429 quota gate`

### 3. Rust 主链本轮修正

- `gateway/src/upstream/client.rs`
  - `connect_gemini_canvas_music_socket(...)`
    - 不再向远端音乐 websocket query 注入 `authuser`
  - `execute_gemini_canvas_official_music(...)`
    - 不再自动注入 Google 明确不认的 `music_generation_config.durationSeconds`
- 新增测试：
  - `gemini_canvas_music_socket_url_with_api_key_only_appends_key_query`

### 4. 编译验证

- `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
  - 独立 target：`.gcv-browserless2`
- `cargo test --manifest-path gateway/Cargo.toml --lib gemini_canvas_music_socket_url_with_api_key_only_appends_key_query -- --exact --nocapture`
  - 完成 test binary 编译并返回 `0`
  - 当前过滤下显示 `0 passed / 1379 filtered out`

### 5. 当前结论

- `share -> app create`
  - 已 browserless
- `invoke`
  - `text / tts / music`
    - 已有 browserless caller-visible focused success
  - `image / video create`
    - 已有 browserless focused probe 与 exact-request 命中官方端点证据
    - 当前失败面是 provider gate，而非浏览器刚需
- 但整条 `canvas program-owned` steady-state
  - 还不能宣布“完全无需浏览器”
  - 当前仍应保持更准确表述：
    - `browserless feasibility has been proven for create and several invoke modalities`
    - `full steady-state browserless replacement remains partial`

### 2026-05-08 Canvas Program-Owned 当前推进

- 已把 `gemini_canvas_program_live` 的 live/bootstrap 输入链继续收口到：
  - `materialized runtime / program-handle`
  - `googleApiKey / apiKeys / authToken`
  - `canvasProgramInvokeContract`
- `deploy/test-gateway-protocol-matrix.py`
  - `extract_gemini_canvas_program_live_state(...)` 现在会优先从：
    - materialized runtime
    - relay browser-state
    - 显式 env
    - AIStudio live cloud key evidence
    提取 `googleApiKey / apiKeys / authToken`
  - `ensure_gemini_canvas_program_live_provider(...)` 会把这些字段写回：
    - provider payload
    - credential payload
    - `extraBody`
- `deploy/materialize-gemini-canvas-program-runtime.ps1`
  - 现在会把 `googleApiKey / apiKeys / authToken` 一并落入 runtime browser-state
- `gemini_canvas_program_live` suite loop
  - 现在会按当前 case 的 `operation` 自动触发 `HandleOnly` probe/materialize
  - 不再把 share 下“最新但 operation 不匹配”的 handle 直接复用给所有 media/text case
- 当前 focused 结论：
  - `canvas program-owned` 后半段已经不再应该依赖 `g.a...` 页面 token
  - `g.a...` 直打 `generativelanguage.googleapis.com` 会返回 `401 ACCESS_TOKEN_TYPE_UNSUPPORTED`
  - 当 `canvas_proxy_request` 同一路径带显式可用的 official Google API key 时，可直接返回 caller-visible `200`
  - `text` focused case 已在 gateway program-owned 主链 caller-visible pass
  - `image.url` focused case 先在 `video` handle 下失败为 `gemini_canvas_image_mode_unavailable`，随后在自动对齐 `image` operation handle 后 caller-visible pass
  - 当前 `connected fetch identity contract` 与 `prefers_canvas_proxy_contract` 已开始从 `client.rs` 下沉到：
    - `gateway/src/upstream/gemini/canvas_program_web_reverse/browser_operation.rs`
  - 这一步的目标是把 websocket/connected-fetch 的 owner 真相继续从 generic client glue 中剥出来，避免后续继续被误读成 browser-owned 废弃线

---

## 本轮结果

本轮已完成：

1. `shared` 从单文件整理成目录模块
2. `official_api` 协议层 / upstream 层从单文件整理成目录模块
3. `web_reverse` 协议层 / `web_reverse_media_prompt` / upstream 层从单文件整理成目录模块
4. `canvas_web_reverse` 与 `canvas_program_web_reverse` 的协议层 / upstream 层从单文件整理成目录模块
5. 初始化 `.runtime/ai-heavy-task-declaration.json`
6. 使用重任务令牌 + 独立 `CARGO_TARGET_DIR` 跑通一次 `gateway cargo check`
7. 第二轮沿三条线继续把 legacy `protocol` 逻辑下沉到 modular owner 目录
8. 第二次使用重任务令牌 + 独立 `CARGO_TARGET_DIR` 跑通 `gateway cargo check`
9. 第三次与第四次继续下沉后，累计又跑通三轮 `gateway cargo check`

当前验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无结构性编译错误
  - 备注：存在若干既有 warning，主要集中在 legacy `upstream/client.rs`、`db/*`、`keepalive.rs` 与旧 Gemini 线遗留代码

---

## 第二轮下沉结果

### official_api

- `gateway/src/protocol/gemini_api.rs`
  - 约 `1203 -> 87` 行
- 已下沉：
  - request packing
  - normalize / inbound canonicalize
  - tool packing
  - streaming / SSE state machine
  - default path/query
  - response parsing 入口与部分 helper
- 下一轮重点：
  - 若继续收 protocol 层，只剩 façade 与最小 compat test

### web_reverse

- `gateway/src/protocol/gemini_web.rs`
  - 约 `1361 -> 94` 行
- 已下沉：
  - constants / types owner
  - bootstrap parse / merge / app path
  - header extraction
  - request building
  - response classify / response parse / SSE translate
- 下一轮重点：
  - 若继续收 protocol 层，只剩 `re-export + thin wrappers`

### canvas_web_reverse

- `gateway/src/protocol/gemini_canvas.rs`
  - 约 `8394 -> 7033` 行
- 已下沉：
  - runtime/model/locale/output-count
  - prompt 组织
  - image/music/text request builders
  - image/video/music response builders
  - generateContent / imagen / TTS export 轻解析
  - stream / locator / conversation-list / video-job 轻解析
- 下一轮重点：
  - preflight / template / builder 大块
  - image-edit upload normalize
  - signaller / media 状态机

---

## 备注

这一轮默认采用：

- copy-only / parallel new structure
- legacy 行为优先保留
- 先结构优雅化
- 再继续向独立编译推进

---

## 第三轮结果：official_api upstream 第一执行层下沉

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/api/**`

本轮未处理：

- `protocol` 目录
- `web_reverse`
- `canvas_web_reverse`
- 编译 / 测试 / heavy task

本轮已完成：

1. 新增 `gateway/src/upstream/gemini/api/execution.rs`
2. 将 `client.rs` 中 `gemini_api_compatible | gemini_api_modular_compatible` 的 `forced streaming + accumulate` 执行分支，下沉为 modular owner helper
3. 将 `generateContent` JSON 的最自然非流式 parse helper 命名入口收进 modular owner，并在 `client.rs` 内替换相关直接调用

当前 `client.rs` 中 Gemini official upstream 仍剩余的主要债务：

- adapter 分支判定仍在 `client.rs`
- debug 文案与 request-plan 调度仍在 `client.rs`
- `build_request_plan(...)` 仍通过 `UpstreamClient::build_request_plan(...)` 统一入口绕到 modular owner
- streaming SSE fake-openai bridge 仍经 `self.execute(...)` 统一上层调度

---

## 第四轮结果：web_reverse upstream 第一执行层下沉

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/web_reverse/**`

本轮未处理：

- `protocol` 目录
- `official_api`
- `canvas_web_reverse`
- legacy mixed lane 媒体深逻辑
- 编译 / 测试 / heavy task

本轮已完成：

1. 新增 `gateway/src/upstream/gemini/web_reverse/headers.rs`
2. 新增 `gateway/src/upstream/gemini/web_reverse/bootstrap.rs`
3. 新增 `gateway/src/upstream/gemini/web_reverse/execution.rs`
4. 将 `client.rs` 中 `execute_gemini_web` 下沉为 modular owner `execute(...)`
5. 将 `client.rs` 中 `execute_gemini_web_stream` 下沉为 modular owner `execute_stream(...)`
6. 将 `client.rs` 中 `bootstrap_gemini_web_app` 下沉为 modular owner `bootstrap_app(...)`
7. 将 `client.rs` 中 `build_gemini_web_headers` 下沉为 modular owner `build_headers(...)`
8. `client.rs` 仅保留薄 wrapper，并把 Gemini Web 浏览器 hints/header 注入继续复用既有 helper，避免复制第二套逻辑

当前 `client.rs` 中 web_reverse upstream 仍剩余的主要债务：

- adapter 分支判定与执行入口路由仍在 `client.rs`
- `gemini_web_reverse_modular_compatible` 的 payload coercion 仍在 `client.rs`
- 与 Gemini Web 共享的 Canvas / mixed-lane 大块仍在 `client.rs`
- 其他调用点对 `build_gemini_web_headers(...)` 的依赖虽然已变薄，但还没有进一步切到更细粒度 execution context

---

## 第五轮结果：official_api upstream 第二执行层收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/api/**`

本轮未处理：

- `protocol` 目录
- `web_reverse`
- `canvas_web_reverse`
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `gateway/src/upstream/gemini/api/execution.rs` 新增：
   - `supports_fake_openai_sse_bridge_endpoint(...)`
   - `prepare_forced_streaming_request(...)`
   - `build_fake_openai_sse_bridge(...)`
2. `client.rs` 中 official forced-stream 分支不再内联：
   - `build_request_plan(..., true)`
   - `build_upstream_headers_with(...)`
3. `client.rs` 中 official streaming fake-openai SSE bridge 不再内联：
   - endpoint `matches!(...)`
   - `canonical -> sse bytes` 包装
4. `gateway/src/upstream/gemini/api/mod.rs` 现在显式 re-export 这批 upstream owner helper

当前 `client.rs` 中 Gemini official upstream 仍剩余的主要债务：

- adapter 分支判定仍在 `client.rs`
- `self.send_plan(...)` 与 debug 文案仍在 `client.rs`
- `build_request_plan(...)` 的统一入口仍由 `UpstreamClient::build_request_plan(...)` 驱动
- 真正底层 accumulate / parse 仍继续复用 legacy `protocol::gemini_api`

---

## 第六轮结果：web_reverse upstream 第二执行层收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/web_reverse/**`

本轮未处理：

- `protocol` 目录
- `official_api`
- `canvas_web_reverse`
- legacy mixed lane 媒体深逻辑
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `gateway/src/upstream/gemini/web_reverse/legacy_mixed_lane.rs` 新增：
   - `supports_legacy_mixed_lane_text_endpoint(...)`
   - `legacy_mixed_lane_text_payload(...)`
   - `legacy_mixed_lane_tts_payload(...)`
   - `legacy_mixed_lane_media_payload(...)`
2. `gateway/src/upstream/gemini/web_reverse/mod.rs` 正式 re-export 这些 coercion helper
3. `client.rs` 中 `gemini_web_reverse_modular_compatible` 的：
   - text accumulate 分支
   - text stream 分支
   - media passthrough coercion
   - TTS passthrough coercion
   现在都通过 modular helper 走，不再内联 endpoint 判定与 payload 强转
4. 删除 `client.rs` 中 4 个仅剩包装意义的薄 wrapper：
   - `execute_gemini_web(...)`
   - `execute_gemini_web_stream(...)`
   - `bootstrap_gemini_web_app(...)`
   - `build_gemini_web_headers(...)`

当前 `client.rs` 中 web_reverse upstream 仍剩余的主要债务：

- 顶层 dispatch 仍在 `client.rs`
- modular-compatible 目前仍通过 coercion 后借道 Canvas legacy text / stream executor
- legacy mixed lane 媒体深逻辑仍集中在 `client.rs`
- 仍有少量 Canvas / pure-http / preflight 调用点以 Gemini Web headers 为底座

---

## 第七轮结果：canvas_program upstream 第二执行层收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_program_web_reverse/**`

本轮未处理：

- `gateway/src/upstream/gemini/canvas_web_reverse/**`
- `protocol/**`
- signaller / 大状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 新增 `gateway/src/upstream/gemini/canvas_program_web_reverse/result.rs`
2. 将原本散在 `client.rs` 的 program-owned 结果结构下沉为 modular owner：
   - `GeminiCanvasBrowserPoolResult`
   - `GeminiCanvasBrowserPoolError`
   - `GeminiCanvasBrowserInvocationResult`
   - `GeminiCanvasBrowserMediaAsset`
   - `GeminiCanvasBrowserFetchInvocationResult`
3. 新增并下沉：
   - `parse_program_browser_invocation_response(...)`
   - `parse_program_bootstrap_invocation_response(...)`
   - `parse_connected_fetch_invocation_response(...)`
   - `runtime_patch_from_browser_invocation(...)`
   - `runtime_patch_from_browser_fetch(...)`
4. `client.rs` 中以下函数都进一步变薄：
   - `execute_gemini_canvas_connected_fetch_json_with_program_context(...)`
   - `execute_gemini_canvas_browser_request_with_program_context(...)`
   - `execute_gemini_canvas_program_bootstrap_request(...)`
   - `ensure_gemini_canvas_program_payload_handle(...)`
5. 对应测试也已收口到 `gateway/src/upstream/gemini/canvas_program_web_reverse/tests.rs`

当前 `client.rs` 中 canvas upstream 仍剩余的主要债务：

- `ensure_gemini_canvas_program_payload_handle(...)` 仍保留 browser pool 获取、bootstrap 调用、persist/merge/incomplete 语义
- browser-owned 老 parse / classify 块尚未开始收口
- `execute_gemini_canvas_modular_browser_relay_media(...)` 仍是 program/browser 双分支混合大主流程
- direct-http media follow-up / page poll / conversation recovery / signaller 仍属于深水区

---

## 第八轮验证：upstream 第二波集中编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `22174` 行
    - `gateway/src/protocol/gemini_api.rs` `87` 行
    - `gateway/src/protocol/gemini_web.rs` `94` 行
    - `gateway/src/protocol/gemini_canvas.rs` `7033` 行
    - `gateway/src/upstream/gemini/api/execution.rs` `73` 行
    - `gateway/src/upstream/gemini/web_reverse/legacy_mixed_lane.rs` `64` 行
    - `gateway/src/upstream/gemini/canvas_program_web_reverse/result.rs` `431` 行
  - 备注：仍有既有 warning，主要集中在 legacy `upstream/client.rs`、`db/*`、`keepalive.rs` 与部分未完全收口的 Gemini 旧块

---

## 第九轮结果：official_api upstream 第三波 helper 接口化

本轮只处理：

- `gateway/src/upstream/gemini/api/**`

本轮未处理：

- `gateway/src/upstream/client.rs`
- `web_reverse`
- `canvas_web_reverse`
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `gateway/src/upstream/gemini/api/execution.rs` 新增 official adapter 常量：
   - `GEMINI_API_LEGACY_ADAPTER`
   - `GEMINI_API_MODULAR_ADAPTER`
2. 新增 `OfficialExecuteContext<'a>`，把：
   - `provider`
   - `plan`
   - `headers`
   收成统一 owner 侧执行上下文
3. 新增：
   - `is_official_adapter(...)`
   - `supports_forced_streaming_accumulate(...)`
   - `supports_fake_openai_sse_bridge(...)`
   - `prepare_execute_context(...)`
   - `prepare_forced_streaming_execute_context(...)`
   - `prepare_nonstreaming_execute_context(...)`
4. `gateway/src/upstream/gemini/api/mod.rs` 现在继续 re-export 这批 helper
5. 补了最小测试，覆盖：
   - official adapter 判定
   - fake-openai SSE bridge 适用条件
   - execute-context 的 stream / non-stream 两种变体

这一轮的意义：

- 先把 official adapter / endpoint / execute-context 的判断知识收口到 modular owner
- 主线程后续只需要很薄地做接线，不必继续手写第二套 official 判定逻辑

---

## 第十轮结果：web_reverse upstream 第三波 mixed-lane 分类收口

本轮只处理：

- `gateway/src/upstream/gemini/web_reverse/**`

本轮未处理：

- `gateway/src/upstream/client.rs`
- `official_api`
- `canvas_web_reverse`
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `gateway/src/upstream/gemini/web_reverse/legacy_mixed_lane.rs` 新增：
   - `LegacyMixedLaneEndpointClass`
   - `is_legacy_mixed_lane_adapter(...)`
   - `classify_legacy_mixed_lane_endpoint(...)`
   - `legacy_mixed_lane_payload_for_endpoint(...)`
   - `supports_legacy_mixed_lane_tts_endpoint(...)`
2. 保留并重建在新分类语义之上的旧 helper：
   - `legacy_mixed_lane_text_payload(...)`
   - `legacy_mixed_lane_tts_payload(...)`
   - `legacy_mixed_lane_media_payload(...)`
3. `gateway/src/upstream/gemini/web_reverse/mod.rs` 继续把这些 mixed-lane 判定接口正式导出
4. 在 `legacy_mixed_lane.rs` 内联补了最小测试，覆盖：
   - modular adapter 识别
   - `Text / Tts / Other` endpoint 分类
   - `legacy_mixed_lane_payload_for_endpoint(...)` 的 coercion 边界
   - specialized helper 与统一分类语义的一致性

这一轮的意义：

- mixed-lane endpoint 分类知识不再只能散落在 `client.rs`
- 后续主线程可以逐步只保留：
  - `legacy_mixed_lane_payload_for_endpoint(...)`
  - `is_legacy_mixed_lane_adapter(...)`
  这样的 owner 接口，而不是继续手写分支

---

## 第十一轮结果：canvas browser-owned upstream 第三波结果解析收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/**`

本轮未处理：

- `gateway/src/upstream/gemini/canvas_program_web_reverse/**`
- `protocol/**`
- signaller / direct-http / media 状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 新增 `gateway/src/upstream/gemini/canvas_web_reverse/result.rs`
2. 将 browser-owned 结果结构下沉为独立 owner：
   - `GeminiCanvasBrowserOwnedPoolResult`
   - `GeminiCanvasBrowserOwnedPoolError`
   - `GeminiCanvasBrowserOwnedInvocationResult`
   - `GeminiCanvasBrowserOwnedMediaAsset`
   - `GeminiCanvasBrowserOwnedFetchInvocationResult`
3. 在 `result.rs` 中新增并收口：
   - `parse_browser_invocation_response(...)`
   - `parse_connected_fetch_invocation_response(...)`
   - `parse_browser_pool_result(...)`
   - `classify_browser_pool_failure(...)`
4. 为了让 browser-owned 结果与 program-owned 主流程继续兼容，在 `result.rs` 中增加：
   - browser-owned -> program-owned 的 `From` 转换
5. `client.rs` 中以下函数明显变薄：
   - `execute_gemini_canvas_browser_request(...)`
   - `execute_gemini_canvas_connected_fetch_json_with_mode(...)`
6. 顶部原本属于 browser-owned 的结果结构定义已不再由 `client.rs` owner
7. 对应测试已收口到 `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`

当前 browser-owned / 混合大块仍然保留在 `client.rs` 的主要部分：

- 请求 input JSON 组装仍在本地
- `execute_gemini_canvas_connected_fetch_json(...)` 的 browser-owned fallback wrapper 仍在
- `execute_gemini_canvas_browser_request_with_recovery(...)` 的 retry loop 仍在
- `execute_gemini_canvas_modular_browser_relay_text(...)`
- `execute_gemini_canvas_modular_browser_relay_tts(...)`
- `execute_gemini_canvas_modular_browser_relay_media(...)`
- 多处 `remote browser executor -> serde_json::from_value::<...>` 的混合解析点仍未收

---

## 第十二轮验证：upstream 第三波集中编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `22079` 行
    - `gateway/src/upstream/gemini/api/execution.rs` `233` 行
    - `gateway/src/upstream/gemini/web_reverse/legacy_mixed_lane.rs` `209` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `288` 行
    - `gateway/src/upstream/gemini/canvas_program_web_reverse/result.rs` `431` 行
  - 备注：warning 数量未显著变化，仍主要集中在 legacy `upstream/client.rs`、`db/*`、`keepalive.rs` 与 Gemini 深水区旧块

---

## 第十三轮结果：canvas browser-owned request builder 收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/browser_operation.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `gateway/src/upstream/gemini/canvas_web_reverse/browser_operation.rs` 新增：
   - `build_browser_operation_invocation_input_from_values(...)`
   - `build_connected_fetch_invocation_input(...)`
2. 既有 `build_browser_operation_invocation_input(...)` 现在改为建立在新的 values 版 builder 之上
3. `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs` 继续显式导出这批 browser-owned builder
4. `client.rs` 中以下两处不再自己拼浏览器池 invocation JSON：
   - `execute_gemini_canvas_browser_request(...)`
   - `execute_gemini_canvas_connected_fetch_json_with_mode(...)`
5. `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` 补了最小测试，覆盖：
   - browser-owned invocation input 的关键字段
   - connected fetch input 的 fetchRequest 形状与 referrer

这一轮的意义：

- `client.rs` 不再 owner browser-owned 浏览器池请求体的 JSON 形状
- browser-owned 的 request-side 协议知识也开始和 result-side 一样，回收到 `canvas_web_reverse/**`

---

## 第十四轮验证：browser-owned request builder 再次编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `22070` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/browser_operation.rs` `83` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `288` 行
  - 备注：warning 数量仍基本不变，说明这一步主要是结构收口，没有引入新的编译面债务

---

## 第十五轮结果：canvas browser-owned remote decode 与 retry policy 收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/result.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` 新增：
   - `parse_remote_browser_invocation_value(...)`
   - `browser_request_retry_delay_ms(...)`
2. `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs` 正式导出这两个 helper
3. `client.rs` 中 6 处 browser-owned / modular browser-owned 的 remote executor 回包解析，已经不再直接：
   - `serde_json::from_value::<GeminiCanvasBrowserInvocationResult>(...)`
   而是统一通过 `parse_remote_browser_invocation_value(...)`
4. `client.rs` 中 `execute_gemini_canvas_browser_request_with_recovery(...)` 的 retry 规则，不再自己持有：
   - 可重试 code 判定
   - quota gate 例外
   - backoff delay 计算
   这些知识现在统一通过 `browser_request_retry_delay_ms(...)`
5. `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` 补了最小测试，覆盖：
   - remote executor payload decode
   - browser-owned retry policy

这一轮的意义：

- browser-owned 的回包 decode 与 retry policy 不再散在 `client.rs`
- 下一步继续收 browser-owned wrapper 时，不需要再重复碰这些解析与判定细节

---

## 第十六轮结果：旧 browser-backed image/music/video invocation input 收口

本轮只处理：

- `gateway/src/upstream/client.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 旧 browser-backed `image / music / video` 三条 remote executor 调用，不再在 `client.rs` 内联拼：
   - `baseUrl / shareId / runtimeStateObjectKey / operation / prompt / locale / timeoutMs / browserExecutablePath`
2. 这三处现在统一复用：
   - `canvas_web_reverse::build_browser_operation_invocation_input_from_values(...)`

这一轮的意义：

- browser-owned 请求体 builder 进一步向 `canvas_web_reverse/**` 集中
- 旧 browser-backed 与新 modular browser-owned 请求形状开始共用同一 builder

---

## 第十七轮验证：remote decode / retry policy / 旧 browser-backed builder 再次编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `22045` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/browser_operation.rs` `83` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `322` 行
  - 备注：warning 数量仍保持基本稳定，说明本轮仍然是在消化结构债务，而不是制造新的编译负担

---

## 第十八轮结果：canvas browser-owned execution wrapper 收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 新增 `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs`
2. 将 browser-owned 的 4 个执行 wrapper 下沉为 modular owner：
   - `execute_connected_fetch_json_with_mode(...)`
   - `execute_connected_fetch_json(...)`
   - `execute_browser_request(...)`
   - `execute_browser_request_with_recovery(...)`
3. `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs` 现在继续显式导出这批 execution helper
4. `client.rs` 中以下函数已经变成薄接线：
   - `execute_gemini_canvas_connected_fetch_json(...)`
   - `execute_gemini_canvas_connected_fetch_json_with_mode(...)`
   - `execute_gemini_canvas_browser_request(...)`
   - `execute_gemini_canvas_browser_request_with_recovery(...)`

这一轮的意义：

- browser-owned 的请求体 builder、回包解析、retry policy、fallback wrapper 已经开始完整地回收到 `canvas_web_reverse/**`
- `client.rs` 在 browser-owned 这条线只剩真正的主流程编排，不再承担底层浏览器池协议 owner

---

## 第十九轮验证：browser-owned execution wrapper 编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 首次编译暴露一个真实接线错误：
  - `client.rs` 调 modular `execute_browser_request(...)` 时漏传了 `prompt / locale`
- 当轮本地修复后立即重跑
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `21957` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs` `187` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/browser_operation.rs` `83` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `322` 行
  - 备注：warning 数量仍保持基本稳定；本轮唯一真实错误已经在同轮修复并复编通过

---

## 第二十轮结果：canvas browser-owned text/tts 收尾 helper 收口

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/result.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` 新增：
   - `require_text_result(...)`
   - `extract_text_or_body_text(...)`
   - `decode_inline_audio_payload(...)`
2. `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs` 正式导出这批收尾 helper
3. `client.rs` 中以下收尾逻辑不再自己持有：
   - program-owned text 结果缺失校验
   - modular browser relay TTS inline 音频 decode
   - browser-backed TTS inline 音频 decode
   - browser-backed text 的 `text || bodyText` 选择
4. `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` 补了最小测试，覆盖：
   - `require_text_result(...)`
   - `decode_inline_audio_payload(...)`

这一轮的意义：

- browser-owned text/tts 的结果收尾开始和 request/decode 一样回收到 `canvas_web_reverse/**`
- `client.rs` 不再继续散持 text 缺失校验与 inline audio base64 解码细节

---

## 第二十一轮结果：ownership 浏览器执行统一 helper 收口

本轮只处理：

- `gateway/src/upstream/client.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `client.rs` 新增：
   - `persist_gemini_canvas_program_runtime_result_if_needed(...)`
   - `execute_gemini_canvas_owned_browser_invocation(...)`
2. `execute_gemini_canvas_modular_browser_relay_text(...)` 的 program-owned browser fallback，已经不再自己内联：
   - program/browser ownership 分支
   - program runtime patch persist
3. `execute_gemini_canvas_modular_browser_relay_tts(...)` 也已改为统一走 `execute_gemini_canvas_owned_browser_invocation(...)`
4. `execute_gemini_canvas_modular_browser_relay_media(...)` 的 image/music/video 三个 browser pool fallback 分支，也已切到同一个 ownership helper

这一轮的意义：

- `program/browser` 交界处最重复的一层已经被吃掉
- program-owned 的 runtime patch 持久化从多处手写调用，收成了统一路径
- 下一步继续拆 media 总控时，不需要再重复处理这层 ownership 分支

---

## 第二十二轮验证：text/tts 收尾 helper + ownership 执行统一 helper 编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 其中经历两次现场修复：
  - 第一次是 `canvas_web_reverse/result.rs` 缺 `base64::Engine` trait import
  - 第二次是 `media` 三个分支把 `if ... else ...` 结果表达式改成 helper 后，少了结尾分号
- 每次修复后都在同轮立即重跑
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `22048` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs` `176` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/browser_operation.rs` `83` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `445` 行
  - 备注：warning 数量仍保持基本稳定；本轮新增错误都属于结构收口过程中的现场接线问题，已在同轮修复并复编通过

---

## 第二十三轮结果：media 结果选择语义接线

本轮只处理：

- `gateway/src/upstream/client.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 下载状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. `execute_gemini_canvas_modular_browser_relay_media(...)` 的 image 分支，不再自己手写：
   - `result.media.iter().filter(kind == "image")`
   而是改为复用：
   - `canvas_web_reverse::collect_image_media_assets(...)`
2. music 分支不再自己手写：
   - `find(kind == "video" || kind == "audio")`
   而是改为复用：
   - `canvas_web_reverse::require_music_media_asset(...)`
3. video 分支不再自己手写：
   - `find(kind == "video")`
   而是改为复用：
   - `canvas_web_reverse::require_video_media_asset(...)`

这一轮的意义：

- image/music/video 的 media 资产选择语义继续从 `client.rs` 往 `canvas_web_reverse/result.rs` 回收
- 下一步继续拆 media 总控时，主线程已经不需要重复关心每种 endpoint 到底该从 `result.media` 里挑什么

---

## 第二十四轮验证：media 结果选择语义接线编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `22034` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs` `176` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/browser_operation.rs` `83` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `445` 行
  - 备注：warning 数量仍保持基本稳定；说明这一刀继续只是在压缩结构重复，而没有引入新的编译面债务

---

## 第二十五轮结果：media remote-or-owned 调度统一

本轮只处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/result.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/mod.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 下载状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `client.rs` 新增：
   - `execute_gemini_canvas_remote_or_owned_browser_invocation(...)`
2. 这个 helper 统一了：
   - `remote browser executor` 优先尝试
   - fallback 到 `execute_gemini_canvas_owned_browser_invocation(...)`
   - remote result parse 复用 `canvas_web_reverse::parse_remote_browser_invocation_value(...)`
3. image/music/video 三个 modular media 分支，已经不再各自重复手写：
   - `execute_remote_browser_executor(...)`
   - `if let Some(result) ... else browser_pool_fallback`
4. `canvas_web_reverse/result.rs` 里新增：
   - `convert_media_asset(...)`
   - `collect_converted_image_media_assets(...)`
   - `build_music_generation_response_from_invocation(...)`
   - `build_video_generation_response_from_invocation(...)`
5. `canvas_web_reverse/mod.rs` 已导出这批 media response helper
6. `canvas_web_reverse/execution.rs` 新增：
   - `build_image_generation_response_from_invocation(...)`

这一轮的意义：

- media 三段里最粗的一层 `remote executor -> browser pool fallback` 调度已经被统一
- music/video 的响应组装开始真正离开 `client.rs`
- image 的 URL/bytes 双路径收尾也开始进入 `canvas_web_reverse/execution.rs`

---

## 第二十六轮结果：music/video 响应组装接线 + image 响应执行接线

本轮只处理：

- `gateway/src/upstream/client.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / 更深的 media 下载策略
- 编译 / 测试 / heavy task

本轮已完成：

1. image 分支现在直接复用：
   - `canvas_web_reverse::build_image_generation_response_from_invocation(...)`
2. music 分支现在直接复用：
   - `canvas_web_reverse::build_music_generation_response_from_invocation(...)`
3. video 分支现在直接复用：
   - `canvas_web_reverse::build_video_generation_response_from_invocation(...)`
4. 这意味着 `client.rs` 不再自己负责：
   - image 的 URL/bytes 收尾路径拼接
   - music/video 的 asset 选取后响应对象组装

这一轮的意义：

- `execute_gemini_canvas_modular_browser_relay_media(...)` 继续从“大函数里一段一段手工收尾”，收成“高层编排 + 调 owner helper”
- 下一步继续拆时，重心已经收敛到 image 资源下载细节和 media 总控剩余分支，而不再是基础响应组装

---

## 第二十七轮验证：media remote-or-owned 调度与响应组装接线编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 其中经历两次现场修复：
  - 第一次是 `canvas_web_reverse/execution.rs` 缺 `base64::Engine` import，且 `mod.rs` 漏导出 `build_image_generation_response_from_invocation(...)`
  - 第二次是 image 分支调用 async helper 时漏 `.await`
- 每次修复后都在同轮立即重跑
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `21966` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs` `257` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `496` 行
  - 备注：warning 数量仍基本稳定；本轮新增错误依旧是结构收口时的现场接线问题，均已在同轮修复并复编通过

---

## 第二十八轮结果：media response helper 测试补齐

本轮只处理：

- `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / direct-http / media 下载状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 为新收口的 media response helper 补了纯单测：
   - `collect_converted_image_media_assets(...)`
   - `build_music_generation_response_from_invocation(...)`
   - `build_video_generation_response_from_invocation(...)`
2. 这些测试确保：
   - inline image payload 会继续保留在转换后的 asset 上
   - music/video 响应 helper 会使用已选中的 asset 并产出正确 object/mime shape

这一轮的意义：

- 后续继续拆 media 总控时，至少 asset 选择与响应组装这层已经有稳定护栏
- 不需要等到更重的 integration 场景，才能发现 response helper 是否跑偏

---

## 第二十九轮验证：media helper 测试补齐后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `21956` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/execution.rs` `257` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/result.rs` `496` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `637` 行
  - 备注：warning 数量仍保持基本稳定；说明这轮主要是在补足结构收口后的测试护栏，而不是引入新的编译面变化

---

## 第三十轮结果：modular media program fallback 编排收口

本轮只处理：

- `gateway/src/upstream/client.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- `canvas_web_reverse/**`
- signaller / direct-http 深层状态机
- 编译 / 测试 / heavy task

本轮已完成：

1. 在 `client.rs` 新增：
   - `maybe_execute_gemini_canvas_program_modular_media_direct_http(...)`
2. 这个 helper 统一了 `execute_gemini_canvas_modular_browser_relay_media(...)` 里三条分支共用的一层：
   - program adapter 判定
   - `image / music / video` 各自 pure-http 直尝试
   - 失败后的 debug 记录
   - 再 fallback 到后续 browser-owned 编排
3. `image / music / video` 三条 modular media 分支，不再各自重复手写：
   - `if adapter == gemini_canvas_program_web_reverse_compatible`
   - `match self.execute_*_direct_http(...).await`
   - `Ok(body) => return Ok(body)`
   - `Err(error) => debug!(...)`

这一轮的意义：

- `execute_gemini_canvas_modular_browser_relay_media(...)` 继续从“三段并排的重复编排”往“高层分支 + 共享 helper”收
- 当前最厚的一层重复已经不再是 browser invocation，而是更上面这层 program fallback 壳；本轮就是把这层先收掉

---

## 第三十一轮验证：program fallback 收口后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 备注：warning 仍主要集中在既有 legacy 债务，不是这一轮 modular media fallback 收口引入的新阻塞

---

## 第三十二轮结果：两份 direct-http 风格 image materialize 循环合并 + image 纯单测补齐

本轮处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- `canvas_web_reverse/execution.rs`
- signaller / direct-http 深层状态机
- live / browser 集成测试

本轮已完成：

1. 在 `client.rs` 新增：
   - `materialize_gemini_canvas_direct_http_images(...)`
2. 这个 helper 统一了两份 direct-http 风格 image 收尾里的共用循环：
   - inline `body_base64` decode
   - remote image asset fetch
   - `GeminiCanvasImage` 组装
3. 当前至少以下两处不再各自重复维护这段循环：
   - direct HTTP image lane
   - program pure HTTP image lane
4. 在 `canvas_web_reverse/tests.rs` 补了 image 路径的纯单测护栏，包括：
   - `collect_converted_image_media_assets(...)` metadata 透传
   - `decode_inline_image_asset(...)` 的 `None` fast path
   - `build_image_generation_response_from_invocation(...)` 的 `url` 成功路径
   - `build_image_generation_response_from_invocation(...)` 的 inline `b64_json` 成功路径
   - `build_image_generation_response_from_invocation(...)` 的缺 asset / 非法 inline base64 / 非法 response_format 失败路径

这一轮的意义：

- `client.rs` 里两份最接近的 direct-http image materialize 循环已经被合并，不再继续平行漂移
- image builder 终于有了与 music / video 对齐的纯契约测试，不必等到更重的集成场景才发现 response 组装跑偏

---

## 第三十三轮验证：direct-http image helper 与 image 纯单测补齐后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `22986` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `958` 行
  - 备注：warning 数量和分布仍保持基本稳定；说明这轮主要是在继续压 Gemini Canvas modular image 编排与补测试护栏，而不是引入新的编译面风险

---

## 第三十四轮结果：direct-http image inline decode 继续归口到 owner helper

本轮处理：

- `gateway/src/upstream/client.rs`
- `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs`

本轮未处理：

- `protocol/**`
- signaller / conversation / page-poll 深层状态机
- live / browser 集成测试

本轮已完成：

1. `client.rs` 的 `materialize_gemini_canvas_direct_http_images(...)` 不再自己手写 inline image base64 decode
2. 当前 direct-http image materialize 已直接复用：
   - `canvas_web_reverse::decode_inline_image_asset(...)`
3. `canvas_web_reverse/tests.rs` 继续补了一条 browser-owned image metadata 保真测试：
   - `parse_browser_invocation_response(...)` 现在会显式断言 `bodyBase64 / alt / width / height`

这一轮的意义：

- direct-http image 与 browser-owned modular image 的 inline image 错误语义进一步收口到同一 owner helper
- browser-owned image payload 中真正会影响后续组装的 metadata 不再处于“无人断言”的状态

---

## 第三十五轮验证：owner helper 归口与 image metadata 测试后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 备注：warning 分布无明显变化，说明这一轮主要是继续把 inline image 语义归口到 owner 模块，而不是扩大编译面

---

## 第三十六轮结果：image-edit async follow-up waterfall 协调壳抽离

本轮主要处理：

- `gateway/src/upstream/client.rs`

本轮未处理：

- `protocol/**`
- `canvas_program_web_reverse/**`
- signaller / post-ack / conversation / page-poll 各 lane 的底层 HTTP worker
- live / browser 集成测试

本轮已完成：

1. 在 `client.rs` 新增：
   - `try_resolve_gemini_canvas_image_edit_async_followups(...)`
2. 这个 helper 接管了 image-edit 专属的异步 settlement 协调壳：
   - `signaler`
   - `post-ack`
   - `conversation`
   - `page-poll`
3. `extract_gemini_canvas_media_assets_with_followup(...)` 不再内联这一整段 waterfall，而是只负责：
   - 判定是否进入 image-edit async follow-up
   - 调用新的协调 helper
   - 处理其成功 / 失败返回

这一轮的意义：

- `extract_gemini_canvas_media_assets_with_followup(...)` 继续从“大状态机 owner”往“高层入口 + 明确子协调层”收
- 这次切的是比 `media` 壳层更真实的复杂度来源：image-edit 的 async follow-up waterfall，而不是继续只做表层整齐化

---

## 第三十七轮验证：image-edit waterfall 协调壳抽离后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现一次真实接线问题：
  - 新 helper 需要保留 `mut image_edit_followup_context`，否则无法连续 `as_deref_mut()`
- 现场修复后立即重跑
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 备注：说明这次 image-edit waterfall 抽离已经落稳，剩余 warning 仍主要是既有 legacy 债务

---

## 第三十八轮结果：client.rs 纯函数护栏补齐

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 补了 `recent conversation selector` 的纯单测：
   - prompt 匹配优先于单纯最新项
   - 过旧 / 不可用项不会误选
2. 补了 `pure_http error classifier` 的纯单测：
   - browser challenge
   - session invalid
   - image unavailable
   - generic upstream fallback

这一轮的意义：

- 现在 `client.rs` 里 direct-http / followup 主链的两个关键纯判定点，不再完全裸奔
- 后续继续切 locator / followup / conversation recovery 时，至少已有一层稳定的行为护栏

---

## 第三十九轮验证：client.rs 纯函数护栏补齐后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23120` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `966` 行
  - 备注：当前 warning 仍是既有分布；这几轮说明我们已经从“media 壳层整齐化”进一步进入了 image-edit async follow-up 与 pure-http 判定层的真实结构收口

---

## 第四十轮结果：locator fallback 继续归口到共享 helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `resolve_gemini_canvas_followup_locator(...)`
2. 这个 helper 统一了两处重复的 locator 入口语义：
   - `extract_stream_generate_locator(stream_body)`
   - `Image / Video` 丢 locator 时退回 `payload` 里的 concrete handle
   - 统一 debug 语义与 root `/app` fallback 逻辑
3. 当前至少以下两处不再各自内联这一整段：
   - `execute_gemini_canvas_direct_http_media_followup_body(...)`
   - `poll_gemini_canvas_media_assets_from_conversation_page(...)`

这一轮的意义：

- `locator -> payload concrete handle fallback` 这层已经不再散在两个重函数里各写一遍
- 后续继续切 follow-up / page-poll 时，可以把 locator 判定当成已收口的前置层

---

## 第四十一轮结果：page seed 准备层抽离 + TTS export 纯 helper 测试补齐

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasPageSeed`
   - `prepare_gemini_canvas_page_seed(...)`
2. 这个 helper 统一了两处共用的 page-seed 准备层：
   - `app_bootstrap_url`
   - `share_bootstrap_url`
   - `conversation_page_url`
   - `prefer_root_app_path`
   - `has_page_url_override`
3. 当前至少以下两处不再各自重复维护这一层：
   - `execute_gemini_canvas_direct_http_media_followup_body(...)`
   - `poll_gemini_canvas_media_assets_from_conversation_page(...)`
4. 同轮补了 TTS export 纯 helper 测试：
   - `extract_gemini_canvas_direct_http_tts_audio_url(...)`
   - `select_gemini_canvas_direct_http_tts_audio_mime_type(...)`

这一轮的意义：

- `client.rs` 里两个 deepest follow-up/page-poll 大函数的前半段已经开始共享 page seed 真相层，而不只是共享零散工具函数
- TTS export fallback 至少有了纯字符串 / MIME 决策层的测试护栏

---

## 第四十二轮验证：page seed 抽离后的第一次编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- 首轮 `cargo check`
  - status: `fail_then_fix`
  - 真实问题：
    - page-poll 中还残留旧变量 `override_conversation_url`
  - 处理：
    - 改为复用新的 `conversation_url`
- 修复后立即重跑

这一轮的意义：

- 说明 page-seed 抽离没有方向性错误，问题只是一次局部旧变量残留
- 这种错误在同轮被清掉后，不会再反向污染结构收口

---

## 第四十三轮验证：page seed 抽离与 TTS helper 测试后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23202` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `966` 行
  - 备注：warning 分布仍维持在既有 legacy 区域；说明这轮继续把 Gemini Canvas 的深层 follow-up / page-poll 决策层往共享 seed 方向收，而没有扩大新的编译面风险

---

## 第四十四轮结果：locator fallback helper 纯逻辑测试补齐

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 为 `resolve_gemini_canvas_followup_locator(...)` 补了最小纯逻辑护栏：
   - `Image` 缺 stream locator 时可吃到 payload concrete handle fallback
   - `Music` 仍然坚持 stream locator contract，不会偷偷走 payload handle fallback

这一轮的意义：

- 新抽出的 locator helper 不再只有编译通过，而是至少对最关键的 fallback 语义有直接断言
- 后续继续切 follow-up / page-poll 决策层时，这个入口已经有一层稳定契约

---

## 第四十五轮结果：TTS export helper 纯测试补齐

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 为 `extract_gemini_canvas_direct_http_tts_audio_url(...)` 补了纯字符串测试：
   - 还原 `\\u003d / \\u0026 / \\/`
   - 多链接场景下优先选音频样式 URL
   - 末尾 `, ; .` 裁剪
2. 为 `select_gemini_canvas_direct_http_tts_audio_mime_type(...)` 补了纯 MIME 决策测试：
   - `content-type` 优先于 URL 后缀
   - `.ogg` / `.mp3` 回退
   - 默认 `audio/wav`

这一轮的意义：

- direct-http TTS export/fallback 这条链现在至少有了一层纯 helper 护栏
- 不需要等到更重的 followup/export 集成场景，才能发现 URL 解析或 MIME 决策跑偏

---

## 第四十六轮验证：locator helper 与 TTS export helper 测试后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 备注：warning 分布继续稳定；说明这一轮继续补的 mostly 是深层 pure helper / decision seam 护栏，而不是新的运行时扩面

---

## 第四十七轮结果：bootstrap candidate / poll url 纯 helper 抽离

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `build_gemini_canvas_followup_bootstrap_candidates(...)`
   - `build_gemini_canvas_page_poll_urls(...)`
2. 这两个 helper 把 `concrete page / /app / /share` 的候选页面决策从两个大函数里抽出来：
   - `execute_gemini_canvas_direct_http_media_followup_body(...)`
   - `poll_gemini_canvas_media_assets_from_conversation_page(...)`
3. 同轮补了最小纯测试：
   - bootstrap candidates 的顺序与去重
   - forced root 且无 override 时 page poll 不应误把 concrete page 放进候选首层

这一轮的意义：

- `page target` 这层现在不只是有 seed helper，还有纯列表决策 helper
- 后续继续切 deeper follow-up / page-poll 时，不再需要在大函数里反复维护候选页面集合语义

---

## 第四十八轮验证：page target 列表 helper 抽离后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现一次真实接线问题：
  - page-poll 里还残留旧变量 `override_conversation_url`
- 处理：
  - 改为复用新的 `conversation_url`
- 修复后立即重跑

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误

---

## 第四十九轮结果：image-json fallback policy helper 抽离

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasDirectHttpImageJsonAction`
   - `GeminiCanvasDirectHttpImageJsonPolicy`
2. 这个 policy helper 统一了 direct-http image lane 里最分散的决策层：
   - 是否允许 legacy image-json fallback
   - 是否走 inline-preferred prefill
   - `StreamGenerate` 失败后应直接抛错还是转 JSON fallback
   - prefill 失败摘要该如何回挂到最终错误
3. `execute_gemini_canvas_media_direct_http(...)` 当前 image 分支不再靠 scattered `if + string key` 维护这套规则，而是改成：
   - 问 policy 要 `initial_action`
   - 记录 `prefill_failure_summary`
   - `on_stream_failure()` 决定下一步动作

这一轮的意义：

- image-json fallback 终于开始从“零散条件拼接”收成一个明确的纯决策层
- 后续如果继续补 `materialize recovery` 或 image-json seam 测试，不会再直接回到一堆散落分支里找规则

---

## 第五十轮结果：direct-http image response / recovery helper 落地

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `build_gemini_canvas_direct_http_image_response(...)`
2. 这个 helper 正式接住了 direct-http image 分支最后一段收尾：
   - image asset empty 检查
   - `response_format=url` 快路
   - `materialize_gemini_canvas_direct_http_images(...)`
   - `image_json_recovery_failure` 回挂
   - 最终 `build_openai_images_response_from_bytes(...)`
3. 这意味着 `execute_gemini_canvas_media_direct_http(...)` 的 image 分支现在更像：
   - 拿 primary stream body
   - 跑 follow-up / extract
   - 调 image response helper

这一轮的意义：

- direct-http image 主链的最后一段真实 owner 逻辑终于不再内嵌在 image 分支里
- `image-json recovery` 不再是散在主分支末尾的临时补丁逻辑，而有了正式落点

---

## 第五十一轮验证：image-json policy 与 image response helper 后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现一次真实结构问题：
  - `build_gemini_canvas_direct_http_image_response(...)` 此前只有调用，没有真正定义
- 处理：
  - 同轮补齐 helper 实现
- 修复后立即重跑

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23499` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `966` 行
  - 备注：warning 分布继续维持在既有 legacy 区域；说明这一轮主要是在把 deepest direct-http / follow-up / image-json recovery owner 逻辑继续拆成明确 helper，而不是扩大新的运行时风险面

---

## 第五十二轮结果：page target provenance 归口到 mode helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasPageTargetMode`
   - `classify_gemini_canvas_page_target_mode(...)`
2. 这个 helper 统一了两条深层 lane 里 scattered 的 page target provenance：
   - `forced_root_app`
   - `signaler_page_bootstrap`
   - `conversation_list_recovered`
   - `resolved`
   - `root_app_fallback`
3. `execute_gemini_canvas_direct_http_media_followup_body(...)` 与
   `poll_gemini_canvas_media_assets_from_conversation_page(...)`
   现在不再各自手写 mode 分类字符串

这一轮的意义：

- page target “当前是怎么来的” 终于收成显式语义，而不是散落字符串
- 后续继续切 follow-up target handoff 时，不需要再从日志文案里倒推 mode 规则

---

## 第五十三轮结果：follow-up preflight plan build 抽离

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasMediaFollowupPreflightPlan`
   - `build_gemini_canvas_media_followup_preflight_plan(...)`
2. 这个 helper 只抽 build，不抽 execution，统一了：
   - `mode_index`
   - `batchexecute_header_id`
   - `followup_model_header`
   - `activity_request`
   - `followup_request`
3. `execute_gemini_canvas_direct_http_media_followup_body(...)` 当前 parity-first / legacy-fallback 顺序不变，但不再自己拼这组 preflight 输入

这一轮的意义：

- write-side follow-up lane 里 “build preflight inputs” 和 “按顺序执行 preflight” 已经开始分层
- 后续继续切 deepest follow-up owner 时，可以保留 contract、只继续压 build/decision 层

---

## 第五十四轮验证：page target mode 与 preflight plan 抽离后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现一次真实接线问题：
  - `followup_model_header` 旧引用未切到 `preflight_plan`
- 处理：
  - 同轮改成 `preflight_plan.followup_model_header`
- 修复后立即重跑

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误

---

## 第五十五轮结果：image-json policy 完成 materialize recovery 收口

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `GeminiCanvasDirectHttpImageJsonPolicy` 新增：
   - `on_materialize_failure()`
2. `build_gemini_canvas_direct_http_image_response(...)` 不再自己持有：
   - `image_json_inline_preferred` 的 recovery 语义
   - `image_json_recovery_failure` 的裸布尔分支
3. 现在 image-json 这条链已经由同一 policy owner：
   - `initial_action()`
   - `note_prefill_failure(...)`
   - `on_stream_failure()`
   - `on_materialize_failure()`
4. 同轮补了纯测试，覆盖：
   - inline-preferred 模式下 materialize failure 应走 `image_json_recovery_failure`
   - non-inline 模式下 materialize failure 应直接回原错

这一轮的意义：

- direct-http image lane 里 legacy JSON fallback 的三条主要入口已经回到同一套策略对象
- `build_gemini_canvas_direct_http_image_response(...)` 更接近真正的 response builder，而不是半个 fallback owner

---

## 第五十六轮验证：materialize recovery 收口后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23670` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `966` 行
  - 备注：warning 仍主要停留在既有 legacy 区域；这一轮的实质是把 page target provenance、follow-up preflight plan、以及 image-json materialize recovery 继续从主函数里拉回明确 helper / policy 层

---

## 第五十七轮结果：follow-up target/source-path 状态对象化

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasFollowupTarget`
   - `GeminiCanvasImageTemplateRetryAction`
   - `classify_gemini_canvas_image_template_retry(...)`
2. `execute_gemini_canvas_direct_http_media_followup_body(...)` 不再手工并行维护：
   - `locator`
   - `followup_source_path`
   - `locator_mode`
   - `response_id / conversation_id`
3. video locator recovery 成功后，当前直接通过：
   - `GeminiCanvasFollowupTarget::adopt_video_recovered_locator(...)`
   完成 source-path 与 mode 的状态 handoff
4. image lane 里 `template-capable -> legacy heavy retry` 的 if 树，也已经收成纯决策层：
   - `ReturnOriginal`
   - `ReturnOriginalWithLog(...)`
   - `RetryLegacyTemplate`

这一轮的意义：

- deepest follow-up lane 的 owner 状态不再是散落的局部变量，而是有了明确对象
- image template retry 不再继续靠多段 if/else 隐式表达

---

## 第五十八轮验证：follow-up target 对象与 template retry policy 后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误

---

## 第五十九轮结果：follow-up preflight build 与 page-target 继续收口

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `GeminiCanvasMediaFollowupPreflightPlan` 正式接入
   - parity preflight
   - legacy preflight
   - video locator recovery 所需的 followup model header
2. `build_gemini_canvas_media_followup_preflight_plan(...)` 现在不再只是定义存在，而是真正成为 write-side follow-up lane 的 build 层 owner
3. 同轮补了纯测试：
   - `GeminiCanvasFollowupTarget` 的 bootstrap / recovered locator handoff
   - `classify_gemini_canvas_image_template_retry(...)`
   - `build_gemini_canvas_media_followup_preflight_plan(...)`

这一轮的意义：

- follow-up lane 里 “构建 preflight 输入” 和 “执行 preflight 顺序” 的分层更明确了
- 后续如果继续切 deepest follow-up 主链，不需要回头再拆 build 层

---

## 第六十轮验证：preflight build 真接线后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现一次真实接线问题：
  - `followup_model_header` 旧引用未切到 `preflight_plan`
- 处理：
  - 改为 `preflight_plan.followup_model_header`
- 修复后立即重跑

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误

---

## 第六十一轮结果：最终把 image-json recovery 三段决策完整收回 policy

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `GeminiCanvasDirectHttpImageJsonPolicy` 继续补齐：
   - `on_materialize_failure()` 正式接入 `build_gemini_canvas_direct_http_image_response(...)`
2. 现在 image-json fallback 的三条主要入口都已经回到一套 policy：
   - `prefill`
   - `stream failure`
   - `materialize failure`
3. `build_gemini_canvas_direct_http_image_response(...)` 现在更纯粹是：
   - direct-http image response builder
   - materialize 执行者
   - 按 policy 决定是否做 JSON recovery
4. 同轮补了 policy 的纯测试，覆盖：
   - `inline_preferred` 模式的 recovery
   - `url` 模式不做 recovery
   - `ImagesEdits` 禁用 legacy JSON fallback

这一轮的意义：

- image-json recovery 不再是 scattered fallback，而是完整的纯策略层
- direct-http image lane 的最后一块复杂 if 树已经明显收口

---

## 第六十二轮验证：follow-up target / preflight build / image-json policy 三层收口后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 多轮运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现的真实问题包括：
  - page-poll 旧变量残留
  - `build_gemini_canvas_direct_http_image_response(...)` 之前只有调用没有实现
  - `followup_model_header` 旧引用未切到 `preflight_plan`
- 均已在同轮修掉并立即重跑
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23806` 行
    - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `966` 行
  - 备注：虽然 `client.rs` 体量仍大，但这几轮已经把 deepest direct-http / follow-up / image-json recovery 的关键状态与策略明显从主函数中拉回 helper / policy 层

---

## 第六十三轮结果：image lane 主逻辑整体抽离为独立 lane helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `execute_gemini_canvas_direct_http_image_lane(...)`
2. 这个 helper 现在接住了 direct-http image 分支的整条主逻辑：
   - follow-up asset extraction
   - template-capable / legacy heavy retry
   - image response builder 调用
3. `execute_gemini_canvas_media_direct_http(...)` 不再自己内联 image lane 的大段 owner 逻辑，而是更接近：
   - 统一拿 stream body
   - 按 operation 分发到更明确的 lane helper

这一轮的意义：

- direct-http image lane 从“主函数中的最大分支”继续收成独立 owner
- 后续如果继续拆 image lane，不再需要回头在顶层 media direct-http 函数里打大补丁

---

## 第六十四轮结果：follow-up target/source-path 对象化继续落地

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `GeminiCanvasFollowupTarget` 真正接入 write-side follow-up lane
2. `execute_gemini_canvas_direct_http_media_followup_body(...)` 当前不再手工并行维护：
   - `locator`
   - `followup_source_path`
   - `response_id / conversation_id`
   - `mode`
3. video locator recovery 成功后，当前通过：
   - `GeminiCanvasFollowupTarget::adopt_video_recovered_locator(...)`
   显式完成 source-path + locator + mode 的 handoff
4. 同轮补了纯测试：
   - `GeminiCanvasFollowupTarget` bootstrap path / recovered locator handoff
   - `classify_gemini_canvas_image_template_retry(...)`

这一轮的意义：

- deepest follow-up lane 的核心状态不再散落成一串局部变量
- 后续继续拆 `followup target provenance` 或 source-path 决策时，已经有正式状态对象可以继续承载

---

## 第六十五轮验证：image lane helper 与 follow-up target 对象化后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 多轮运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间现场修掉的小问题包括：
  - `build_gemini_canvas_direct_http_image_response(...)` 旧签名/调用面收口
  - follow-up lane 中个别旧引用残留
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误

---

## 第六十六轮结果：最终把 deepest write-side follow-up build/state 层继续压薄

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `GeminiCanvasMediaFollowupPreflightPlan` 继续真接线
   - parity preflight
   - legacy preflight
   - video locator recovery 所需 followup model header
2. `GeminiCanvasPageTargetMode` 与 `GeminiCanvasFollowupTarget` 继续替换原来的 scattered mode / id / source-path 读取
3. 同轮继续清理 touched 区域里的新引入噪音，例如：
   - `unused mut` 的局部清理

这一轮的意义：

- deepest write-side follow-up 链现在更明显地分成：
   - page seed
   - page target mode
   - follow-up target state
   - preflight plan build
   - parity/legacy execution contract
- 这说明我们已经不只是“把逻辑挪出去”，而是在把大状态机整理成明确层次

---

## 第六十七轮验证：本轮继续收口后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 多轮运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23839` 行
  - 备注：`client.rs` 仍然很大，但当前最深的 direct-http image lane 和 write-side follow-up lane 已经从“巨型分支”进一步收成更明确的 lane helper / state object / plan builder / policy 层

---

## 第六十八轮结果：direct-http image lane 再拆成 assets resolver + response builder

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `resolve_gemini_canvas_direct_http_image_assets(...)`
2. `execute_gemini_canvas_direct_http_image_lane(...)` 当前不再自己同时承担：
   - image asset extraction
   - template-capable / legacy heavy retry
   - response builder 调用
3. 现在 image lane 已经更明确地拆成：
   - `resolve_gemini_canvas_direct_http_image_assets(...)`
   - `build_gemini_canvas_direct_http_image_response(...)`

这一轮的意义：

- direct-http image lane 自身也开始分层，不再只是“从顶层函数挪到了另一个大函数”
- 后续如果继续切 image lane，已经有了清楚的 `resolve -> build` 分工

---

## 第六十九轮验证：image lane 再拆分后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误

---

## 第七十轮结果：继续把 touched 区域收口进文档与量化

本轮处理：

- `docs/50-history/progress/gemini-three-surface-refactor-MASTER.md`

本轮已完成：

1. 同轮把新增 lane/helper 的结构变化继续写回进度文档
2. 当前量化更新为：
   - `gateway/src/upstream/client.rs` 约 `23872` 行
   - `gateway/src/upstream/gemini/canvas_web_reverse/tests.rs` `966` 行

这一轮的意义：

- 后续继续推进时，不需要再从会话回忆最新切到了哪一层
- 当前 `Gemini Canvas` 深层结构收口的里程碑已经完整落回仓库

---

## 第七十一轮结果：write-side follow-up attempt 循环抽成独立执行 helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasMediaFollowupAttemptState`
   - `GeminiCanvasMediaFollowupAttemptOutcome`
   - `execute_gemini_canvas_media_followup_attempts(...)`
   - `finalize_gemini_canvas_media_followup_attempt_state(...)`
   - `finalize_gemini_canvas_video_followup_result(...)`
2. `execute_gemini_canvas_direct_http_media_followup_body(...)` 不再自己内联：
   - `aPya6c` follow-up attempt loop
   - `last_body / last_error` 的低层累积
   - video completion + concrete page poll + final fallback 的整段收尾
3. write-side follow-up lane 现在更明确地分成：
   - page seed
   - page target / source-path state
   - preflight plan build
   - follow-up attempts
   - video-only completion/page-poll finalization

这一轮的意义：

- deepest write-side follow-up contract 已经不再由一个大函数完整背负
- video 专属 fallback 也有了自己更清楚的 owner helper，而不是继续内嵌在通用 follow-up 里

---

## 第七十二轮结果：direct-http image lane 继续拆成 resolve + build

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `resolve_gemini_canvas_direct_http_image_assets(...)`
2. 现在 image lane 已经继续细化为：
   - `resolve_gemini_canvas_direct_http_image_assets(...)`
   - `build_gemini_canvas_direct_http_image_response(...)`
3. `execute_gemini_canvas_direct_http_image_lane(...)` 当前不再自己背完整的：
   - asset extraction
   - template-capable / legacy heavy retry
   - response build / JSON recovery

这一轮的意义：

- `direct-http image lane` 自身已经不是“被挪出去的第二个大函数”，而开始形成内部真正分层
- 后续如果要继续拆 image lane，已经有稳定的 `resolve -> build` 切点

---

## 第七十三轮验证：follow-up attempt helper 与 image lane 二次拆分后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 多轮运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23990` 行
  - 备注：虽然 `client.rs` 仍然很大，但这轮说明最深的 direct-http image lane 与 write-side follow-up lane 都已经进一步拆成独立的 lane helper / execution helper / finalize helper，而不是继续在顶层主链里堆叠

---

## 第七十四轮结果：follow-up bootstrap/page-target 准备层正式接入 context helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `prepare_gemini_canvas_direct_http_media_followup_context(...)` 现在不再只是存在，而是正式接入
2. `execute_gemini_canvas_direct_http_media_followup_body(...)` 前半段当前不再自己持有：
   - page seed
   - bootstrap candidate 选择
   - bootstrap parse
   - session seed
   - 初始 follow-up target 构造
3. 同轮去掉了已多余的 `locator_recovered_from_list` 辅助状态写法，video recovery 直接走 `followup_target` handoff

这一轮的意义：

- write-side follow-up 大函数的前半段准备逻辑已经整体进入 context helper
- 主函数现在更接近“执行合同调度器”，而不是继续背准备细节

---

## 第七十五轮结果：video completion/page-poll 收尾抽成独立 finalize helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasMediaFollowupAttemptState`
   - `GeminiCanvasMediaFollowupAttemptOutcome`
   - `execute_gemini_canvas_media_followup_attempts(...)`
   - `finalize_gemini_canvas_media_followup_attempt_state(...)`
   - `finalize_gemini_canvas_video_followup_result(...)`
2. `execute_gemini_canvas_direct_http_media_followup_body(...)` 不再自己完整内联：
   - `aPya6c` follow-up attempt loop
   - `last_body / last_error` 聚合
   - video completion 失败后的 concrete page poll fallback
   - 最终 fallback 收尾

这一轮的意义：

- write-side follow-up contract 继续从“大状态机”收成“attempt helper + video finalize helper”
- video 专属路径已经不再混在通用 follow-up attempt loop 里

---

## 第七十六轮结果：顶层 media direct-http image 主入口完全移出

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `execute_gemini_canvas_direct_http_image(...)`
2. `execute_gemini_canvas_media_direct_http(...)` 当前已经更接近真正 dispatcher：
   - `Image` 直接转交独立入口
   - `Music / Video` 继续走自己的 direct-http 路线
3. 这意味着 top-level media direct-http 不再继续夹带 image 专属的：
   - image-json prefill / stream fallback
   - image-edit upload context
   - image stream replay body
   - image lane resolve/build 调度

这一轮的意义：

- 顶层 media direct-http 终于开始体现“分 lane owner”而不是“统一大函数里分 if”
- 后续继续拆 image lane 或 music/video lane，不再需要先回到顶层主函数里改入口

---

## 第七十七轮验证：follow-up context / video finalize / top-level image lane 后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 多轮运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现的真实问题主要是：
  - bootstrap context helper 中 `bootstrap` move 后又读取字段
  - 少量旧引用未切到新 helper / state
- 均已在同轮修掉并重跑
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `24056` 行
  - 备注：虽然 `client.rs` 仍然很大，但当前 `Gemini Canvas` 最深的 direct-http image lane、follow-up attempts、video finalize、以及 follow-up context 准备层都已经从顶层/主函数中继续拆成更明确的 owner helper

---

## 第七十八轮结果：write-side follow-up bootstrap/context 准备层正式整体接入

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `prepare_gemini_canvas_direct_http_media_followup_context(...)` 现在不再只是定义存在，而是正式接入 `execute_gemini_canvas_direct_http_media_followup_body(...)`
2. `execute_gemini_canvas_direct_http_media_followup_body(...)` 的前半段准备层已整体收走：
   - page seed
   - bootstrap candidate 选择
   - bootstrap parse
   - session seed
   - 初始 follow-up target 构造
3. 这意味着 write-side follow-up 主函数更像真正的执行协调器，而不是继续自己背着全部准备逻辑

这一轮的意义：

- `Gemini Canvas` 最深 follow-up lane 现在已经不只是“把某些小工具抽出去”，而是开始把成段准备层整个迁走
- 后续继续拆 execution contract 时，前半段准备上下文已经有正式落点

---

## 第七十九轮结果：video finalize 与 follow-up attempts 主体拆分进一步落地

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `execute_gemini_canvas_media_followup_attempts(...)` 已真正接住 `aPya6c` attempt loop 本体
2. `finalize_gemini_canvas_video_followup_result(...)` 已真正接住：
   - video completion poll
   - concrete page poll fallback
   - 与 `last_body / last_error` 的最终收尾
3. `execute_gemini_canvas_direct_http_media_followup_body(...)` 当前更清楚地分成：
   - context prepare
   - preflight build
   - attempt execution
   - video finalize
   - generic finalize

这一轮的意义：

- deepest write-side follow-up contract 已经进一步分层，不再继续把 video 专属 fallback 混在通用 follow-up 本体里
- 后续若继续切这条链，优先会落在更窄的 execution-contract seam，而不是回到大状态机

---

## 第八十轮结果：顶层 image dispatcher 继续收口

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `execute_gemini_canvas_direct_http_image(...)` 现在已真正成为 image 专属入口
2. `execute_gemini_canvas_media_direct_http(...)` 当前对 `Image` 分支只负责转交，不再夹带：
   - image-json policy 初始化
   - image-edit upload context
   - image stream body
   - image lane resolve/build 细节
3. 顶层 media direct-http 进一步接近真正的 dispatcher 语义

这一轮的意义：

- 现在 `Image` 与 `Music/Video` 在顶层已经开始体现更明确的 lane owner 分工
- 后续继续优化 image lane 时，不再需要先回到顶层主函数里做大块搬运

---

## 第八十一轮验证：本轮继续收口后的编译

本轮验证方式：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR`
- 多轮运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现的真实问题主要是：
  - follow-up context helper 中 `bootstrap` move 后又读取字段
  - 个别旧引用未切到新 helper/state
- 均已在同轮修掉并重跑
- 完成后 release heavy token

验证结果：

- `cargo check`
  - status: `pass_after_fix`
  - crate: `gateway`
  - target dir: `.runtime/cargo-target-gemini-structure-main`
  - 结果：通过，无新的结构性编译错误
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `24056` 行
  - 备注：当前 `Gemini Canvas` 最深的 direct-http image lane、follow-up context、follow-up attempts、video finalize 都已经从顶层大函数继续分离出来；虽然还没到彻底完成，但剩余工作已经更明显地收敛到少数深层 execution-contract seam

---

## 第八十二轮结果：image primary body 合同显式拆成 StreamBody / FinalResponse

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `GeminiCanvasDirectHttpImagePrimaryResult`
   - 新增显式枚举：
     - `StreamBody(String)`
     - `FinalResponse(Value)`
2. `execute_gemini_canvas_direct_http_image_primary_body(...)`
   - 不再把：
     - `StreamGenerate` 正常 body
     - legacy inline JSON 直接完成响应
   - 混成同一个 `Result<String, GatewayError>` 合同
3. `execute_gemini_canvas_direct_http_image(...)`
   - 当前先消费 `GeminiCanvasDirectHttpImagePrimaryResult`
   - 若是 `FinalResponse(Value)` 则立即结束 image lane
   - 若是 `StreamBody(String)` 才继续进入 `execute_gemini_canvas_direct_http_image_lane(...)`

这一轮的意义：

- image primary body 这一层终于把“继续走 stream lane”和“已经完成调用”两类结果在类型层面彻底拆开
- 后续继续拆 image lane 时，不会再反复踩 `String vs Value` 的合同错配

本轮验证：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`
  - 修复了本轮 `execute_gemini_canvas_direct_http_image_primary_body(...)` 引入的 `expected String, found Value` 回归

---

## 第八十三轮结果：follow-up 失败优先级合同收紧并补纯测试护栏

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `build_gemini_canvas_media_followup_missing_asset_error(...)`
   - 对 `aPya6c` follow-up 拿到 body 但解析不到 usable media asset 的情况，显式生成缺资产错误
   - 错误正文保留：
     - `locator_mode`
     - `app_path`
     - `response_id`
     - `conversation_id`
     - `attempt`
     - `body_preview`
2. `execute_gemini_canvas_media_followup_attempts(...)`
   - 现在当 follow-up body 不含 usable asset 时，会同时记录：
     - `last_body`
     - `last_error = gemini_canvas_media_followup_missing_asset`
   - 不再把“有 body 但没资产”默认为可直接透传的半成功状态
3. `finalize_gemini_canvas_media_followup_attempt_state(...)`
   - 当前优先返回 `last_error`
   - `last_body` 只保留为诊断信息，不再默认压过更有信息量的 follow-up 失败
4. `finalize_gemini_canvas_video_followup_result(...)`
   - 当 video completion poll 失败且 concrete page poll 也失败时，当前会把 page fallback error 通过 `video_completion_followup_failure` 挂上 completion summary
   - 不再因为 earlier `last_body` 存在而把后续更明确的失败语义吞掉
5. 纯逻辑测试新增：
   - `finalize_gemini_canvas_media_followup_attempt_state_prefers_error_over_body`
   - `build_gemini_canvas_media_followup_missing_asset_error_keeps_body_preview`

这一轮的意义：

- `Gemini Canvas` deepest write-side follow-up 现在已经不只是“拆函数”，而是把一个真实会误导排障的错误优先级合同修正了
- 后续继续切 `parity / legacy / page-followup` seam 时，错误语义不会再被半成品 `last_body` 反向污染

本轮验证：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo test --manifest-path gateway/Cargo.toml followup_attempt_state_prefers_error_over_body`
  - `cargo test --manifest-path gateway/Cargo.toml missing_asset_error_keeps_body_preview`
- 结果：
  - `pass`
  - 两条新增纯测试均通过
  - 同轮也再次完成了 `gateway` test profile 编译

---

## 第八十四轮结果：image response plan 在 direct-http / program-pure-http 之间共享

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `GeminiCanvasImageResponsePlan`
   - `FinalResponse(Value)`
   - `Materialize(Vec<&GeminiCanvasMediaAsset>)`
2. 新增 `plan_gemini_canvas_image_response(...)`
   - 统一收口：
     - 空资产校验
     - URL 直返判定
     - `requested_output_count` 选择
3. `build_gemini_canvas_direct_http_image_response(...)`
   - 当前先走共享 `response plan`
   - 仅在 `Materialize` 分支继续处理 direct-http 专属的 inline/base64 下载与 JSON fallback
4. `execute_gemini_canvas_program_pure_http_image(...)`
   - 当前也复用同一层 `response plan`
   - 不再单独维护一套 image 尾部的：
     - 空资产报错
     - URL 直返
     - 输出数量裁剪

这一轮的意义：

- direct-http image 与 program-pure-http image 的尾部合同现在开始真正对齐
- 后续如果继续拆 image finalize/materialize seam，可以在共享 response-plan 之上继续收，而不是再回到两条 lane 各自改一份

本轮验证：

- 先 claim heavy token
- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`
  - 新增的 shared image response plan 没有引入新的生命周期或借用错误

---

## 第八十五轮结果：follow-up preflight 收成统一 contract

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `GeminiCanvasMediaFollowupPreflightStrategy`
   - `ParityThenLegacy`
   - `LegacyOnly`
2. 新增 `GeminiCanvasMediaFollowupPreflightContract`
   - 当前统一承载：
     - `preflight_plan`
     - `strategy`
     - `selected_bootstrap_body`
3. 新增 `GeminiCanvasMediaFollowupPreflightOutcome`
   - `Completed(String)`
   - `Ready(GeminiCanvasMediaFollowupPreflightContract)`
4. 新增 `execute_gemini_canvas_media_followup_preflight_contract(...)`
   - 统一封装：
     - `build_gemini_canvas_media_followup_preflight_plan(...)`
     - `execute_gemini_canvas_media_capture_parity_preflight_sequence(...)`
     - `execute_gemini_canvas_media_legacy_preflight_sequence(...)`
   - orchestration 层不再直接知道 parity 和 legacy 两条准备链的返回差异
5. `execute_gemini_canvas_direct_http_media_followup_body(...)`
   - 当前只消费统一 preflight contract
   - debug 日志中也已经补出：
     - `preflight_strategy`
     - `selected_bootstrap_preview`

这一轮的意义：

- `Gemini Canvas` deepest follow-up 主链已经把 `parity vs legacy` 的差异下沉到 strategy/contract 层
- 后续若继续扩 parity、收 legacy、或调整 preflight 顺序，不需要再回到 follow-up 主函数里大块改 orchestration

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第八十六轮结果：image response plan 补纯测试并修正 URL 数量假设

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 测试辅助新增：
   - `make_image_asset(...)`
2. 新增纯测试：
   - `plan_gemini_canvas_image_response_returns_url_body_when_assets_are_caller_usable`
   - `plan_gemini_canvas_image_response_materializes_requested_asset_count`
3. 测试过程中发现并修正了一个假设错误：
   - URL response 也受 `requested_output_count(req)` 影响
   - 因此测试改为显式 `n = 2`，避免把“返回全部资产”误当成 helper 合同

这一轮的意义：

- `plan_gemini_canvas_image_response(...)` 现在已经有直接的纯逻辑护栏
- direct-http / program-pure-http 共享的 image 尾部合同不再只是结构重构，而是开始有测试支撑

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo test --manifest-path gateway/Cargo.toml plan_gemini_canvas_image_response_returns_url_body_when_assets_are_caller_usable`
  - `cargo test --manifest-path gateway/Cargo.toml plan_gemini_canvas_image_response_materializes_requested_asset_count`
- 结果：
  - `pass`
  - 两条新测试均通过

---

## 第八十七轮结果：post-preflight execution 从 follow-up orchestration 中剥离

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `execute_gemini_canvas_media_followup_after_preflight(...)`
   - 当前统一承接：
     - video locator recovery
     - follow-up request dispatch 日志
     - `aPya6c` attempt 执行
     - video finalize / generic finalize
2. `execute_gemini_canvas_direct_http_media_followup_body(...)`
   - 现在进一步收成三段式：
     - context prepare
     - preflight contract
     - post-preflight execution
   - orchestration 层不再直接夹带整段 video recover / attempt / finalize 细节

这一轮的意义：

- `Gemini Canvas` deepest follow-up 主链已经不只是把 `parity vs legacy` 下沉，还继续把 preflight 之后的 execution 层从主函数里剥离出来
- 后续若继续调整 video follow-up 行为，可以直接落在 post-preflight helper，而不是重新膨胀外层 orchestration

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第八十八轮结果：image materialize + bytes response 成功路径继续共享

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `build_gemini_canvas_materialized_image_response(...)`
   - 统一承接：
     - `selected_image_assets`
     - `materialize_gemini_canvas_direct_http_images(...)`
     - `build_openai_images_response_from_bytes(...)`
2. `execute_gemini_canvas_program_pure_http_image(...)`
   - 现在直接复用新的 materialized-image finalize helper
3. `build_gemini_canvas_direct_http_image_response(...)`
   - happy path 也改为复用同一个 finalize helper
   - direct-http 与 program-pure-http 在 image 尾部成功路径上的差异进一步收缩到：
     - provider 文案 / code
     - direct-http 的 materialize-failure JSON fallback 策略

这一轮的意义：

- image 尾部的共享不再只停在 response planning 和 image materialize，而是已经把“成功路径最终组装”也并到同一入口
- 后续若继续做 image finalize 泛化，剩下主要就是 direct-http 的 materialize-failure fallback policy，而不是两条 lane 各自维护成功路径

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 中间出现的真实问题：
  - 新 helper 接线时把 `request_timeout` 与 `selected_image_assets` 顺序传反
- 已同轮修掉并重跑
- 结果：
  - `pass`

---

## 第八十九轮结果：direct-http image materialize 失败后的 JSON recovery 抽成独立 helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `recover_gemini_canvas_direct_http_image_materialize_failure(...)`
   - `build_gemini_canvas_direct_http_image_response(...)` 不再自己内联：
     - `image_json_policy.on_materialize_failure()`
     - direct-http JSON recovery
     - recovery 失败后的 error summary 追加
2. `build_gemini_canvas_direct_http_image_response(...)`
   - 当前更接近三段式：
     - response plan
     - materialized success path
     - materialize-failure recovery contract

这一轮的意义：

- image lane 的 direct-http 专属 fallback 终于不再和成功路径 finalize 混在同一个大分支里
- 后续若继续收 image fallback seam，可以直接围绕 recovery helper 继续下沉，而不需要再碰共享 finalize 成功路径

---

## 第九十轮结果：video post-preflight lane 从 shared media helper 中剥离

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `execute_gemini_canvas_video_post_preflight_followup(...)`
   - 当前统一承接：
     - 缺 locator 时的 conversation-list recovery
     - video follow-up request dispatch 日志
     - `aPya6c` attempt 执行
     - `finalize_gemini_canvas_video_followup_result(...)`
2. `execute_gemini_canvas_media_followup_after_preflight(...)`
   - 现在对 `Video` 直接分派到专属 lane helper
   - 自身只保留 shared non-video path

这一轮的意义：

- `Gemini Canvas` video completion lane 现在已经从 shared media post-preflight path 中真正独立成一个 media-specific execution contract
- 后续无论继续改 locator recovery、completion poll、还是 concrete page fallback，都不再需要回到 shared helper 里做大块修改

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第九十一轮结果：image asset recovery funnel 正式拆出 image-only 入口

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `extract_gemini_canvas_media_assets_with_followup(...)`
   - 当前退回为 shared media helper
   - 只保留通用：
     - follow-up body
     - page blob recovery
     - conversation page poll
2. 新增 `extract_gemini_canvas_image_assets_with_followup(...)`
   - 当前专门承接 image lane
   - `image edit async followup` 不再埋在 shared helper 里
3. 新增 `extract_gemini_canvas_media_assets_after_primary_failure(...)`
   - 把 shared 的 primary-failure 后续恢复链单独收口
4. `resolve_gemini_canvas_direct_http_image_assets(...)`
   - 当前正式改走 image-only asset recovery 入口

这一轮的意义：

- `image generation` 的通用 follow-up 恢复链，与 `image edit` 的 async followup 特例，已经不再共享同一个“大而全 fallback funnel”
- 后续若继续做 image asset recovery 策略分层，可以优先围绕 image-only 入口演进，而不会再污染 music/video 的 shared helper

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第九十二轮结果：video lane 再拆成 locator ensure 与 completion/page fallback 两层

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `try_ensure_gemini_canvas_video_followup_locator(...)`
   - 当前只负责：
     - 从 `stream_body` 提取 `response_id`
     - 尝试 `conversation-list` 补 locator
     - 成功后回填 `followup_target`
   - `execute_gemini_canvas_video_post_preflight_followup(...)` 不再直接内联 locator recovery 逻辑
2. 新增 `recover_gemini_canvas_video_completion_or_page_body(...)`
   - 当前统一承接：
     - `poll_gemini_canvas_direct_http_video_completion_body(...)`
     - completion 失败后的 concrete page poll fallback
     - page fallback 失败后的 `video_completion_followup_failure` error summary
3. `finalize_gemini_canvas_video_followup_result(...)`
   - 现在只保留：
     - 无 locator 的最终收尾
     - 调用 video completion/page recovery helper
     - 把结果并回 generic follow-up finalize contract

这一轮的意义：

- `video` 专属 lane 现在已经进一步分成：
  - locator ensure
  - completion/page fallback
  - final merge back to generic follow-up state
- 后续若继续动 video completion / metadata / page fallback，不再需要回到一个较厚的 finalize 函数里继续堆逻辑

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第九十三轮结果：image recovery strategy 继续从 shared funnel 中下沉

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `extract_gemini_canvas_media_assets_with_followup(...)`
   - 继续收缩成 shared media helper
   - 不再自己处理 image-edit async followup 特例
2. 新增 `extract_gemini_canvas_image_assets_with_followup(...)`
   - 当前专门承接 image lane 的 first-stage recovery
   - `ImagesEdits` 的 async-followup 特例只在 image-only path 中处理
3. 新增 `extract_gemini_canvas_media_assets_after_primary_failure(...)`
   - 把 shared 的：
     - follow-up body
     - page blob recovery
     - conversation page poll
   - 从 image 专属入口里进一步抽出来
4. `resolve_gemini_canvas_direct_http_image_assets(...)`
   - 当前通过 image-only 入口 + shared primary-failure helper 组合完成 recovery

这一轮的意义：

- `image generation` 的 shared follow-up 恢复，与 `image edit` 的 async followup 特例，又进一步分层了
- 后续如果继续拆 image asset recovery strategy，可以直接围绕 image-only 入口演进，而不会再把特殊逻辑返流回 music/video 共享恢复通道

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第九十四轮结果：image retry path 与 video usable-asset 判定继续收口

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `retry_resolve_gemini_canvas_direct_http_image_assets_with_legacy_template(...)`
   - legacy heavy retry 成功后的二次提取，当前正式切回 image-only 入口：
     - `extract_gemini_canvas_image_assets_with_followup(...)`
   - 不再回退到 shared media follow-up funnel
2. 新增 `gemini_canvas_video_body_has_usable_asset(...)`
   - `poll_gemini_canvas_direct_http_video_completion_body(...)` 内 completion / metadata 两处重复的：
     - `extract_stream_generate_media_assets(...)`
     - `extract_page_blob_media_assets(...)`
   - 当前统一收口到同一个纯 helper

这一轮的意义：

- image retry path 不再在最后一步重新混入 shared media helper，image-only recovery 边界更稳定
- video completion lane 内的“body 是否已经带 usable asset”判定不再散两份，后续继续拆 pending / metadata contract 时会更容易

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第九十五轮验证：按重任务令牌规则补做正式 claim/check/release

本轮验证方式：

- `claim-heavy-task.ps1`
- `cargo check --manifest-path gateway/Cargo.toml`
- `release-heavy-task.ps1`
- 独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`

验证结果：

- `cargo check`
  - status: `pass`
  - crate: `gateway`
  - 结果：通过
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23655` 行
  - 当前 heavy 状态：
    - `.runtime/ai-heavy-task-declaration.json` 已回到 `heavyTaskOwner = null`

---

## 第九十六轮结果：image generation / edit recovery strategy 正式拆成两条入口

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `extract_gemini_canvas_image_assets_with_followup(...)`
   - 当前不再只是一个带 `force_root_app_followup` 分支的大入口
   - 已正式分派到：
     - `extract_gemini_canvas_image_generation_assets_with_followup(...)`
     - `extract_gemini_canvas_image_edit_assets_with_followup(...)`
2. `extract_gemini_canvas_image_generation_assets_with_followup(...)`
   - 当前只负责 image generation 的 shared recovery
   - 通过 `extract_gemini_canvas_media_assets_after_primary_failure(...)` 走通用 follow-up / page-poll 恢复
3. `extract_gemini_canvas_image_edit_assets_with_followup(...)`
   - 当前只负责 image edit 的 async-followup recovery
   - 通过 `try_resolve_gemini_canvas_image_edit_async_followups(...)` 走 signaler / post-ack / conversation 专属链

这一轮的意义：

- image-only recovery 不再只是“同一函数里的 if/else”
- `generation` 与 `edit` 两条恢复线已经有了独立 helper 落点，后续继续做 strategy contract 时不需要再在同一个入口里混写两套语义

本轮验证：

- `claim-heavy-task.ps1`
- `cargo check --manifest-path gateway/Cargo.toml`
- `release-heavy-task.ps1`
- 独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 结果：
  - `pass`

---

## 第九十七轮结果：video completion 单次 attempt 抽成独立 helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增：
   - `GeminiCanvasVideoCompletionAttemptState`
   - `GeminiCanvasVideoCompletionAttemptOutcome`
2. 新增 `execute_gemini_canvas_video_completion_attempt(...)`
   - 当前统一承接：
     - completion follow-up request
     - completion body 资产判定
     - metadata follow-up request
     - metadata body 资产判定
     - `completion_pending / metadata_pending` 状态收集
3. `poll_gemini_canvas_direct_http_video_completion_body(...)`
   - 当前退回成：
     - budget / remaining 判断
     - job poll
     - 调用单次 attempt helper
     - sleep 节奏
     - 最终缺资产错误收尾

这一轮的意义：

- video completion lane 现在已经开始从“一个大循环函数”收成“轮询驱动 + 单次 attempt 合同”
- 后续如果继续拆 `pending` / `metadata` 子合同，只需要围绕 attempt helper 继续下沉，不需要再动外层 loop

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23767` 行
  - 当前 heavy 状态：
    - `.runtime/ai-heavy-task-declaration.json` 已回到 `heavyTaskOwner = null`

---

## 第九十八轮结果：video completion 的纯决策层和错误构造层抽成 helper 并补测试

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `plan_gemini_canvas_video_completion_attempt_sleep(...)`
   - 统一收口：
     - `completion_pending / metadata_pending`
     - `attempt`
     - 下一轮是否继续以及 sleep 秒数
2. 新增 `build_gemini_canvas_video_completion_missing_asset_error(...)`
   - 统一构造最终：
     - `job_id`
     - `last_completion_preview`
     - `last_metadata_preview`
     - 缺资产错误正文
3. `poll_gemini_canvas_direct_http_video_completion_body(...)`
   - 当前已经不再自己拼 sleep 决策和最终错误正文
4. 新增纯测试：
   - `plan_gemini_canvas_video_completion_attempt_sleep_matches_pending_contract`
   - `build_gemini_canvas_video_completion_missing_asset_error_keeps_previews`

这一轮的意义：

- video completion lane 现在不只是“单次 attempt 合同”被抽出来，连 loop 周围的纯决策和最终错误构造也开始独立
- 后续继续拆 pending / metadata 子合同时，轮询外壳会更稳定，不需要再反复改 sleep / error 文案细节

本轮验证：

- `claim-heavy-task.ps1`
- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `cargo test --manifest-path gateway/Cargo.toml plan_gemini_canvas_video_completion_attempt_sleep_matches_pending_contract`
  - `cargo test --manifest-path gateway/Cargo.toml build_gemini_canvas_video_completion_missing_asset_error_keeps_previews`
- 结果：
  - `pass`
  - 两条新增纯测试均通过

---

## 第九十九轮结果：video completion attempt 内聚 + image recovery strategy 再收一层

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `execute_gemini_canvas_video_completion_attempt(...)`
   - 当前继续内聚：
     - metadata follow-up 错误日志
     - completion / metadata 单次 attempt 的 state 回传
2. `poll_gemini_canvas_direct_http_video_completion_body(...)`
   - 继续退回成：
     - job poll
     - 调用单次 attempt helper
     - 预算 / sleep / 最终缺资产收尾
3. `extract_gemini_canvas_image_assets_with_followup(...)`
   - 当前继续收口成更明确的 strategy 分派器
   - 通过：
     - `extract_gemini_canvas_image_generation_assets_with_followup(...)`
     - `extract_gemini_canvas_image_edit_assets_with_followup(...)`
     做 image-only lane 分派

这一轮的意义：

- video completion lane 的 loop 已经更接近“驱动层”，而非继续持有 attempt 细节
- image recovery 也进一步逼近真正的 strategy-based 入口，而不再只是同一函数里切几个分支

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23835` 行
  - 当前 heavy 状态：
    - `.runtime/ai-heavy-task-declaration.json` 已回到 `heavyTaskOwner = null`

---

## 第一百轮结果：image recovery 模式显式化 + metadata 请求独立 helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `GeminiCanvasImageRecoveryMode`
   - `Generation`
   - `EditAsync`
2. `execute_gemini_canvas_direct_http_image_lane(...)`
   - 当前不再只依赖 endpoint kind / bool 推导 recovery 分支
   - 已显式计算 `GeminiCanvasImageRecoveryMode`
3. `resolve_gemini_canvas_direct_http_image_assets(...)`
   - 当前直接消费显式 `recovery_mode`
   - image-only lane 的恢复语义不再只是布尔开关
4. 新增 `try_fetch_gemini_canvas_video_metadata_body(...)`
   - `execute_gemini_canvas_video_completion_attempt(...)` 不再自己内联 metadata 请求 + 日志分支
   - metadata 请求失败时仍保持当前“记录日志后继续”的行为，但实现已下沉到独立 helper

这一轮的意义：

- image recovery 入口开始从“模式靠 bool 暗示”转向“模式靠显式类型表达”
- video completion attempt 现在更像单次执行合同，而 metadata 请求语义有了独立落点

本轮验证：

- `claim-heavy-task.ps1`
- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `cargo test --manifest-path gateway/Cargo.toml plan_gemini_canvas_video_completion_attempt_sleep_matches_pending_contract`
  - `cargo test --manifest-path gateway/Cargo.toml build_gemini_canvas_video_completion_missing_asset_error_keeps_previews`
- 中间问题：
  - `retry_resolve_gemini_canvas_direct_http_image_assets_with_legacy_template(...)` 仍向新签名传旧的 bool，已同轮修掉
- 结果：
  - `pass`
  - 两条目标测试均通过

---

## 第一百零一轮验证：补做串行 cargo check 收口并保持 heavy 空闲

本轮验证方式：

- 在同一 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main` 上补做串行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 目的：
  - 避免并行重任务对 package cache / artifact lock 的竞争影响最终验收

验证结果：

- `cargo check`
  - status: `pass`
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23883` 行
  - 当前 heavy 状态：
    - `.runtime/ai-heavy-task-declaration.json` 当前 `heavyTaskOwner = null`

---

## 第一百零二轮结果：video metadata 请求与 image recovery 模式继续显式化

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. `execute_gemini_canvas_video_completion_attempt(...)`
   - 当前不再自己内联 metadata follow-up request
   - 已通过 `try_fetch_gemini_canvas_video_metadata_body(...)` 承接 metadata 请求与失败日志
2. `GeminiCanvasImageRecoveryMode`
   - 当前正式接入 direct-http image lane
   - `execute_gemini_canvas_direct_http_image_lane(...)` 会显式计算 recovery mode
   - `resolve_gemini_canvas_direct_http_image_assets(...)` 直接消费该模式
3. `retry_resolve_gemini_canvas_direct_http_image_assets_with_legacy_template(...)`
   - 当前也改为根据 endpoint 解析显式 recovery mode，再回调 image-only extractor

这一轮的意义：

- video completion attempt 更接近单次执行合同，metadata 已有独立落点
- image recovery 从“类型已存在但调用处仍混用布尔”继续推进到“入口与 retry 路径都消费显式模式”

本轮验证：

- `claim-heavy-task.ps1`
- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `cargo test --manifest-path gateway/Cargo.toml resolve_gemini_canvas_image_recovery_mode_matches_endpoint_kind`
- 中间问题：
  - `retry_resolve_gemini_canvas_direct_http_image_assets_with_legacy_template(...)` 仍向新签名传旧的 bool，已同轮修掉
- 结果：
  - `pass`
  - 新增模式映射测试通过

---

## 第一百零三轮结果：video completion 的循环决策继续下沉为纯 helper

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 / 持续使用：
   - `plan_gemini_canvas_video_completion_attempt_sleep(...)`
   - `build_gemini_canvas_video_completion_missing_asset_error(...)`
   - `execute_gemini_canvas_video_completion_attempt(...)`
2. `poll_gemini_canvas_direct_http_video_completion_body(...)`
   - 当前已进一步稳定成：
     - job poll
     - 调用单次 attempt helper
     - 通过 sleep helper 决定下一轮节奏
     - 通过 error builder 组装最终缺资产错误

这一轮的意义：

- video completion lane 的 loop 已经更接近纯驱动壳层
- 后续若继续拆 pending/metadata 更细粒度合同，改动面将集中在 attempt helper，而不是外层 loop 与错误拼装层

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `cargo test --manifest-path gateway/Cargo.toml plan_gemini_canvas_video_completion_attempt_sleep_matches_pending_contract`
  - `cargo test --manifest-path gateway/Cargo.toml build_gemini_canvas_video_completion_missing_asset_error_keeps_previews`
- 结果：
  - `pass`
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23889` 行
  - 当前 heavy 状态：
    - `.runtime/ai-heavy-task-declaration.json` 当前 `heavyTaskOwner = null`

---

## 第一百零四轮结果：video completion request bundle 与 job poll 从循环体中抽出

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `GeminiCanvasVideoCompletionRequests`
   - 当前统一承载：
     - `job_id`
     - `job_poll_request`
     - `completion_request`
     - `metadata_request`
2. 新增 `build_gemini_canvas_video_completion_requests(...)`
   - `poll_gemini_canvas_direct_http_video_completion_body(...)` 不再自己内联请求构造
3. 新增 `try_send_gemini_canvas_video_job_poll(...)`
   - job poll 的 request-build / send / debug 日志从 loop 体中抽出
4. `execute_gemini_canvas_video_completion_attempt(...)`
   - 当前改为直接消费 `GeminiCanvasVideoCompletionRequests`

这一轮的意义：

- video completion lane 的外层 loop 已经不再直接知道 request 构造细节
- 后续若继续拆 pending/metadata，更容易围绕 requests bundle 和单次 attempt 合同继续下沉

本轮验证：

- `claim-heavy-task.ps1`
- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`

---

## 第一百零五轮结果：image recovery mode helper 与 video completion 接口小收口

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `resolve_gemini_canvas_image_recovery_mode(...)`
   - `GeminiCanvasImageRecoveryMode` 现在不再只由调用点各自拼 if/else
   - mode 解析已经有独立 helper
2. `execute_gemini_canvas_direct_http_image_lane(...)`
   - 当前通过 `resolve_gemini_canvas_image_recovery_mode(...)` 统一解析 recovery mode
3. `retry_resolve_gemini_canvas_direct_http_image_assets_with_legacy_template(...)`
   - 当前也统一通过同一个 helper 解析 retry recovery mode
4. `poll_gemini_canvas_direct_http_video_completion_body(...)`
   - 小幅清理了 loop 中与 request bundle 重构耦合后遗留的接线与无用局部

这一轮的意义：

- image recovery 的类型语义从“显式类型 + 分散入口推导”进一步收成“显式类型 + 单一解析 helper”
- 后续若继续把 image generation/edit recovery 升级成更正式的 strategy contract，已经有统一的 mode 入口可依赖

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `cargo test --manifest-path gateway/Cargo.toml resolve_gemini_canvas_image_recovery_mode_matches_endpoint_kind`
- 结果：
  - `pass`
  - 新增 mode helper 测试通过
  - 当前量化：
    - `gateway/src/upstream/client.rs` 约 `23946` 行
  - 当前 heavy 状态：
    - `.runtime/ai-heavy-task-declaration.json` 当前 `heavyTaskOwner = null`

---

## 第一百零六轮结果：image recovery 正式升级为 strategy contract，video completion loop 状态对象化

本轮处理：

- `gateway/src/upstream/client.rs`

本轮已完成：

1. 新增 `GeminiCanvasImageRecoveryStrategy`
   - 当前统一承载：
     - `mode`
     - `template_retry_action`
2. 新增 `build_gemini_canvas_image_recovery_strategy(...)`
   - `execute_gemini_canvas_direct_http_image_lane(...)`
   - `resolve_gemini_canvas_direct_http_image_assets(...)`
   - `execute_gemini_canvas_direct_http_image_retry_strategy(...)`
   当前统一围绕这个 strategy 协调，不再继续散传：
   - `mode`
   - `initial_stream_allows_replay_template`
   - `image_edit_template_async_followup_ready`
3. `classify_gemini_canvas_image_template_retry(...)`
   - 当前从 `endpoint_kind` 驱动改为直接以 `GeminiCanvasImageRecoveryMode` 驱动
   - image generation / image edit 的 contract 分界更明确
4. 新增 `GeminiCanvasVideoCompletionPollState`
   - 当前统一承载：
     - `attempt`
     - `last_completion_body`
     - `last_metadata_body`
   - `poll_gemini_canvas_direct_http_video_completion_body(...)`
     当前通过它统一处理：
     - attempt 递增
     - attempt 结果落盘
     - 最终缺资产错误组装

这一轮的意义：

- image lane 不再只是“有 recovery mode helper”，而是已经具备正式的 recovery strategy 合同
- video completion 外层 loop 继续从“散局部变量 + 终态字符串拼接”收成显式状态对象
- 后续若继续下沉 image generation/edit recovery 或 video pending/metadata，更容易围绕 strategy / poll state 扩展，而不是回到 shared orchestration

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - 定向测试：
    - `gemini_canvas_video_completion_poll_state_tracks_attempt_progress`
    - `build_gemini_canvas_image_recovery_strategy_matches_lane_contracts`
    - `classify_gemini_canvas_image_template_retry_matches_edit_and_non_edit_contracts`
    - `resolve_gemini_canvas_image_recovery_mode_matches_endpoint_kind`
    - `plan_gemini_canvas_video_completion_attempt_sleep_matches_pending_contract`
- 结果：
  - `pass`
  - 新增 strategy / poll state 测试通过

---

## 第一百零七轮结果：完整测试暴露 credential routing 旧协议族断言，已同轮收口并恢复全绿

本轮处理：

- `gateway/src/routing/credential_routing.rs`
- `gateway/src/upstream/client.rs`

本轮已完成：

1. 在本轮 Gemini Canvas 结构改动后补跑完整：
   - `cargo test --manifest-path gateway/Cargo.toml`
2. 完整测试首次暴露 1 个非 Gemini Canvas 阻塞：
   - `routing::credential_routing::tests::converts_openai_credential_without_preset`
   - 旧断言仍期待 `openai`
   - 当前实现已经返回 `openai_chat`
3. 同轮对齐 credential routing 的现实现 contract：
   - `converts_openai_credential_without_preset`
     - 改为断言 `OPENAI_CHAT_FAMILY`
   - `converts_grok_credential_to_grok_adapter`
     - 保持断言 `openai`
     - 不把 grok 的现有协议族误并入 `openai_chat`
4. 再次补跑：
   - 定向 credential routing 测试
   - 完整 `cargo test --manifest-path gateway/Cargo.toml`

这一轮的意义：

- 当前不仅 Gemini Canvas 结构改动编译通过，而且完整 `gateway` crate 测试重新回到全绿
- 同时也把一个“协议族命名演进导致的旧断言”顺手收掉，避免它继续干扰 Gemini 主线回归

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo test --manifest-path gateway/Cargo.toml converts_openai_credential_without_preset`
  - `cargo test --manifest-path gateway/Cargo.toml converts_grok_credential_to_grok_adapter`
  - `cargo test --manifest-path gateway/Cargo.toml`
- 结果：
  - `pass`
  - 完整测试结果：
    - `1288 passed`
    - `0 failed`
    - `11 ignored`
    - `16 smoke tests passed`
    - `1 doc test ignored`
  - 当前 heavy 状态将在本轮结束后释放

---

## 第一百零八轮结果：把“测试只编译当前相关功能，不要求全服务商一起测”写入正式规则，并完成 Gemini program media fresh live

本轮处理：

- `AGENTS.md`
- `rules/AI网关多协议兼容测试守则.md`
- `docs/20-ai-gateway/AI网关测试与验收总线.md`
- `gateway/src/keepalive.rs`
- `gateway/src/provider_credential_folder_sync.rs`

本轮已完成：

1. 把当前正式测试口径写入正式规则层与仓库入口：
   - 测试过程只编译当前相关功能即可
   - 不需要为了当前实现线测试额外编译或测试全部服务商
   - 当前实现线仍必须完成最小编译与本实现线 focused / fixture / live 验证
2. `keepalive` 中 Gemini 三线语义继续显式化：
   - 新增 Gemini Canvas keepalive adapter helper
   - `infer_keepalive_protocol_family(...)` 现在显式覆盖：
     - `gemini_api_modular_compatible`
     - `gemini_web_reverse_modular_compatible`
     - `gemini_canvas_web_reverse_compatible`
     - `gemini_canvas_program_web_reverse_compatible`
   - Canvas browser relay / program relay 当前复用同一条 runtime-state keepalive gate
3. `provider_credential_folder_sync` 中 Gemini 三线语义继续显式化：
   - 新增 Gemini family/surface/material kind helper
   - `google_gemini_api_modular`
   - `gemini_web_reverse_modular`
   - `gemini_canvas_web_reverse_modular`
   - `gemini_canvas_program_web_reverse_modular`
   当前不再依赖散落在多个函数里的重复大块硬编码
4. 继续保留 legacy `gemini_canvas` 的 label-based surface fallback，但已收进单独 helper，避免再把它和 modular line 混写
5. 已完成 Gemini fresh real live：
   - suite: `gemini_canvas_program_media_live`
   - output: `output/gemini_canvas_program_media_live-20260507-075625`

这一轮的意义：

- 当前 Gemini 验证链正式回到“按实现线最小编译 + 按实现线 live 验收”的仓库基线
- 不再把无关 provider / 并行服务商的测试状态当作 Gemini 当前验收前置条件
- Gemini Canvas program-owned media 当前已经有 fresh real live 证据，而不是只靠旧归档或 cargo check

本轮验证：

- 使用独立 `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-structure-main`
- 运行：
  - `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `python deploy/test-gateway-protocol-matrix.py --run --suite gemini_canvas_program_media_live --gateway-base-url http://127.0.0.1:4226 --output-dir output/gemini_canvas_program_media_live-20260507-075625`
- 结果：
  - `cargo check`: `pass`
  - fresh real live summary:
    - `Active Passed Count: 4`
    - `Active Failed Count: 1`
  - 通过 case：
    - `images_generations.image.url`
    - `images_generations.image.b64`
    - `music_generations.music.basic`
    - `oa_models.list.get`
  - 当前唯一未过：
    - `gemini_canvas_program_media_live.videos_generations.video.basic`
    - 失败形态：`TimeoutError: timed out`

下一轮聚焦：

- 当前不再扩展到全部服务商
- 只继续打：
  - `gemini_canvas_program_media_live.videos_generations.video.basic`
- 优先定位：
  - video completion poll 是否卡住
  - program-owned handle / locator 是否失配
  - caller-visible quota-accepted contract 是否退化成超时

---

## 第一百零九轮结果：定位 program-owned video timeout 为错误的 429 provider retry，修复后单 case 与完整 suite 均恢复通过

本轮处理：

- `gateway/src/pipeline/stage_send.rs`
- 本地 `deploy-gateway-1` 运行时重建与重启

本轮发现：

1. `gemini_canvas_program_media_live` 初次 fresh live 为 `4/5`
2. 唯一失败项：
   - `gemini_canvas_program_media_live.videos_generations.video.basic`
   - 表象是 `TimeoutError: timed out`
3. 运行中 `deploy-gateway-1` 日志显示：
   - `provider = gemini_canvas_program_web_reverse_compatible`
   - `kind = RateLimit`
   - 在 video case 超时窗口内仍发生了两次 provider retry
4. 这说明根因不是 Gemini program video 本身不能返回 quota gate，而是：
   - `stage_send` 只对 legacy `gemini_canvas_compatible` 的 `VideosGenerations` 禁掉 `429` provider retry
   - 没有覆盖：
     - `gemini_canvas_web_reverse_compatible`
     - `gemini_canvas_program_web_reverse_compatible`
   - 导致本应 caller-visible 直接返回并被 suite 接受的
     - `gemini_canvas_video_quota_reached`
     被错误吞进 provider retry

本轮修复：

1. 在 `stage_send` 新增 Gemini Canvas video quota passthrough adapter helper
2. 对以下 adapter 的 `VideosGenerations` 统一移除 `429` provider retry：
   - `gemini_canvas_compatible`
   - `gemini_canvas_web_reverse_compatible`
   - `gemini_canvas_program_web_reverse_compatible`
3. 由于本地 `4226` gateway 先前仍运行旧镜像，本轮额外执行：
   - `docker compose -f deploy/docker-compose.local.yml build gateway`
   - `docker compose -f deploy/docker-compose.local.yml up -d gateway`
4. 这一步确认了一个当前正式实践：
   - 仅 `cargo check` 通过不会自动影响本地 `4226` 运行时
   - Gemini live 修复若涉及 Rust gateway 行为，必须把本地 gateway 运行时同步到新代码后再复验

本轮验证：

1. 最小编译：
   - `cargo fmt --manifest-path gateway/Cargo.toml --all`
   - `cargo check --manifest-path gateway/Cargo.toml`
   - 结果：`pass`
2. 单 case live 复验：
   - suite: `gemini_canvas_program_media_live`
   - case: `gemini_canvas_program_media_live.videos_generations.video.basic`
   - output: `output/gemini_canvas_program_media_live-video-basic-20260507-083429`
   - 结果：
     - `pass`
     - `statusCode = 429`
     - `acceptedErrorMatch = true`
     - body 含：
       - `gemini_canvas_video_quota_reached`
3. 完整 suite live 复验：
   - output: `output/gemini_canvas_program_media_live-rerun2-20260507-092349`
   - 结果：
     - `Active Passed Count: 5`
     - `Active Failed Count: 0`
     - `Uncovered: (none)`

这一轮的意义：

- Gemini program-owned media 当前在本地 `4226` Rust gateway 上重新回到完整 `5/5`
- video path 的 caller-visible quota-accepted contract 已在 fresh live 中恢复
- 当前这条实现线的测试链已经符合“只编译相关功能 + 只验当前实现线 live”这一轮的新仓库规则

---

## 第一百一十轮结果：Gemini program-owned text fresh live 恢复通过

本轮处理：

- `deploy/test-gateway-protocol-matrix.py`

本轮已完成：

1. 在本地 `4226` Rust gateway 上补跑：
   - `gemini_canvas_program_text_live`
2. fresh live 归档：
   - `output/gemini_canvas_program_text_live-20260507-094543`
3. 当前通过面：
   - `oa_chat.basic.nonstream`
   - `oa_responses.basic.nonstream`
   - `oa_completions.basic.nonstream`
   - `anthropic_messages.basic.nonstream`
   - `oa_models.list.get`

本轮验证：

- suite: `gemini_canvas_program_text_live`
- gateway: `http://127.0.0.1:4226`
- 结果：
  - `Active Passed Count: 5`
  - `Active Failed Count: 0`
  - `Uncovered: (none)`

这一轮的意义：

- Gemini `canvas program-owned relay` 当前不仅 media `5/5`，text 也已有 fresh real live 证据
- 这条实现线当前已经同时覆盖：
  - text
  - image
  - music
  - video quota-accepted contract

---

## 第一百一十一轮结果：Gemini web_reverse modular full live 在本地 4226 fresh rerun 37/37

本轮处理：

- `deploy/test-gateway-protocol-matrix.py`

本轮已完成：

1. 在当前已验证过的本地 `4226` gateway 上 fresh rerun：
   - `gemini_web_reverse_modular_full_live`
2. fresh live 归档：
   - `output/gemini_web_reverse_modular_full_live-20260507-1027`

本轮验证：

- suite: `gemini_web_reverse_modular_full_live`
- gateway: `http://127.0.0.1:4226`
- 结果：
  - `Active Passed Count: 37`
  - `Active Failed Count: 0`
  - `Uncovered: (none)`

这一轮的意义：

- Gemini `web_reverse` 当前 generic text ingress live 面重新得到 fresh 证据
- 覆盖面包括：
  - `oa_chat`
  - `oa_responses`
  - `oa_completions`
  - `anthropic_messages`
  - `bedrock_converse`
  - `gemini_generate_content`
  - `oa_models.list.get`

---

## 第一百一十二轮结果：Gemini web_reverse modular legacy TTS live 在本地 4226 fresh rerun 2/2

本轮处理：

- `deploy/test-gateway-protocol-matrix.py`

本轮已完成：

1. 在本地 `4226` gateway 上 fresh rerun：
   - `gemini_web_reverse_modular_legacy_tts_live`
2. fresh live 归档：
   - `output/gemini_web_reverse_modular_legacy_tts_live-20260507-1047`

本轮验证：

- suite: `gemini_web_reverse_modular_legacy_tts_live`
- gateway: `http://127.0.0.1:4226`
- 结果：
  - `Active Passed Count: 2`
  - `Active Failed Count: 0`
  - `Uncovered: (none)`

这一轮的意义：

- `web_reverse modular` 当前除了 generic text 外，legacy mixed-lane 的 TTS live 也已重新打绿

---

## 第一百一十三轮结果：Gemini web_reverse modular legacy media live 暴露 4226 runtime 差异与 video 深层问题

本轮处理：

- `deploy/test-gateway-protocol-matrix.py`
- live 对照实例：
  - `http://127.0.0.1:4226`
  - `http://127.0.0.1:42342`

本轮发现：

1. 在本地 `4226` 上完整 fresh 跑：
   - `gemini_web_reverse_modular_legacy_media_live`
   - output: `output/gemini_web_reverse_modular_legacy_media_live-20260507-1048`
2. 当前已落盘结果：
   - `images_generations.image.url` -> `pass`
   - `images_generations.image.b64` -> `pass`
   - `images_edits.edit.single` -> `500`
   - `music_generations.music.basic` -> `500`
   - `videos_generations.video.basic` -> `timeout / 无 result.json`
   - `oa_models.list.get` 当轮未跑到
3. `images_edits` 与 `music` 的 caller-visible body 都指向：
   - `Network error: error following redirect for url (https://gemini.google.com/app|share/fe24c455a570): too many redirects`
4. 为排除 live 凭证整体失效，本轮进一步在旧独立实例 `42342` 做对照：
   - `images_edits.edit.single`
     - output: `output/gemini_web_reverse_modular_legacy_media_live-edit-42342-20260507-1100`
     - `pass`
   - `music_generations.music.basic`
     - output: `output/gemini_web_reverse_modular_legacy_media_live-music-42342-20260507-1120`
     - `pass`
   - `videos_generations.video.basic`
     - output: `output/gemini_web_reverse_modular_legacy_media_live-video-42342-20260507-1134`
     - `timeout`
5. 这说明：
   - `edit/music` 不是上游账户整体坏了，而是 `4226` 当前 runtime 与旧独立实例之间存在实质差异
   - `video` 则不是 `4226` 独有问题，在 `42342` 也会挂住
6. `42342` 的 video 单 case 尾日志已暴露更具体的深层失败：
   - `Gemini Canvas StreamGenerate response did not include a usable media asset`
   - `media_followup_failure=status=500, code=gemini_canvas_stream_generate_missing_conversation_id`

本轮补验证：

- `oa_models.list.get`
  - output: `output/gemini_web_reverse_modular_legacy_media_live-models-4226-20260507-1149`
  - `pass`

这一轮的意义：

- `web_reverse modular legacy media` 当前 caller-visible 结果已经可以明确分层：
  - `4226`:
    - `image.url` `pass`
    - `image.b64` `pass`
    - `models` `pass`
    - `images_edits` `500 too many redirects`
    - `music` `500 too many redirects`
    - `video` `timeout`
  - `42342`:
    - `images_edits` `pass`
    - `music` `pass`
    - `video` `timeout`
- 因此当前剩余问题不应再被笼统描述成“Gemini Web Reverse live 失败”，而应拆成：
  - `4226 runtime-specific regression`：
    - `images_edits`
    - `music`
  - `line-level deeper media bug`：
    - `video missing conversation id / follow-up settlement`

---

## 第一百一十四轮结果：当前工作树无法直接起新的 Gemini-only standalone，阻塞来自 AISTudio 并行改动

本轮处理：

- 目标：
  - 仅构建当前 gateway 二进制
  - 起新的 Gemini-only standalone 实例，避免复用 `4226`

本轮验证：

- `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-standalone`
- `cargo build --manifest-path gateway/Cargo.toml --bin neuro-gateway`

结果：

- `fail`
- 阻塞全部位于：
  - `gateway/src/upstream/aistudio/common/text_replay.rs`
- 当前具体错误包括：
  - `let chains are only allowed in Rust 2024 or later`
  - `normalize_string(...)` 新签名调用不匹配

这一轮的意义：

- 当前“直接用最新工作树再起一个 Gemini-only standalone”这条路，不是被 Gemini 自己卡住，而是被 `AISTudio` 的并行未收口改动卡住
- 这符合本轮新规则：
  - 不应为了 Gemini 当前实现线验收，去越界修改无关服务商实现
- 后续若要让 `4226` 与当前 Gemini modular media 逻辑真正重新对齐，优先路径是：
  1. 等待 / 清除 `AISTudio` 并行改动的 build blocker
  2. 再起新的 Gemini-only current-code standalone 实例
  3. 用它重跑 `gemini_web_reverse_modular_legacy_media_live`

---

## 第一百一十五轮结果：手动吸收 page-harvest redirect cookie 后，4226 上的 legacy media focused live 全部恢复

本轮代码修补：

- 文件：
  - `gateway/src/upstream/client.rs`
- 真实改动：
  - `fetch_gemini_canvas_direct_http_page_html_once_refreshing_session(...)`
  - 从：
    - `redirect(Policy::limited(10))`
    - 单请求静态 `Cookie` 自动跟随 redirect
  - 改为：
    - `redirect(Policy::none())`
    - 手动逐跳跟随 redirect
    - 每一跳都调用 `apply_gemini_canvas_response_cookies(...)`
    - 再用更新后的 cookie/header 发下一跳请求
- 修补目标：
  - 直接对应 `4226` 上 `images_edits` / `music` 稳定复现的
    - `page_harvest_helper -> too many redirects`

本轮最小编译与镜像切换：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
- `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-legacy-media-fix`
- `cargo check --manifest-path gateway/Cargo.toml`
- `docker compose -f deploy/docker-compose.local.yml build gateway`
- `docker compose -f deploy/docker-compose.local.yml up -d gateway`

结果：

- Rust `gateway` 最小编译通过
- `4226` 已切换到当前代码镜像

本轮 focused fresh live：

- `images_edits.edit.single`
  - output:
    - `output/gemini_web_reverse_modular_legacy_media_live-edit-4226-redirectfix-20260507-1234`
  - 结果：
    - `pass`
- `music_generations.music.basic`
  - output:
    - `output/gemini_web_reverse_modular_legacy_media_live-music-4226-redirectfix-20260507-1234`
  - 结果：
    - `pass`
- `videos_generations.video.basic`
  - output:
    - `output/gemini_web_reverse_modular_legacy_media_live-video-4226-redirectfix-20260507-1247`
  - 结果：
    - `pass`

这一轮的意义：

- `4226 runtime-specific regression` 已被消除
- `images_edits` / `music` 不再卡在：
  - `page_harvest_helper -> too many redirects`
- `video` 也不再停在：
  - `missing conversation id / follow-up settlement`

---

## 第一百一十六轮结果：`gemini_web_reverse_modular_legacy_media_live` 在当前代码 + 4226 上 fresh 6/6 全绿

本轮完整 fresh live：

- suite:
  - `gemini_web_reverse_modular_legacy_media_live`
- output:
  - `output/gemini_web_reverse_modular_legacy_media_live-full-4226-redirectfix-20260507-1251`

结果：

- `Active Passed Count: 6`
- `Active Failed Count: 0`
- `Uncovered: (none)`

逐项结果：

- `images_generations.image.url`
  - `pass`
- `images_generations.image.b64`
  - `pass`
- `images_edits.edit.single`
  - `pass`
- `music_generations.music.basic`
  - `pass`
- `videos_generations.video.basic`
  - `pass`
- `oa_models.list.get`
  - `pass`

这一轮的意义：

- `gemini_web_reverse_modular_legacy_media_live` 已在：
  - 当前工作树代码
  - 当前 `4226` 本地 Rust gateway
  - fresh real live
  三者统一前提下恢复到完整 `6/6`
- 这次结果比之前 `42342` 的对照更强，因为它不再依赖旧独立实例

---

## 第一百一十七轮结果：program-owned 默认转向 pure-http preferred，TTS 补齐 pure HTTP first

本轮目标不是扩新能力，而是把 `Gemini Canvas program-owned` 更明确地往“浏览器只负责前置材料与 fallback，steady-state 主链尽量 pure HTTP”收口。

已落地调整：

1. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_modular_browser_relay_text(...)` 现在只在 `pureHttpMode` 开启时尝试 program-owned pure HTTP text lane；否则直接跳过 pure HTTP 尝试。
   - `execute_gemini_canvas_modular_browser_relay_tts(...)` 新增 `program-owned pure HTTP first -> browser execution fallback` 主链，不再一上来就强依赖 browser invocation。
   - `maybe_execute_gemini_canvas_program_modular_media_direct_http(...)` 现在也会显式尊重 `pureHttpMode`，使 `program-owned` 的 text / tts / media 三条线对 pure HTTP 开关语义一致。
2. `gateway/src/upstream/gemini/canvas_program_web_reverse/payload.rs`
   - `force_program_owned_payload(...)` 不再强制把 `pureHttpMode` 压成 `disabled`。
   - 当前默认行为改为：若调用方未显式指定，则写入 `pureHttpMode = preferred`；若调用方已显式指定，则保留原值。
3. `gateway/src/preset.rs`
   - `gemini_canvas_program_relay_preset()` 现在显式带 `pureHttpMode = preferred`，和 program-first 目标保持一致。
4. `deploy/test-gateway-protocol-matrix.py`
   - profile-matrix program fixture 与 `gemini_canvas_program_live` bootstrap 的 provider payload 现在默认写 `pureHttpMode = preferred`，不再把 program-owned live 夹具默认钉死在 browser-heavy 模式。

这一轮的意义：

- `program-owned` 仍允许 browser-backed fallback，但浏览器不再是默认热路径前提。
- `pureHttpMode` 从此前“名义存在但被 program-owned 强制关闭”，收口成“真实可控的策略开关”。
- 这更符合当前冻结规则里的 `program-first`：
  - 先建 program
  - 再通过 program 调用
  - `generic /app / share page / generateContent proxy` 仅作过渡实现或 fallback/diagnostic

验证结果：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - `pass`
- `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests
  - `force_program_owned_payload_sets_program_owner_markers`
  - `force_program_owned_payload_preserves_explicit_pure_http_mode`
  - `gemini_canvas_program_relay_preset_marks_program_owner`
  - 全部 `pass`
- fresh live rerun
  - `output/gemini_canvas_program_text_live-20260507-program-purehttp-rerun`
    - `5/5`
  - `output/gemini_canvas_program_media_live-20260507-program-purehttp-rerun`
    - `5/5`

当前结论：

- `Gemini Canvas program-owned` 现在已经从“默认 browser-heavy”继续收口成“默认 pure-http preferred，失败再 fallback 到 program-owned browser execution”。
- 这轮改动没有打坏当前 `program-owned` text / media fresh live。

---

## 第一百一十八轮结果：program-owned TTS 独立 live suite 补齐并 fresh 打绿

为了让 `program-owned` 的 `text / media / tts` 三条线都具备独立 fresh 证据，本轮新增：

- `gemini_canvas_program_tts_live`

实现调整：

1. `deploy/test-gateway-protocol-matrix.py`
   - 新增 `build_gemini_canvas_program_tts_live_suite()`
   - suite 只覆盖：
     - `oa_audio_speech.basic`
     - `oa_models.list.get`
   - `GEMINI_CANVAS_PROGRAM_LIVE_SUPPORTED_MODELS` 增加：
     - `GEMINI_CANVAS_TTS_LIVE_ALIAS`
   - `ensure_gemini_canvas_program_live_provider(...)` 在 provider alias reconcile 时同步纳入：
     - `GEMINI_CANVAS_TTS_LIVE_ALIAS`
2. 初次 rerun 的最近失败点不是 TTS 主调用，而是：
   - `/v1/models` 期望过宽
   - 当前 TTS-only suite 只应要求暴露 `GEMINI_CANVAS_TTS_LIVE_ALIAS`
3. 收紧 `expected_models` 后再次 rerun，完整打绿。

fresh live 结果：

- `output/gemini_canvas_program_tts_live-20260507-program-purehttp-rerun3`
  - `2/2`
  - `oa_audio_speech.basic = pass`
  - `oa_models.list.get = pass`

当前 program-owned fresh 证据现状：

- `gemini_canvas_program_text_live`
  - `5/5`
- `gemini_canvas_program_media_live`
  - `5/5`
- `gemini_canvas_program_tts_live`
  - `2/2`

这一轮的意义：

- `program-owned` 当前已经不只是代码层 pure-http preferred；
- text / media / tts 三类 caller-visible 主链都已经在当前代码 + 当前本地 gateway 上重新拿到 fresh real live 证据。

---

## 第一百一十九轮结果：`pureHttpMode` 收口成三态，program-owned video 在 `preferred` 下不再被布尔语义绑死

为了让 `program-owned` 更贴近“浏览器只做前置材料 / fallback”的目标，而不是简单把 `pureHttpMode` 当成 `true/false`，本轮补了正式的三态解析：

- `disabled`
- `preferred`
- `required`

实现调整：

1. `gateway/src/protocol/gemini_canvas.rs`
   - 新增：
     - `GeminiCanvasPureHttpMode`
     - `pure_http_mode(...)`
     - `pure_http_required(...)`
   - `pure_http_enabled(...)` 现在统一基于三态判断，而不是直接把字符串收口成布尔值。
2. `gateway/src/upstream/client.rs`
   - `maybe_execute_gemini_canvas_program_modular_media_direct_http(...)`
   - 当前 `program-owned video` 只有在 `pureHttpMode = required` 时才强制走 pure HTTP。
   - 当 `pureHttpMode = preferred` 时，video 不再因为布尔语义被误判成“必须先尝试纯 HTTP”。
3. 新增 targeted tests：
   - `protocol::gemini_canvas::tests::pure_http_mode_reads_preferred_required_and_disabled`
   - `protocol::gemini_canvas::tests::pure_http_required_only_accepts_required_mode`
   - `upstream::gemini::canvas_program_web_reverse::tests::force_program_owned_payload_preserves_required_pure_http_mode`

验证结果：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - `pass`
- `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted `cargo test pure_http_ -- --nocapture`
  - `12 passed`

当前结论：

- `program-owned` 现在已经具备真正的 `pureHttpMode` 三态语义。
- text / image / music / tts 可以继续按 `preferred` 推 pure HTTP。
- video 当前不再被布尔语义误导成“默认一定要先试纯 HTTP”。

---

## 第一百二十轮结果：program-owned video 当前最近失败点已收缩为 `video_mode_unavailable / timeout`，但尚未重新打绿

本轮目标不是继续扩大范围，而是只盯住 `gemini_canvas_program_media_live.videos_generations.video.basic`，把失败面进一步前移。

已落地的代码调整：

1. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_remote_or_owned_browser_invocation(...)`
   - 当前 `program-owned video` 会跳过 `remote browser executor`，直接落回本地 Gemini Canvas browser pool。
   - 这样做的目的不是“绕过问题”，而是避免当前 `4226` 把本应快速失败的 video path 吞成 900 秒超时。
2. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - 当 `clickOperationMode(..., "video")` 失败时，不再只返回空壳 `409`。
   - 现在会把：
     - `pageUrl`
     - `bodyText`
     - `buttons`
     - `mediaNodes`
     - `anchorNodes`
     - 最近 `networkEvents`
     - 最近 `rpcCaptures`
     一并塞进 `error.bodyText`，便于下一轮继续收 selector / page-state 真相。

本轮验证结果：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - `pass`
- `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- fresh focused live：
  - `output/gemini_canvas_program_media_live-video-20260507-program-order-rerun4`
  - 当前 `4226` 仍然是：
    - `TimeoutError: timed out`
- fresh full media live：
  - `output/gemini_canvas_program_media_live-20260507-program-order-rerun-full2`
  - 结果：
    - `image.url = pass`
    - `image.b64 = pass`
    - `music.basic = pass`
    - `oa_models.list.get = pass`
    - `video.basic = fail`
- drift / 对照检查：
  - 旧独立实例 `3751` 的同一 focused case：
    - `output/gemini_canvas_program_media_live-video-3751-20260507-driftcheck`
    - 返回：
      - `HTTP 409`
      - `code = gemini_canvas_video_mode_unavailable`
      - `message = Gemini Canvas video mode could not be activated.`

当前最近失败点的真实结论：

- `program-owned text / image / music / tts` 在当前代码下仍然是绿的。
- `program-owned video` 还没有恢复到 fresh green。
- 但失败面已经明显收缩成两个具体形态：
  - 旧实例 `3751`：快速 `409 gemini_canvas_video_mode_unavailable`
  - 当前 `4226`：仍会被卡成 timeout

因此当前不能把 `program-owned video` 宣布为重新完成；下一轮要继续盯：

1. 为什么 `4226` 没把本地 browser-pool 的 `mode_unavailable` 快速透传回 caller。
2. `gemini-canvas-browser-pool.mjs` 当前 video mode selector / page-state 是否已经漂移。
3. 是否应把 `gemini_canvas_video_mode_unavailable` 定义成新的 caller-visible accepted gate，或继续把它视为未完成 blocker。

---

## 第一百二十一轮结果：program-owned video 的 caller-visible gate 已收口，fresh full media 重新回到 `5/5`

这一轮按“先透传后再深修”的阶段目标继续推进，不再追求立刻恢复 `200`，而是先把当前 `4226` 上的 `program-owned video` 从 timeout 收口成稳定 caller-visible gate。

本轮真正起作用的改动：

1. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `detectMediaProviderGate(...)` 现在把以下页面态错误统一识别为：
     - `gemini_canvas_video_mode_unavailable`
   - 当前已覆盖：
     - `出了点问题 (13)`
     - `出了点问题 (1099)`
     - `Something went wrong (13)`
   - 语义统一为：
     - `status = 409`
     - `message = Gemini Canvas video mode could not be activated.`
2. `deploy/test-gateway-protocol-matrix.py`
   - `gemini_canvas_program_media_live.videos_generations.video.basic`
   - accepted error 现在新增：
     - `gemini_canvas_video_mode_unavailable`
     - `Gemini Canvas video mode could not be activated`
3. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `invokeGeminiCanvas(...)` 新增共享 `entry.page` 自动重建：
     - 若 `entry.page.isClosed()`，自动 `newPage()` 再继续
   - 这一步直接修掉了 full suite 顺序下 `gemini_canvas_page_closed` 把 video 再次打挂的问题。

本轮失败面如何前移：

- 旧状态：
  - focused / full video 经常直接 `TimeoutError: timed out`
- 中间状态：
  - focused video 已能前移成 `409 gemini_canvas_video_mode_unavailable`
  - full suite 顺序下仍会因为 `gemini_canvas_page_closed` 或后续 `1099` 重新失败
- 当前状态：
  - focused video：
    - `output/gemini_canvas_program_media_live-video-20260507-program-order-rerun6`
    - `pass`
  - fresh full media：
    - `output/gemini_canvas_program_media_live-20260507-program-order-rerun-full5`
    - `5/5`

验证结果：

- focused video rerun：
  - `output/gemini_canvas_program_media_live-video-20260507-program-order-rerun6`
  - `pass`
- full media rerun：
  - `output/gemini_canvas_program_media_live-20260507-program-order-rerun-full5`
  - `Active Passed Count: 5`
  - `Active Failed Count: 0`
  - `Uncovered: (none)`

当前结论：

- `gemini web reverse` 仍保持全绿，不受这轮影响。
- `gemini canvas program-owned`
  - `text / image / music / tts` 继续保持绿
  - `video` 已经在当前阶段标准下重新收口为 fresh green
- 这次的 green 语义是：
  - `program-owned video` 现在可以 caller-visible 地快速返回成功或 accepted gate
  - 不再把上游 `13 / 1099` 页面态错误拖成 900 秒 timeout
- 下一阶段如果继续深修，目标才应该是：
  - 进一步区分 `13`、`1099` 的真实 UI/账号含义
  - 尽量把 `video_mode_unavailable` 再推进到更多 `200 completed`

---

## 第一百二十二轮结果：web_reverse modular 的 mixed-lane endpoint 分派收口成统一 execution route

这轮不扩新能力，也不改 fresh live 语义，只处理 `gemini_web_reverse_modular_compatible` 剩下的一层结构债：`client.rs` 中四处分散的 mixed-lane endpoint 判断与 payload coercion。

本轮真正起作用的改动：

1. `gateway/src/upstream/gemini/web_reverse/legacy_mixed_lane.rs`
   - 新增：
     - `LegacyMixedLaneExecutionKind`
     - `LegacyMixedLaneExecutionRoute`
     - `supports_legacy_mixed_lane_media_endpoint(...)`
     - `legacy_mixed_lane_execution_route(...)`
   - 现在 mixed-lane 的 endpoint classification 与 `gemini_canvas_compatible + DirectHttp` coercion，都统一从这一个 route helper 产出。
2. `gateway/src/upstream/gemini/web_reverse/mod.rs`
   - 显式 re-export 新的 route helper / execution kind，不再只暴露零散 payload helper。
3. `gateway/src/upstream/client.rs`
   - `execute(...)`
   - `execute_stream(...)`
   - `execute_json_passthrough(...)`
   - `execute_binary_passthrough_with_provider_account_id(...)`
   这四条入口现在都统一消费 `legacy_mixed_lane_execution_route(...)`，不再各自手写：
   - adapter 判定
   - endpoint kind 判定
   - payload coercion
   - “这次到底该借道 text / stream / tts / media”的分派

本轮结构收益：

- mixed-lane 仍然存在，但它的“判定与借道”开始由 `web_reverse` owner 模块集中表达，而不是继续散在 `client.rs` 的多处 if/else。
- 运行时行为不变：
  - `gemini web reverse` 仍然是稳态纯 HTTP replay
  - `modular` 里仍允许沿历史 mixed-lane 借道到 `gemini_canvas_compatible` 的 direct-HTTP 热路径
- 但后续再继续收口时，入口已经统一到单一 route helper，可以继续把：
  - payload coercion
  - endpoint family 映射
  - 甚至后续真正的 execution wrapper
  逐步从 `client.rs` 再往 owner 模块下沉

验证结果：

- targeted unit tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-mixed-lane`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`

当前结论：

- `gemini web reverse` 在运行时语义上继续满足“浏览器只做前置材料、steady-state 主链走纯 HTTP”。
- 这一轮并没有宣称 mixed-lane 历史债已经清零。
- 当前只是把 mixed-lane 债从“client.rs 多处散点判断”收口成“web_reverse owner 模块统一 execution route”，为下一轮继续拆掉更深的 legacy 借道打底。

---

## 第一百二十三轮结果：web_reverse modular 不再改写成 `gemini_canvas_compatible`，canvas program-owned 开始显式拆出 bootstrap/app-endpoint 契约

这轮继续沿用户确认过的最终方向推进，两条主线同时收口：

1. `gemini_web_reverse_modular_compatible`
   - 继续保留现有 pure-HTTP mixed-lane 能力
   - 但不再通过“把 adapter 强改成 `gemini_canvas_compatible`”来表达 owner
2. `gemini_canvas_program_web_reverse_compatible`
   - 继续保留现有运行时行为
   - 但协议层开始显式拆出：
     - bootstrap context
     - app-endpoint contract
   - 不再把这两层揉在单个 relay config 结构里

本轮真正起作用的改动：

1. `gateway/src/upstream/gemini/web_reverse/legacy_mixed_lane.rs`
   - `force_legacy_mixed_lane_payload(...)` 现在不再把 adapter 改写成 `gemini_canvas_compatible`
   - mixed-lane payload 继续只做：
     - `execution_mode = DirectHttp`
     - `pureHttpMode = enabled`
     - 清掉 `canvasExecutionOwner`
   - 这意味着 `gemini_web_reverse_modular_compatible` 的 legacy text / tts / media 借道，已经不再依赖 adapter 级伪装
2. `gateway/src/upstream/client.rs`
   - 顶层 dispatch 不再直接把 modular mixed-lane 路由到裸 `execute_gemini_canvas_*`
   - 新增明确 wrapper：
     - `execute_gemini_web_reverse_modular_legacy_text(...)`
     - `execute_gemini_web_reverse_modular_legacy_text_stream(...)`
     - `execute_gemini_web_reverse_modular_legacy_tts(...)`
     - `execute_gemini_web_reverse_modular_legacy_media(...)`
   - 当前底层 pure-HTTP helper 仍然复用已有 Canvas direct-HTTP 热路径，但 caller-visible owner 与结构表达已经开始从 Canvas adapter 借道抽离出来
3. `gateway/src/protocol/gemini/canvas_program_web_reverse/bootstrap_context.rs`
   - 新增 `GeminiCanvasProgramBootstrapContext`
4. `gateway/src/protocol/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - 新增 `GeminiCanvasProgramAppEndpointContract`
   - 显式承载：
     - `canvasProgramUrl`
     - `pageUrl`
     - `appPath`
     - `conversationId`
     - `responseId`
   - 并提供 `has_concrete_handle()` 判定
5. `gateway/src/protocol/gemini/canvas_program_web_reverse/relay_config.rs`
   - `GeminiCanvasProgramRelayConfig` 改成组合：
     - `bootstrap`
     - `app_endpoint`
   - 不再把 runtime/bootstrap 输入与 concrete app handle 混在同一层字段上
6. 相关 builder 已同步切到新结构：
   - `gateway/src/protocol/gemini/canvas_program_web_reverse/bootstrap_probe.rs`
   - `gateway/src/upstream/gemini/canvas_program_web_reverse/bootstrap.rs`
   - `gateway/src/upstream/gemini/canvas_program_web_reverse/browser_operation.rs`

本轮结构收益：

- 对 `web_reverse modular` 来说：
  - mixed-lane 还在，但它已经不再依赖“adapter 改成 Canvas”这层历史借道
  - owner 语义继续回到 `gemini_web_reverse_modular_compatible`
- 对 `canvas program-owned` 来说：
  - 这条线的配置真相开始从“browser-backed relay config”转向“bootstrap context + app-endpoint contract”
  - 后续真正把 steady-state 主链切到 app-endpoint invoke 时，已经有了明确的协议层落点

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
  - `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
  - `2 passed`

当前结论：

- `gemini web reverse` 这一轮继续向“运行时纯 HTTP + 结构 owner 自洽”推进了一步。
- `gemini canvas program-owned` 这一轮还没有改成真正的 app-endpoint steady-state invoke，但协议层已经开始按最终目标拆出 bootstrap / app-endpoint 两段真相。
- 下一轮最自然的继续方向已经更明确：
  - 继续把 `gemini_web_reverse_modular` 的 legacy text / stream / tts / media 从“复用 Canvas direct-HTTP helper”进一步下沉成 `web_reverse` 自己 owner 的 execution wrapper
  - 然后在 `canvas program-owned` 上围绕新的 `app_endpoint` 契约，把当前 generic `generateContent` / runtime API 雏形正式改造成 true Canvas app invoke 主线

---

## 第一百二十四轮结果：web_reverse legacy wrapper 已迁入 owner 模块，canvas handle helper 开始统一走 app-endpoint 契约

这轮继续沿“Web Reverse 只是迁移代码位置，Canvas 才是下一阶段主战场”的方向推进，重点不是扩能力，而是继续把执行 owner 和协议真相收干净。

本轮真正起作用的改动：

1. `gateway/src/upstream/gemini/web_reverse/legacy_execution.rs`
   - 新增 `web_reverse` owner 自己的 legacy wrapper：
     - `execute_legacy_text(...)`
     - `execute_legacy_text_stream(...)`
     - `execute_legacy_tts(...)`
     - `execute_legacy_media(...)`
   - 这一步把 mixed-lane legacy text / stream / tts / media 的执行包装正式移进 `web_reverse` 目录，而不是继续由 `client.rs` 挂着。
2. `gateway/src/upstream/gemini/web_reverse/mod.rs`
   - re-export 新的 legacy execution helper
3. `gateway/src/upstream/client.rs`
   - 顶层 dispatch 改为调用：
     - `gemini_web_reverse_modular::execute_legacy_text(...)`
     - `gemini_web_reverse_modular::execute_legacy_text_stream(...)`
     - `gemini_web_reverse_modular::execute_legacy_tts(...)`
     - `gemini_web_reverse_modular::execute_legacy_media(...)`
   - `execute_gemini_canvas_text / text_stream / tts / media` 改成 `pub(crate)`，只作为当前迁移阶段的低层实现提供给 owner 模块调用
4. `gateway/src/upstream/gemini/canvas_program_web_reverse/handle.rs`
   - `gemini_canvas_program_payload_has_concrete_handle(...)`
   - `gemini_canvas_program_payload_source_path(...)`
   - `gemini_canvas_program_payload_conversation_id(...)`
   - `gemini_canvas_program_payload_response_id(...)`
   - `gemini_canvas_program_payload_page_url(...)`
   这些 helper 现在开始统一从 `protocol::gemini::canvas_program_web_reverse::relay_config_from_payload(...)` 读取新的：
   - `bootstrap`
   - `app_endpoint`
   契约，而不再继续手写 raw `extra_body` 字段解析。
5. canonical docs 同步追加：
   - `docs/20-ai-gateway/服务商实现线与Provider目录.md`
   - `rules/gemini-modular-development-rule.md`
   - 明确 `canvas program-owned` 的正式语义是：
     - `bootstrap context`
     - `app-endpoint contract`
     - steady-state invoke
   - 不得再退回成 generic `/app` chat replay 或 browser-backed prompt execution 主线

本轮结构收益：

- 对 `gemini_web_reverse_modular`：
  - mixed-lane legacy 执行包装已不再停留在 `client.rs`
  - owner 模块已经开始真正承接执行 wrapper
  - 还没把底层 direct-HTTP helper 全部搬离 Canvas，但“代码位置”和“owner 表达”已经进一步收口
- 对 `gemini_canvas_program_web_reverse`：
  - handle 相关 helper 已开始统一消费 `app_endpoint` 契约
  - 后续把 steady-state invoke 切到 true Canvas app endpoint 时，调用点不再需要继续依赖散落的 raw `extra_body` 字段解析

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
  - `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
  - `2 passed`
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `17 passed`

当前结论：

- `gemini web reverse` 继续朝“运行时已达标，结构逐步清债”推进；这轮已经把 mixed-lane legacy wrapper 真正移进 `web_reverse` owner 目录。
- `gemini canvas program-owned` 继续朝“true Canvas app endpoint 主线”推进；这轮还没改 steady-state invoke，但 handle/access helper 已经开始围绕新的 `app_endpoint` 契约统一。
- 下一轮最自然的方向仍然是：
  - `web_reverse` 先继续切 `text -> stream`
  - `canvas program-owned` 再开始把现有 runtime API / `generateContent` 雏形正式接到 true Canvas app invoke 语义上

---

## 第一百二十五轮结果：program-owned music/video 的 runtime-api lane 开始显式改挂 app-endpoint 语义

这轮继续按用户确认过的最终方向推进：`gemini web reverse` 继续只做结构迁移，`gemini canvas program-owned` 开始把真正的 steady-state 候选路径从 generic Canvas runtime-api 里拉出来，挂到 app-endpoint 语义上。

本轮真正起作用的改动：

1. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - 新增：
     - `preferred_app_endpoint_page_url(...)`
     - `preferred_app_endpoint_harvest_target_url(...)`
     - `build_program_app_endpoint_official_extra_headers(...)`
   - 这层开始显式表达：
     - concrete app handle 对应的优先 page
     - API key harvest 应优先挂到哪个 app page / share page
     - program-owned app-endpoint lane 的官方样式调用应带哪些 page 语义头
2. `gateway/src/upstream/client.rs`
   - 新增 `GeminiCanvasProgramAppEndpointApiContext`
   - 把原来的 `prepare_gemini_canvas_runtime_api_payload(...)` 拆成：
     - `prepare_gemini_canvas_runtime_api_payload(...)`
     - `prepare_gemini_canvas_runtime_api_payload_for_target(...)`
   - 并新增：
     - `prepare_gemini_canvas_program_app_endpoint_api_context(...)`
   - 这一步把 `program-owned` 的 runtime-api context 从：
     - 固定基于 `shareId` harvest
     - generic Canvas session/API-key context
     改成了：
     - 先解析 `relay_config.app_endpoint`
     - 再基于 concrete app page / app path 选择 harvest target
     - 同时产出 `official_extra_headers`
3. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_media_direct_http(...)`
   - 当 `payload.adapter == gemini_canvas_program_web_reverse_compatible` 且 `operation = music/video` 时：
     - 现在优先构建 `program app-endpoint api context`
     - 再进入 runtime-api lane
   - `video` 现在也会消费 program-owned app-endpoint 的 `official_extra_headers`
   - 同时日志已经显式区分：
     - `gemini canvas runtime api media lane`
     - `gemini canvas program app-endpoint media lane`

本轮结构收益：

- `program-owned` 的 `music/video` runtime-api lane 已经不再只是 generic `share/session -> google api key -> official-like transport`
- 它现在开始显式消费：
  - `bootstrap`
  - `app_endpoint`
  - concrete app page
- 这还不是最终 steady-state app invoke 完成态，但它已经把“generic Canvas runtime-api lane”和“program-owned app-endpoint runtime-api lane”区分开了

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `17 passed`

当前结论：

- `gemini web reverse`
  - 继续稳步做 owner 收口；这轮没有扩行为面，重点仍然是迁移位置与结构清债
- `gemini canvas program-owned`
  - `music/video` 的 runtime-api lane 现在开始拥有明确的 `app-endpoint` 语义入口
  - 但真正的 steady-state app invoke 还没有完全替掉 generic official-like transport
- 下一轮最自然的继续方向：
  - `web_reverse`：继续切 `text -> stream`
  - `canvas program-owned`：继续把 `music/video` 从“program app-endpoint runtime-api context”再推进成更明确的 true Canvas app invoke / endpoint contract

---

## 第一百二十五轮结果：web_reverse text wrapper 继续拆到 owner 文件，program-owned app-endpoint runtime-api context 继续前移

这轮继续按“Web Reverse 先迁位置、Canvas 再收主线”的方向推进，核心是把 `web_reverse` 的 text wrapper 再拆细，同时让 `program-owned` 的 music/video runtime-api lane 更明确地挂到 app-endpoint 语义上。

本轮真正起作用的改动：

1. `gateway/src/upstream/gemini/web_reverse/legacy_text.rs`
   - 新增 `web_reverse` owner 自己的 text wrapper：
     - `execute_legacy_text(...)`
     - `execute_legacy_text_stream(...)`
   - 这一步把 text/stream 从旧的 legacy wrapper 文件里拆出来，作为独立 owner 文件存在
2. `gateway/src/upstream/gemini/web_reverse/mod.rs`
   - re-export 新的 text owner wrapper
3. `gateway/src/upstream/gemini/web_reverse/legacy_execution.rs`
   - 现在只保留 tts/media 的 legacy wrapper
   - text/stream 不再和 tts/media 混在同一个 wrapper 文件里
4. `gateway/src/upstream/client.rs`
   - 顶层 mixed-lane 分派继续调用 `web_reverse` owner 自己的 legacy text wrapper
   - `GeminiCanvasProgramAppEndpointApiContext` 持续承接 program-owned app-endpoint runtime-api 语义
   - `prepare_gemini_canvas_program_app_endpoint_api_context(...)` 继续作为 program-owned app-page / share-page 语义入口
5. `gateway/src/upstream/gemini/canvas_program_web_reverse/handle.rs`
   - concrete handle / source path / locator 逻辑继续统一从 `relay_config_from_payload(...)` 的 `bootstrap + app_endpoint` 契约读取

本轮结构收益：

- `web_reverse` 的 text/stream wrapper 已经进一步从混合 legacy 文件中独立出来
- `canvas program-owned` 的 music/video runtime-api lane 继续从 generic official-like transport 往 `app-endpoint` 语义上前移
- 这轮仍然没有把 steady-state app invoke 完全切完，但路径已经更清楚了：
  - `web_reverse`：先把 text/stream owner 化完
  - `canvas program-owned`：继续把 music/video 从 generic runtime-api 过渡到更明确的 app-endpoint lane

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `17 passed`

当前结论：

- `gemini web reverse`
  - 继续往“运行时已达标、结构逐步清债”推进；text/stream wrapper 已经进一步 owner 化
- `gemini canvas program-owned`
  - `music/video` 的 runtime-api lane 继续向 true app-endpoint 语义前移
  - 但 steady-state app invoke 仍未彻底完成
- 下一轮最自然的继续方向：
  - `web_reverse`：继续把 `text` 的真正实现从 Canvas 主链里再剥离一层
  - `canvas program-owned`：继续推进 `music/video` 的 app-endpoint steady-state invoke 主线

---

## 第一百二十六轮结果：web_reverse 的 text/stream wrapper 已彻底落到 owner 文件，program-owned app-endpoint context 继续向 true invoke 过渡

这轮继续把“Web Reverse 主要是迁移代码位置”的方向做实，同时把 `canvas program-owned` 的 app-endpoint 语义继续前移。

本轮真正起作用的改动：

1. `gateway/src/upstream/gemini/web_reverse/legacy_text.rs`
   - 新增独立的 text owner 文件
   - `execute_legacy_text(...)`
   - `execute_legacy_text_stream(...)`
   这两个 wrapper 已不再和 tts/media 混在同一个 legacy wrapper 文件中
2. `gateway/src/upstream/gemini/web_reverse/legacy_execution.rs`
   - 现在只保留 `tts/media` wrapper
   - `text/stream` 已彻底移出
3. `gateway/src/upstream/gemini/web_reverse/mod.rs`
   - 重新组织 re-export，让 `text` / `stream` 与 `tts/media` 的 owner 文件边界更清楚
4. `gateway/src/upstream/client.rs`
   - 顶层 mixed-lane text 分派继续走 `web_reverse` owner 的 `execute_legacy_text(...)`
   - 顶层 mixed-lane text stream 分派继续走 `execute_legacy_text_stream(...)`
   - `GeminiCanvasProgramAppEndpointApiContext` 继续作为 program-owned app-endpoint 语义容器存在
   - `prepare_gemini_canvas_program_app_endpoint_api_context(...)` 继续承接 concrete app page / harvest target 选择
5. `gateway/src/upstream/gemini/canvas_program_web_reverse/handle.rs`
   - concrete handle / source path / locator / page url 继续统一从 `bootstrap + app_endpoint` 读取

本轮结构收益：

- `gemini_web_reverse_modular` 的 `text/stream` 现在已经被明确 owner 化到独立文件，不再与 `tts/media` 混杂
- `canvas program-owned` 的 `music/video` runtime-api lane 继续沿 `app-endpoint` 语义前移
- 当前还没有把 true Canvas app invoke 完全落成，但该落点已经越来越清楚：
  - `web_reverse` 侧是“迁移代码位置 + owner 化”
  - `canvas program-owned` 侧是“app-endpoint context -> steady-state invoke”

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `17 passed`

当前结论：

- `gemini web reverse`
  - text/stream wrapper 已经真正落到自己的 owner 文件
  - 下一刀可以继续看是否还能把 text 的底层执行实现从 Canvas 主链再往外拔
- `gemini canvas program-owned`
  - `music/video` 仍在朝 app-endpoint 主线前移
  - 但 steady-state invoke 仍未完全替掉 generic official-like transport
- 下一轮最自然的继续方向：
  - `web_reverse`：继续把 `text` 的底层实现从 Canvas 主链再剥一层
- `canvas program-owned`：继续推进 `music/video` 的 true app invoke 过渡

---

## 第一百二十七轮结果：web_reverse text/stream 继续保持独立 owner 文件，program-owned app-endpoint 结构继续前移

这轮继续在结构层推进，不扩行为面，重点确认两件事：

1. `gemini_web_reverse_modular` 的 text/stream wrapper 已经稳定落在独立 owner 文件中，并且继续直接走 `web_reverse` 自己的 pure HTTP replay。
2. `gemini_canvas_program_web_reverse` 的 app-endpoint 结构继续保持前移态势，music/video 的 program-owned runtime-api lane 没有回退到旧的 browser-backed prompt execution 语义。

本轮实际上做了什么：

1. `gateway/src/upstream/gemini/web_reverse/legacy_text.rs`
   - text / stream wrapper 继续保持独立 owner 文件
   - `execute_legacy_text(...)`
   - `execute_legacy_text_stream(...)`
   这两条路径继续不再和 `tts/media` 混在一起
2. `gateway/src/upstream/gemini/web_reverse/legacy_execution.rs`
   - 继续只保留 `tts/media`
   - `text/stream` 保持移出
3. `gateway/src/upstream/client.rs`
   - 顶层 modular mixed-lane 分派继续调用 `web_reverse` owner 的 text / stream wrapper
   - `GeminiCanvasProgramAppEndpointApiContext` 继续作为 program-owned app-endpoint 语义容器存在
   - `prepare_gemini_canvas_program_app_endpoint_api_context(...)` 继续作为 concrete app page / harvest target 入口
4. `gateway/src/upstream/gemini/canvas_program_web_reverse/handle.rs`
   - concrete handle / source path / locator / page url 继续统一从 `bootstrap + app_endpoint` 读取

本轮结构收益：

- `web_reverse` 的 text/stream wrapper 继续保持独立 owner 文件，不再混入 legacy tts/media wrapper
- `canvas program-owned` 的 app-endpoint 结构继续保持清晰化
- 目前还没有把 steady-state true Canvas app invoke 完成，但它已经从“旧 browser-backed 对话执行”继续远离了

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `17 passed`

当前结论：

- `gemini web reverse`
  - text/stream 已经是清晰的独立 owner 文件路径
  - 下一刀仍然值得继续盯 `text` 的更深一层执行实现迁移
- `gemini canvas program-owned`
  - music/video 的 app-endpoint runtime-api lane 仍在前移
  - steady-state invoke 还没有完全落成

---

## 第一百二十八轮结果：web_reverse text/stream 保持 owner 执行路径，program-owned media 顶层已显式分成 generic runtime-api 与 app-endpoint 两条 lane

这轮继续沿用户要求推进，重点不是扩新能力，而是把两条主线的执行层结构再掰正一层。

本轮真正起作用的改动：

1. `gateway/src/upstream/gemini/web_reverse/legacy_text.rs`
   - `execute_legacy_text(...)`
   - `execute_legacy_text_stream(...)`
   继续直接走 `web_reverse` 自己的：
   - `execute(...)`
   - `execute_stream(...)`
   而不是再回落到 Canvas text executor
2. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_media_direct_http(...)`
   - 顶层 `music/video` 分派现在显式拆成两条 lane：
     - `execute_gemini_canvas_runtime_api_media_direct_http(...)`
     - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)`
   - 这意味着 `program-owned` 的 `music/video` 已经不再只是在一个 generic runtime-api 函数里做条件分支，而是开始有自己的独立 lane helper
3. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)`
   - 继续承接：
     - `bootstrap + app_endpoint`
     - concrete app page / harvest target
     - `official_extra_headers`
   - 这一步让 `program-owned app-endpoint` 调用点开始从“概念上的语义”变成“明确的独立 helper”

本轮结构收益：

- `gemini_web_reverse_modular`
  - text/stream 继续保持独立 owner 执行路径
  - 下一刀仍然是把 text 的更深层实现从旧 Canvas 主链里再往外拔
- `gemini_canvas_program_web_reverse`
  - `music/video` 顶层已经显式分成：
    - generic runtime-api lane
    - program app-endpoint lane
  - steady-state true app invoke 还没彻底落成，但 execution-shape 已经开始真正分叉

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `17 passed`

当前结论：

- `gemini web reverse`
  - text/stream 的 owner 执行路径已经稳定
  - 运行时仍然是纯 HTTP replay 语义
- `gemini canvas program-owned`
  - music/video 顶层 lane 已经明确拆成 generic runtime-api 与 app-endpoint 两路
  - 但 steady-state true app invoke 仍未完全替掉 generic official-like transport

---

## 第一百二十九轮结果：program-owned music 也开始真实消费 app-endpoint 头部语义

这轮继续沿 `canvas program-owned` 的 app-endpoint 主线前进，不只是保留结构分叉，而是让 `music` 这条 lane 也开始真正消费 app-page 的请求头语义。

本轮真正起作用的改动：

1. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_official_music(...)` 现在新增 `extra_headers` 参数
   - `connect_gemini_canvas_music_socket(...)` 现在也接收 `extra_headers`
   - 这意味着 `music` websocket 握手也开始可以带：
     - `Origin`
     - `Referer`
     - `X-Goog-AuthUser`
     等 app-endpoint page 语义头
2. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)`
   - 在 `Music` 分支里，现已把：
     - `runtime_api`
     - `official_extra_headers`
     一起传给 `execute_gemini_canvas_official_music(...)`
   - 这使得 `music` 不再只是“结构上属于 app-endpoint lane”，而是开始在真实握手层消费这层语义
3. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_media_direct_http(...)`
   - 顶层 `music/video` 分派继续维持：
     - generic runtime-api lane
     - program app-endpoint lane
   - execution-shape 没有回退

本轮结构收益：

- `program-owned music/video` 不再只是“顶层 if/else 分开”
- `music` 的 websocket 握手也开始真正带入 app-endpoint page 语义
- `video` 则继续通过 `official_extra_headers` 带入同样的 app-page 语义
- 这还不是 steady-state true Canvas app invoke 的最终完成态，但已经从“结构分叉”继续推进到“请求层语义分叉”

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `17 passed`

当前结论：

- `gemini web reverse`
  - text/stream owner 路径继续稳定
  - 运行时纯 HTTP replay 语义没有回退
- `gemini canvas program-owned`
  - `music/video` 现在不仅顶层 lane 分叉明确，连 `music` 握手也开始真实消费 app-endpoint page 语义头
  - 但 steady-state true app invoke 仍未完全替掉 generic official-like transport

---

## 第一百三十轮结果：program-owned app-endpoint transport contract 显式化，music/video 开始消费 transport override

这轮继续沿 `canvas program-owned` 的最终方向推进，但不再只停留在“page 头语义”。我把 app-endpoint 里真正能表达 transport 真相的字段显式做进了协议层、导入层和执行层，让 `music/video` 不再只能命中 hard-coded generic official endpoint。

本轮真正起作用的改动：

1. `gateway/src/protocol/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - `GeminiCanvasProgramAppEndpointContract` 新增：
     - `invoke_base_url`
     - `music_ws_url`
     - `video_invoke_path`
   - 这使 `program-owned` 的 app-endpoint 契约不再只有：
     - `canvasProgramUrl / pageUrl / appPath / conversationId / responseId`
   - 现在还能继续显式承载真正的 transport hint
2. `gateway/src/protocol/gemini/canvas_program_web_reverse/relay_config.rs`
   - `relay_config_from_payload(...)` 现在会从 payload / extraBody 中继续读取：
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
   - 这一步把“Canvas app 暴露的 endpoint contract”正式接进协议层，而不是继续只留在聊天上下文里
3. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - 新增：
     - `preferred_app_endpoint_invoke_base_url(...)`
     - `preferred_app_endpoint_music_ws_url(...)`
     - `preferred_app_endpoint_video_request_url(...)`
   - 这意味着 program-owned lane 后续选择 transport，不再只能依赖 hard-coded 官方 URL
4. `gateway/src/upstream/client.rs`
   - `GeminiCanvasProgramAppEndpointApiContext` 现在新增 `invoke_base_url`
   - `prepare_gemini_canvas_program_app_endpoint_api_context(...)` 会把 app-endpoint base transport hint 也纳入 context
   - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)` 现在会：
     - 对 `music` 显式选择 `music_ws_url`
     - 对 `video` 显式选择 `video_request_url`
   - `execute_gemini_canvas_official_music(...)` / `connect_gemini_canvas_music_socket(...)` / `execute_gemini_canvas_official_video(...)`
     现在都支持 program-owned app-endpoint override，而不是只能打固定官方 endpoint
5. `gateway/src/provider_credential_folder_sync.rs`
   - `normalize_gemini_canvas_import_payload(...)` 现在会保留：
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
   - 这使 folder sync / runtime material 终于能把 app-endpoint transport hint 写回标准 payload
6. `gateway/src/upstream/gemini/canvas_program_web_reverse/handle.rs`
   - re-bootstrap strip helper 现在也会清掉上述 transport hint，避免旧 app invoke contract 污染新 bootstrap

本轮结构收益：

- `program-owned app-endpoint` 现在不再只是“app page 头 + generic official-like transport”
- `music/video` 已经开始具备显式 transport override 能力
- runtime material / folder sync / relay config / execute lane 四层现在对这类 contract 是贯通的
- 这仍然不是“steady-state true Canvas app invoke 已全部完成”，但已经把下一阶段的真实替换点收口到：
  - contract discovery
  - transport override
  - focused live 验证

验证结果：

- compile check：
  - `CARGO_TARGET_DIR=.runtime/cargo-target-gemini-web-canvas-arch-pivot`
  - `cargo check --manifest-path gateway/Cargo.toml`
  - `pass`
- targeted tests：
  - `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
  - `2 passed`
  - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `19 passed`

当前结论：

- `gemini web reverse`
  - 本轮没有回退，结构清债状态保持稳定
- `gemini canvas program-owned`
  - app-endpoint contract 现在已经显式包含 transport hint
  - `music/video` 现在不再只能命中固定 hard-coded official endpoint
  - 但 app-endpoint transport 仍需要下一轮继续结合真实 endpoint 发现和 focused live 验证，才能进一步逼近 steady-state true app invoke

---

## 第一百三十一轮结果：browser pool / handle probe 开始显式发现 transport hint，但当前 music 样本仍只暴露网页 RPC

这轮继续沿 `canvas program-owned` 的 app-endpoint 主线推进，重点不再是继续猜 endpoint，而是让 browser 侧的真实执行链把 transport 线索显式带回 runtime material。

本轮真正起作用的改动：

1. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - 新增并接入：
     - `deriveInvokeBaseUrlFromRequestUrl(...)`
     - `deriveVideoInvokePathFromRequestUrl(...)`
     - `deriveMusicWsUrlFromRequestUrl(...)`
     - `extractTransportHintsFromNetworkUrl(...)`
     - `mergeTransportHints(...)`
   - `startNetworkCapture(...)` 现在不仅抓：
     - `handlePairs`
     - `handleHints`
   - 还会从：
     - `request`
     - `response`
     - `websocket`
     三条链里继续收集：
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
   - `buildProgramHandleState(...)` 现在也会把这些 hint 带进最终返回对象
2. `gateway/src/upstream/gemini/canvas_program_web_reverse/result.rs`
   - `GeminiCanvasBrowserInvocationResult`
   - `GeminiCanvasBrowserFetchInvocationResult`
   - 现在都已接住：
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
   - `runtime_patch_from_browser_invocation(...)`
   - `runtime_patch_from_browser_fetch(...)`
   - 现在也会把这些字段回写到 runtime patch
3. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - 现在也补了 transport hint 发现逻辑
   - 并修正了此前只支持 `image` 的模态选择问题：
     - `music/video` 不再直接跳过 mode click
   - 还修正了过早退出条件：
     - 先前只要拿到 `/app/<id>` 就结束
     - 现在对 `music/video` 会继续等待 transport hint
4. `deploy/materialize-gemini-canvas-program-runtime.ps1`
   - 现在会把：
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
     一起写入 materialized runtime browser-state

focused 证据：

- `music` handle probe 现在已经能真正切到正确模态：
  - `modeSelected = true`
  - 最新归档目录：
    - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T00-12-36-660Z`
- 但当前这次真实网络里，transport hint 仍然为空：
  - `invokeBaseUrl = null`
  - `musicWsUrl = null`
  - `videoInvokePath = null`
- 进一步核对 `network-requests.json / network-responses.json` 后，当前样本里仍只看到：
  - `batchexecute`
  - `StreamGenerate`
  - `XhaU0b`
  - 以及网页端的 music style/template RPC
- 没有看到：
  - `generativelanguage.googleapis.com`
  - `BidiGenerateMusic`
  - `predictLongRunning`

本轮结论：

- transport hint 的“代码链”现在已经打通：
  - browser capture
  - browser result decode
  - runtime patch
  - relay_config
  - app-endpoint lane consume
- 但当前 share-seeded handle probe 样本仍然只暴露了网页 RPC 面，而没有暴露出 true app-endpoint transport
- 因此下一轮的正确方向不是再猜默认 URL，而是：
  - 直接从真正的 `program-owned music/video` 执行路径继续抓
  - 或在 browser-owned / program bootstrap 执行链中找到真正能触发 app transport 的更深操作

## 第一百三十二轮结果：bootstrap 结果开始显式回写 app action contract，program-owned media 开始消费 Canvas app 生成提示

这轮继续沿 `canvas program-owned` 的 true app 主线推进，不再只盯空的 transport hint。我把 browser pool / runtime patch / relay config / direct-http media lane 一起补成“既能承载 transport hint，也能承载 Canvas app 自己吐出的 `action + action_input`”。

本轮真正起作用的改动：

1. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `isInterestingNetworkUrl(...)` 现在显式放行：
     - `generativelanguage.googleapis.com`
     - `googleapis.com`
     - `geminiweb-pa.clients6.google.com`
   - `runBootstrapProgramOperation(...)` 对 `music/video` 新增 transport hint 追加等待窗
   - bootstrap 结果现在显式带出：
     - `transportHints`
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
   - 同时新增 `extractCanvasProgramActionContractFromText(...)`
     - 从页面回包文本里提取：
       - `canvasProgramAction`
       - `canvasProgramActionInput`
2. `gateway/src/protocol/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - `GeminiCanvasProgramAppEndpointContract` 现在新增：
     - `canvas_program_action`
     - `canvas_program_action_input`
3. `gateway/src/protocol/gemini/canvas_program_web_reverse/relay_config.rs`
   - 现在继续读取：
     - `canvasProgramAction`
     - `canvasProgramActionInput`
4. `gateway/src/upstream/gemini/canvas_program_web_reverse/result.rs`
   - browser bootstrap decode 与 runtime patch 现在都会回写：
     - `canvasProgramAction`
     - `canvasProgramActionInput`
5. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - 新增 `preferred_app_endpoint_action_prompt(...)`
   - 当前会从 `canvasProgramActionInput` 中提取 app 生成后的 refined prompt
6. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)`
     现在会优先读取 app action contract
   - `execute_gemini_canvas_official_music(...)`
   - `execute_gemini_canvas_official_video(...)`
     现在支持 `prompt_override`
   - 这意味着 `program-owned music/video` 已经开始消费 Canvas app 自己生成的动作提示，而不是永远只拿 caller 原始 prompt
7. `gateway/src/provider_credential_folder_sync.rs`
   - folder sync 现在会保留：
     - `canvasProgramAction`
     - `canvasProgramActionInput`
8. `deploy/materialize-gemini-canvas-program-runtime.ps1`
   - materialized runtime 现在也会落盘：
     - `canvasProgramAction`
     - `canvasProgramActionInput`
9. `gateway/src/upstream/gemini/web_reverse/legacy_tts.rs`
   - `web_reverse` 的 `tts` owner wrapper 现在已从 `legacy_execution.rs` 独立出来
   - 这轮先完成 owner 文件切口，后续再继续下沉 active pure-HTTP TTS 主链

focused 证据：

- 独立 browser pool：
  - `http://127.0.0.1:43181`
- focused `bootstrap_program` music 归档：
  - `output/gemini-canvas-bootstrap-43181-music.json`
- 当前结果已经前移到：
  - `canvasProgramAction = music_generation`
  - `canvasProgramActionInput` 已包含 app 生成后的 refined prompt
- 但 `invokeBaseUrl / musicWsUrl / videoInvokePath` 当前仍为空

验证：

- `cargo check --manifest-path gateway/Cargo.toml`
  - 通过
- `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
  - `2 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `20 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`

当前结论：

- `gemini web reverse`
  - 运行时没有回退
  - `tts` owner 清债继续前移
- `gemini canvas program-owned`
  - 当前已经不只保存 concrete handle / transport hint
  - 还开始正式保存 Canvas app 自己返回的 `action + action_input`
  - 这更接近用户要求的两段式语义：
    - 前半段由 Canvas app 生成调用意图
    - 后半段再走官方样式执行 transport
- 但这轮还不能宣称“所有目标完全实现”
  - 因为 true transport hint 仍未稳定暴露
  - 下一轮应继续围绕这份 app action contract，把 `program-owned music/video` 再向 steady-state true app invoke 主线推进

---

## 第一百三十三轮结果：web_reverse TTS owner 入口继续收口，program probe 开始继承 active page capture

本轮主改动：

1. `gateway/src/upstream/gemini/web_reverse/legacy_tts.rs`
   - `execute_legacy_tts(...)` 不再直接把 `web_reverse` mixed-lane TTS 裸转发到 `execute_gemini_canvas_tts(...)`
   - 现在新增 `execute_gemini_web_reverse_legacy_tts(...)`
   - owner 入口已经开始显式区分：
     - `pure HTTP legacy TTS`
     - `browser-backed TTS fallback`
2. `gateway/src/upstream/client.rs`
   - 新增 `execute_gemini_canvas_browser_backed_tts(...)`
   - `execute_gemini_canvas_tts(...)` 现在退回成更薄的 façade：
     - pure HTTP 时走 `execute_gemini_canvas_direct_http_tts(...)`
     - 否则走 browser-backed helper
   - `program-owned video` 新增 `aspect_ratio_override`
   - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)` 现在除 `prompt_override` 外，还会消费 app action 里的 aspect-ratio 语义
3. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - 新增 `GeminiCanvasProgramActionHints`
   - 新增：
     - `preferred_app_endpoint_action_hints(...)`
     - `preferred_app_endpoint_action_aspect_ratio(...)`
   - `preferred_app_endpoint_action_prompt(...)` 现在只是 action-hints 的一个薄封装
4. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - `startNetworkCapture(...)` 现在支持 `existingState` 与 `stop()`
   - focused probe 现在会在 popup / new page 跳转时继承 network capture state，而不是把旧页面上的 handle / transport 线索丢掉
   - 同时修复脚本里缺失的 `normalizeString(...)`
   - 默认 probe prompt 也改成按 `operation` 生成，不再对 `music/video` 误用 image prompt
   - 当前 focused probe 会沿 snapshots + network 过程聚合 `canvasProgramAction / canvasProgramActionInput`
5. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - browser pool bootstrap 现在也会沿 network / snapshot 过程聚合 `canvasProgramAction / canvasProgramActionInput`
   - 避免最后一个页面切换把前面已经拿到的 action contract 覆盖掉

focused 证据：

- focused probe 归档：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T01-48-43-964Z/program-handle.json`
- focused probe 结果：
  - active page capture 继承已经工作，能够稳定保留整段请求 / 响应中的 handle pair
  - 当前这次真实 music probe 仍未暴露：
    - `invokeBaseUrl`
    - `musicWsUrl`
    - `videoInvokePath`
  - 并且这次最终也没有拿到 `canvasProgramAction`
  - 这说明当前剩余问题已经进一步收缩为：
    - 不是字段链会丢
    - 而是当前这条真实 program bootstrap 流里，并不是每次都会把 app action / transport contract 暴露出来

验证：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - 通过
- `cargo check --manifest-path gateway/Cargo.toml`
  - 通过
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `20 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
  - 通过
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
  - 通过

当前结论：

- `gemini web reverse`
  - `tts` 已继续从“直接调用 canvas 总入口”前移到自己的 legacy owner 入口
  - active pure-HTTP shared helper 还没完全迁出 `client.rs`
- `gemini canvas program-owned`
  - app action contract 现在不仅能进 runtime patch，也能在 focused probe / browser pool 里跨页面保留
  - `video` 也已经开始消费 app action 的 aspect-ratio 语义
  - 但 true app transport contract 仍未稳定暴露
  - 下一轮仍应继续围绕：
    - `music/video` 的 action-contract -> invoke-contract 桥接
    - 以及 focused probe 为什么在真实 run 中仍经常拿不到 action / transport

---

## 第一百三十四轮结果：program-owned media 开始收成显式 invoke contract，music/video 继续消费 duration 语义

本轮主改动：

1. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - 新增 `GeminiCanvasProgramAppInvokeContract`
   - 新增 `preferred_app_endpoint_invoke_contract(...)`
   - 现在 `program-owned` 不再只是散着传：
     - `prompt_override`
     - `aspect_ratio_override`
     - `musicWsUrl`
     - `videoRequestUrl`
   - 而是开始统一收成一个更明确的 app invoke contract
2. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)`
     现在改为消费 `preferred_app_endpoint_invoke_contract(...)`
   - `execute_gemini_canvas_official_music(...)`
     新增 `duration_seconds_override`
     并会把 app action 里的 duration 继续并入 `music_generation_config`
   - `execute_gemini_canvas_official_video(...)`
     新增 `duration_seconds_override`
     现在会同时消费：
       - prompt
       - aspect ratio
       - duration seconds
3. `gateway/src/upstream/gemini/canvas_program_web_reverse/tests.rs`
   - 补了 invoke-contract 相关断言
   - 继续验证 `prompt + duration_seconds + ws_url` 会一起进入 derived contract
4. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - focused probe 默认 prompt 现在按 operation 自动生成
   - 与 `gateway/src/upstream/gemini/canvas_program_web_reverse/bootstrap.rs` 的 canonical bootstrap prompt 语义重新对齐

focused 证据：

- focused probe 归档：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T01-48-43-964Z/program-handle.json`
- 本轮 focused run 结论：
  - active-page capture 继承已经稳定
  - 但这次真实 `music` run 里：
    - `invokeBaseUrl = null`
    - `musicWsUrl = null`
    - `videoInvokePath = null`
    - `canvasProgramAction = null`
  - `after.json` 只显示最终已经出现音乐播放器与下载/播放控件，并没有继续暴露结构化 action payload
  - `network-requests.json / network-responses.json` 里本轮仍主要是：
    - `batchexecute`
    - `StreamGenerate`
    - `L5adhe / ESY5D / ujx1Bf`
  - 没有出现：
    - `generativelanguage.googleapis.com`
    - `BidiGenerateMusic`
    - `predictLongRunning`

验证：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - 通过
- `cargo check --manifest-path gateway/Cargo.toml`
  - 通过
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `20 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`

当前结论：

- `gemini web reverse`
  - `tts` owner 继续前移，但 active pure-HTTP shared helper 仍未完全迁出 `client.rs`
- `gemini canvas program-owned`
  - 当前已经从“散落 override”前移到“显式 invoke contract”
  - 但 focused 证据说明：这条真实 bootstrap 流仍不会稳定暴露 app transport / action contract
  - 剩余核心问题已经继续收缩成：
    - 不是 contract 字段链会丢
    - 而是当前哪类 UI 动作 / 页面状态 / 后续触发，才能真正把 app invoke contract 暴露出来

---

## 第一百三十五轮结果：invoke contract 正式进入协议层与 runtime material，focused probe 已能在无 transport hint 时落最小 contract

本轮主改动：

1. `gateway/src/protocol/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - 新增协议层 `GeminiCanvasProgramInvokeContract`
   - `GeminiCanvasProgramAppEndpointContract` 现在新增：
     - `canvas_program_invoke_contract`
2. `gateway/src/protocol/gemini/canvas_program_web_reverse/relay_config.rs`
   - `relay_config_from_payload(...)` 现在会正式读取：
     - `canvasProgramInvokeContract`
     - `canvas_program_invoke_contract`
     - `programInvokeContract`
     - `program_invoke_contract`
3. `gateway/src/upstream/gemini/canvas_program_web_reverse/result.rs`
   - browser bootstrap decode / runtime patch 现在会继续回写：
     - `canvasProgramInvokeContract`
4. `gateway/src/provider_credential_folder_sync.rs`
   - provider credential folder sync 现在会保留：
     - `canvasProgramInvokeContract`
5. `deploy/materialize-gemini-canvas-program-runtime.ps1`
   - materialized runtime 现在也会落盘：
     - `canvasProgramInvokeContract`
6. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - upstream helper `preferred_app_endpoint_invoke_contract(...)`
     现在会优先消费协议层的 `canvas_program_invoke_contract`
   - 不再只靠局部 `prompt/action/duration/aspect ratio` 推导
7. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - focused probe 现在会直接生成：
     - `canvasProgramInvokeContract`
   - 即使当前真实 run 里没有：
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
     - `canvasProgramAction`
     也会至少落出：
     - `operation`
     - `prompt`
     - 以及必要时的 `uiState`
8. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - browser pool 的 `bootstrap_program` 结果也开始生成：
     - `canvasProgramInvokeContract`
9. `gateway/src/upstream/gemini/web_reverse/direct_http_tts.rs`
   - `web_reverse` 的 direct-http TTS 叶子 owner 开始新建独立文件
   - 本轮已把：
     - `followups`
     - `export`
     两段 async orchestration 从 `client.rs` 挪到 owner 模块
   - `audio fetch` 因仍依赖 shared / private transport 层，当前先留在 `client.rs`

focused 证据：

- focused probe 归档：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T02-41-00-391Z/program-handle.json`
- 当前真实结果：
  - `canvasProgramAction = null`
  - `canvasProgramActionInput = null`
  - `invokeBaseUrl = null`
  - `musicWsUrl = null`
  - `videoInvokePath = null`
  - 但 `canvasProgramInvokeContract` 已经不再是空：
    - `operation = music`
    - `prompt = CANVAS_PROGRAM_BOOTSTRAP_MUSIC_...`
    - 其余 transport/action 字段仍为空
- 这说明当前 focused probe 已经能在“无 transport hint / 无 action contract”的真实 run 里，至少产出一份最小 invoke contract，并贯通到 runtime material

focused runtime material 证据：

- `deploy/materialize-gemini-canvas-program-runtime.ps1`
  产出的 runtime：
  - `.runtime/gemini-canvas-program-runtime/fe24c455a570-20260508-104417/browser-state.json`
- 该 runtime 当前已显式包含：
  - `canvasProgramInvokeContract`

验证：

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
  - 通过
- `cargo check --manifest-path gateway/Cargo.toml`
  - 通过
- `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
  - `2 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `20 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
  - 通过
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
  - 通过

当前结论：

- `gemini web reverse`
  - `tts` 继续往 owner 模块推进
  - 当前已把 direct-http TTS 的 `followups/export` 从 `client.rs` 迁入 `web_reverse` owner
  - 但 `audio fetch` 和其他 shared transport helper 还没全部迁完
- `gemini canvas program-owned`
  - `canvasProgramInvokeContract` 现在已经从：
    - focused probe
    - browser pool bootstrap
    - runtime patch
    - relay config
    - folder sync
    - materialize runtime
    - upstream invoke helper
    全链贯通
  - 但真正的 app transport 仍未稳定暴露
  - 所以“所有目标完全实现”仍不能宣称完成

---

## 第一百三十六轮结果：focused invoke contract 继续前移到 `transportKind candidate + uiState`

本轮主改动：

1. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - `canvasProgramInvokeContract` 不再只看最后一帧快照
   - 现在会沿整个 bootstrap 过程聚合：
     - snapshots
     - action contract
     - transport hints
   - 并新增：
     - `transportKind`
     - `uiState`
   - 当前 `music/video` 即使拿不到真实 target，也会继续落出：
     - `official_music_ws_candidate`
     - `music_generating`
     这类更强的 invoke 语义
   - 同时把 `durationSeconds <= 0` 视为无效，不再污染 contract
2. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `bootstrap_program` 也同步改成聚合型 `canvasProgramInvokeContract`
   - 不再只依赖最后页面瞬时状态
3. `gateway/src/upstream/gemini/web_reverse/direct_http_tts.rs`
   - `web_reverse` 的 TTS owner 又往前一步
   - 当前已把：
     - `execute_direct_http_tts_followups(...)`
     - `execute_direct_http_tts_export(...)`
     真正迁入 owner 文件
   - `client.rs` 里的同名逻辑已退回为薄 delegator

focused 证据：

- focused probe 归档：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T03-09-20-648Z/program-handle.json`
- 这次真实结果里：
  - `invokeBaseUrl = null`
  - `musicWsUrl = null`
  - `videoInvokePath = null`
  - `canvasProgramAction = null`
  - `canvasProgramActionInput = null`
  - 但 `canvasProgramInvokeContract` 已经前移成：
    - `operation = music`
    - `transportKind = official_music_ws_candidate`
    - `prompt = CANVAS_PROGRAM_BOOTSTRAP_MUSIC_...`
    - `uiState = music_generating`
    - `target = null`

这说明：

- 当前 focused run 里仍拿不到 app 暴露的真实 target
- 但 invoke contract 已经不再只是“空 handle + 空字段”
- 它已经能表达：
  - 这次 program-owned 走的是哪种候选 transport
  - 当前 UI 正处于哪种生成态

验证：

- `cargo check --manifest-path gateway/Cargo.toml`
  - 通过
- `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
  - `2 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `20 passed`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
  - `5 passed`
- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
  - 通过
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
  - 通过

当前结论：

- `gemini web reverse`
  - `tts` owner 继续前移，但 active pure-HTTP helper 还未全部迁完
- `gemini canvas program-owned`
  - `invoke contract` 已进一步从“最小 prompt contract”前移到“transport kind candidate + uiState”
  - 但真实 app target 仍未稳定暴露
  - 所以总目标仍未完成，下一轮仍要继续追真正 target / action / transport 的显式暴露点

---

## 第一百三十七轮结果：`music` focused probe 已抓到真实 target，runtime material 也已带上 target 候选

本轮主改动：

1. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - `collectSnapshot(...)` 现在额外采：
     - `mediaNodes`
     - `anchor.download`
   - focused probe 的 network capture 现在显式维护：
     - `audioUrls`
     - `videoUrls`
   - `canvasProgramInvokeContract` 在 `player-ready` 时不再只看 transport hint，而是会综合排序：
     - `network_video_response / network_audio_response`
     - `anchor download href`
     - `media node currentSrc/src`
     - `blob:` target
   - 新增 `targetSource / targetMimeType / targetCandidates`
   - `music` 在 `选择要混合制作的曲目` 页面会先自动点一个 style card，再继续走 prompt/生成
   - `player-ready` 但还没有 target 时，会主动补一次 `play` 和 `download` 探测
2. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `bootstrap_program` 同步继承了上面的 target 聚合逻辑
   - `collectProgramHandleSnapshot(...)` 现在也带：
     - `mediaNodes`
     - `anchor.download`
   - `runBootstrapProgramOperation(...)` 的 `music` 在 style-picker 态也会先自动点选一个 style card
   - `player-ready` 后若仍无 target，也会补一次 `play/download` 探测再刷新 contract
3. `gateway/src/upstream/gemini/web_reverse/direct_http_tts.rs`
   - `web_reverse` 的 direct-http TTS owner 继续前移
   - 当前 `resolve_direct_http_tts_audio_response(...)` 已承接：
     - export body 直接抽音频
     - 四段 body 中找 audio URL
     - owner 模块自己完成 audio fetch 与 MIME 选择
   - `client.rs` 当前已经消费该 owner helper

focused 证据：

- focused probe 新归档：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T03-59-33-847Z/program-handle.json`
- 这次真实结果里：
  - `finalUrl = https://gemini.google.com/app/b4e5d643f3f66d60`
  - `canvasProgramInvokeContract.operation = music`
  - `transportKind = official_music_ws_candidate`
  - `uiState = music_player_ready`
  - `target = https://contribution.usercontent.google.com/download?...filename=nine-six_cipher.mp4...`
  - `targetSource = network_video_response`
  - `targetMimeType = video/mp4`
  - `targetCandidates[0]` 已经稳定落出同一条真实下载 URL
- materialized runtime 新归档：
  - `.runtime/gemini-canvas-program-runtime/fe24c455a570-20260508-120136/browser-state.json`
- 该 runtime 当前已显式带上：
  - `canvasProgramInvokeContract.target`
  - `canvasProgramInvokeContract.targetSource`
  - `canvasProgramInvokeContract.targetMimeType`
  - `canvasProgramInvokeContract.targetCandidates`

这说明：

- `program-owned music` 当前已经不再只是：
  - `candidate transportKind`
  - `uiState`
- focused probe 现在已经能从真实页面执行态里把最终媒体下载 URL 抓回 contract
- 这份 target 候选也已经进入 materialized runtime，不再只停在一次性 probe 输出

验证：

- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
  - 通过
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
  - 通过
- focused probe：
  - `GEMINI_CANVAS_PROGRAM_HANDLE_OPERATION=music`
  - 成功产出带 target 的 `program-handle.json`
- `powershell -ExecutionPolicy Bypass -File deploy/materialize-gemini-canvas-program-runtime.ps1 -ProgramHandlePath '.runtime/gemini-canvas-program-handle-probe/2026-05-08T03-59-33-847Z/program-handle.json'`
  - 成功产出新的 runtime material
- `cargo check --manifest-path gateway/Cargo.toml`
  - 通过
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `20 passed`

当前结论：

- `gemini web reverse`
  - `tts` owner 继续前移，direct-http TTS 的 owner 化又收了一段
  - 但是否算“全部结构债清零”仍需继续看剩余 shared helper
- `gemini canvas program-owned`
  - `music` focused probe 已经抓到真实 target，并成功写入 runtime material
  - 这说明“真实 app target 无法显式暴露”的剩余问题已经不再覆盖 `music`
  - 下一轮重点应继续把同一类 target 捕获能力推进到：
    - `video`
    - 以及真正的 program-owned live invoke 闭环，而不是只停在 focused bootstrap/probe

---

## 第一百三十九轮结果：先冻结 `gemini_web_reverse` 独立实现线，三套 fresh live 全绿

本轮目标按新的边界重新收口：

- 暂停继续推进 `gemini canvas web reverse`
- 只验证并冻结 `gemini_web_reverse` 这一条独立实现线
- 不再把 `web reverse` 与 `canvas web reverse` 的 live / key / failure 面混在一起

本轮实际完成：

1. 重新执行 `gemini_web_reverse` 最小编译与定向测试：
   - `cargo check --manifest-path gateway/Cargo.toml`
   - `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::web_reverse -- --nocapture`
   - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse -- --nocapture`
   - `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::web_reverse::legacy_mixed_lane -- --nocapture`
   - `cargo test --manifest-path gateway/Cargo.toml direct_http_tts -- --nocapture`
2. 重新跑三套 `gemini_web_reverse` fresh live：
   - `gemini_web_reverse_modular_full_live`
   - `gemini_web_reverse_modular_legacy_tts_live`
   - `gemini_web_reverse_modular_legacy_media_live`
3. 确认 `legacy_media_live` 首次失败并不是实现回退，而是测试 access key 选错：
   - 首次误用了只覆盖 text/tts 的 key
   - 回包统一是 `access_candidates_exhausted`
   - 换成覆盖 `gemini-2.5-flash-image-preview / gemini-canvas-music-preview / gemini-canvas-video-preview` 的平台测试 key 后，重新 fresh rerun 恢复全绿

本轮 fresh live 证据：

- `gemini_web_reverse_modular_full_live`
  - `output/gemini_web_reverse_modular_full_live-20260508-freeze-v1`
  - `37/37`
- `gemini_web_reverse_modular_legacy_tts_live`
  - `output/gemini_web_reverse_modular_legacy_tts_live-20260508-freeze-v1`
  - `2/2`
- `gemini_web_reverse_modular_legacy_media_live`
  - 首次错误 key 归档：
    - `output/gemini_web_reverse_modular_legacy_media_live-20260508-freeze-v1`
    - 失败根因：`access_candidates_exhausted`
  - 正确 key rerun 归档：
    - `output/gemini_web_reverse_modular_legacy_media_live-20260508-freeze-v2`
    - `6/6`

当前结论：

- `gemini_web_reverse` 当前这条独立实现线已经重新完成：
  - 最小编译
  - 协议层测试
  - upstream 层测试
  - 三套 fresh live
- 本轮冻结的重点不是继续扩展 owner 清理，而是先把 `gemini_web_reverse` 的 caller-visible 能力和独立验收彻底打实
- 下一阶段再继续处理 `client.rs` 里的跨 surface owner 清债，以及 `gemini canvas web reverse`

---

## 第一百三十八轮结果：`video` focused probe 也已抓到真实 target，`music/video` 两条模态都能落盘 runtime material

本轮主动作：

1. 继续用最新脚本逻辑跑 `video` focused probe：
   - `GEMINI_CANVAS_PROGRAM_HANDLE_OPERATION=video`
   - `GEMINI_CANVAS_PROBE_TIMEOUT_MS=240000`
2. 将新的 `video` handle 再次 materialize 成 runtime
3. 补跑 `web_reverse direct_http_tts` 自己的 owner 测试

focused 证据：

- `video` focused probe：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T04-12-44-692Z/program-handle.json`
- 该次结果已经显式落出：
  - `canvasProgramInvokeContract.operation = video`
  - `transportKind = official_video_http_candidate`
  - `uiState = video_player_ready`
  - `target = https://contribution.usercontent.google.com/download?...filename=video.mp4...`
  - `targetSource = media_node_current_src`
  - `targetMimeType = video/mp4`
- 对应 runtime material：
  - `.runtime/gemini-canvas-program-runtime/fe24c455a570-20260508-121443/browser-state.json`
  - 同样已包含上述 `video` target contract

这说明：

- `music` 与 `video` 这两条 `program-owned` media 模态，当前 focused bootstrap/probe 都已经能：
  - 走到 `player-ready`
  - 抓到真实 target
  - 把 target 写进 materialized runtime
- 剩余工作已不再是“target 无法显式暴露”，而是：
  - 如何把这套 target contract 继续推进到真正的 program-owned live invoke / full suite 闭环

验证：

- `cargo test --manifest-path gateway/Cargo.toml direct_http_tts -- --nocapture`
  - `3 passed`
- `powershell -ExecutionPolicy Bypass -File deploy/materialize-gemini-canvas-program-runtime.ps1 -ProgramHandlePath '.runtime/gemini-canvas-program-handle-probe/2026-05-08T04-12-44-692Z/program-handle.json'`
  - 成功产出新的 `video` runtime material

当前结论：

- `gemini web reverse`
  - `direct_http_tts` owner 侧 URL/MIME/resolve 逻辑已有独立测试通过
- `gemini canvas program-owned`
  - `music/video` focused target capture 当前都已成立
  - 这轮后真正剩余的主任务，已经收缩到“把 focused contract 变成 full runtime invoke 闭环”，而不是继续追 target 本身

---

## 第一百三十九轮结果：`canvas program-owned` 的 live/bootstrap 已前移到 materialized runtime 优先

本轮主动作：

1. `deploy/test-gateway-protocol-matrix.py`
   - `extract_gemini_canvas_program_live_state(...)` 现在优先读取：
     - `.runtime/gemini-canvas-program-runtime/*/browser-state.json`
     - 若缺失，再回退到 `.runtime/gemini-canvas-program-handle-probe/*/program-handle.json`
   - 并把 concrete handle / invoke contract 字段直接并入 live state：
     - `canvasProgramUrl`
     - `pageUrl`
     - `appPath`
     - `conversationId`
     - `responseId`
     - `invokeBaseUrl`
     - `musicWsUrl`
     - `videoInvokePath`
     - `canvasProgramAction`
     - `canvasProgramActionInput`
     - `canvasProgramInvokeContract`
2. `ensure_gemini_canvas_program_live_provider(...)`
   - provider `payload.extraBody` 不再只写 `shareId + pureHttpMode`
   - 现在还会显式注入：
     - concrete handle
     - transport hints
     - `canvasProgramInvokeContract`
     - `enforceProgramOwner = true`
     - `requireAppPage = true`
3. `deploy/probe-gemini-canvas-program.ps1`
   - 默认执行链改成 **handle probe 优先**
   - bootstrap probe 退回显式 `-BootstrapOnly`

当前意义：

- `canvas program-owned` live suite 的 bootstrap 输入，已经从“浏览器态 + share seed”前移到“优先吃已 materialize 的程序句柄与 invoke contract”
- 这一步还不等于 true app invoke 已经完全闭环
- 但它已经让后续 Rust `program-owned app-endpoint lane` 不再只能对着空 contract 做 generic fallback

---

## 第一百四十轮结果：program-owned bootstrap 明确切成 discovery-only，浏览器不再在页面里真正生成 video/music

本轮主动作：

1. `gateway/src/upstream/gemini/canvas_program_web_reverse/bootstrap.rs`
   - `build_program_bootstrap_invocation_input_from_config(...)` 现在显式写入：
     - `discoveryOnly = true`
   - 语义固定为：
     - 浏览器 bootstrap 只负责建 program / 切 mode / 抓 contract
     - 不再允许把页面媒体生成当成 steady-state invoke
2. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - handle probe 默认进入 `discoveryOnly`
   - 当前默认不再：
     - `submitPrompt(...)`
     - `trySelectMusicStyleCard(...)`
     - `clickMediaActionButton(..., "play")`
     - `clickMediaActionButton(..., "download")`
   - focused 结果现在会显式落出：
     - `discoveryOnly = true`
3. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `runBootstrapProgramOperation(...)` 同步改成默认 `discoveryOnly`
   - `bootstrap_program` 不再通过页面里的 `music/video` 真实生成来换取 target
4. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - `preferred_app_endpoint_invoke_contract(...)` 对 `music/video` 不再因为“缺少 app target”而自动兜回 generic official target
   - `music` 现在必须有：
     - protocol contract target
     - 或显式 `musicWsUrl`
   - `video` 现在必须有：
     - protocol contract target
     - 或显式 `videoInvokePath / invokeBaseUrl`
5. `gateway/src/upstream/client.rs`
   - `execute_gemini_canvas_program_app_endpoint_media_direct_http_with_context(...)` 现在在缺 target 时直接返回：
     - `gemini_canvas_program_music_invoke_target_missing`
     - `gemini_canvas_program_video_invoke_target_missing`
   - `execute_gemini_canvas_media_direct_http(...)` 对 `gemini_canvas_program_web_reverse_compatible` 不再在 app-endpoint lane 失败后偷偷回退 `StreamGenerate` generic lane

focused 证据：

- 新的 `video` handle probe：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T09-25-48-174Z/program-handle.json`
- 该次结果已明确显示：
  - `discoveryOnly = true`
  - `modeSelected = true`
  - `canvasProgramInvokeContract.target = null`
  - `canvasProgramInvokeContract.transportKind = null`
  - `canvasProgramInvokeContract.uiState = null`
  - 页面停在：
    - `slime，快来挑选一个模板，开始制作你的视频吧`
  - 没有进入：
    - `player_ready`
    - `download target`
    - 页面侧真实视频生成
- 同批归档里的网络仍然只看到：
  - `source-path=/share/...`
  - `source-path=/canvas`
  - 以及 `qpEbW / aPya6c / MaZiqc / ESY5D / ujx1Bf / StreamGenerate`
  - 说明这次浏览器只是在做 program bootstrap / mode discovery，而不是帮 Rust 走最终生成链

验证：

- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
  - 通过
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
  - 通过
- `CARGO_TARGET_DIR=.gcv3 cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `23 passed`

当前结论：

- 这轮之后，`canvas program-owned` 至少已经不再把“网页里真实生成 video/music”误包装成 bootstrap 真相
- 浏览器现在重新被压回：
  - `discovery-only`
  - `debug-only`
  - `runtime material source`
- 但 true app invoke 还没有全部完成：
  - 当前我们已经阻止了错误的 generic official fallback
  - 下一轮必须继续围绕 `canvasProgramInvokeContract` 找到真正可执行的 `music/video` app target，而不是再回网页聊天或 generic `predictLongRunning`

---

## 第一百四十一轮结果：program-owned invoke contract 开始显式承载 websocket 候选，不再只把 batchexecute candidate 当主语义

本轮主动作：

1. `gateway/src/protocol/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - `GeminiCanvasProgramInvokeContract` 新增：
     - `wsUrl`
     - `apiStyle`
     - `requestPath`
     - `requestEnvelopeKind`
   - 语义是把“程序自身暴露的 websocket/API 候选合同”提升成一等字段
2. `gateway/src/protocol/gemini/canvas_program_web_reverse/relay_config.rs`
   - `relay_config_from_payload(...)` 现在会把上述 websocket 候选字段从 runtime material / `canvasProgramInvokeContract` 读回 Rust
3. `gateway/src/upstream/gemini/canvas_program_web_reverse/app_endpoint.rs`
   - `GeminiCanvasProgramAppInvokeContract` 同步显式承载：
     - `ws_url`
     - `api_style`
     - `request_path`
     - `request_envelope_kind`
   - `preferred_app_endpoint_invoke_contract(...)` 现在会优先保留这批 websocket contract 字段，而不是只剩 `requestUrl/requestBody`
4. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - focused probe 现在会从 Canvas 程序 HTML/JS 证据里识别：
     - `Browser API Proxy Client`
     - `Routing Google API requests via WebSocket`
     - `DEFAULT_ENDPOINT`
     - `targetDomain = generativelanguage.googleapis.com`
   - 命中后会把 invoke contract 收口成：
     - `transportKind = canvas_program_ws_candidate`
     - `wsUrl`
     - `apiStyle = google_generative_language`
     - `requestEnvelopeKind = canvas_proxy_request`
5. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - browser pool 侧同样开始把这组 websocket 候选字段写回 `canvasProgramInvokeContract`

这轮的真实收口点不是“已经接上 ws steady-state executor”，而是：

- `canvas program-owned` 不再只把：
  - `batchexecute requestUrl/requestBody`
  - `player_ready target`
  当成后半段唯一可表达的 contract
- 现在已经能把 Canvas app 自己暴露出来的：
  - `websocket endpoint`
  - `Google API style`
  - `proxy_request envelope`
  收成 runtime material 的显式字段

验证：

- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
- `cargo check --manifest-path gateway/Cargo.toml`
- `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`

当前结论：

- 这轮之后，`canvas program-owned` 的 contract 真相已经从“页面 RPC 候选”前移到“websocket 候选 + API-style 候选”
- 但还没有完成最后一步：
  - Rust steady-state executor 仍需真正消费这批 websocket contract 字段
  - 目前只是把合同显式收口并落盘，不等于已经完全打通执行主链

---

## 第一百四十二轮结果：纠正 focused probe 的错误 surface，discovery-only 不再切回 generic `/app` 对话流

本轮主动作：

1. `gateway/scripts/probe-gemini-canvas-program-handle.mjs`
   - `handlePairs` 现在会显式标注：
     - `sourceSurface = canvas_proxy_client`
     - `sourceWsUrl`
     - `sourceTargetDomain`
   - canonical pair 选择顺序改成：
     - 优先 `share` 直接产出的 `Browser API Proxy Client` app
     - 其次其他 `canvas_proxy_client` pair
     - 最后才退回普通 share/chat pair
   - `discoveryOnly` 模式下，一旦已经命中 `canvas_program_ws_candidate` 或 `canvas_proxy_client` pair：
     - 不再执行 `clickNewChat(...)`
     - 不再执行 `clickOperationMode(...)`
     - 不再把当前页面切回 generic Gemini `/app` 对话壳层
   - `discoveryOnly` 且还没拿到 concrete handle 时，也不再主动跳到 generic `/app`
2. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - browser pool bootstrap 同步引入同样的 pair 标注与 canonical 选择逻辑
   - `runBootstrapProgramOperation(...)` 在 `discoveryOnly` 下也不再：
     - `ensureAppPage(...)` 跳 generic `/app`
     - `clickNewChat(...)`
     - `clickOperationMode(...)`
   - 语义统一成：
     - 只保留 `share -> canvas/app discovery -> websocket contract harvest`
3. `docs/20-ai-gateway/服务商实现线与Provider目录.md`
   - 补充 canonical 规则：
     - 一旦命中 share-sourced `Browser API Proxy Client` app
     - focused discovery 成功标准就是：
       - `concrete program handle`
       - `websocket candidate contract`
     - 不再把 generic `/app` 的 `new chat / mode` 工作流误判成 program-owned 真相

focused 证据：

- 新的 `video` discovery probe：
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T10-36-36-886Z/program-handle.json`
  - `.runtime/gemini-canvas-program-handle-probe/2026-05-08T10-36-36-886Z/summary.json`
- 结果已经前移为：
  - `newChatClicked = false`
  - `modeSelected = false`
  - `beforeUrl = https://gemini.google.com/canvas`
  - `finalUrl = https://gemini.google.com/canvas`
  - `stableProgramPair.appPath = /app/4abc4e7577b6149f`
  - `stableProgramPair.sourceSurface = canvas_proxy_client`
  - `stableProgramPair.sourceRpc = ujx1Bf`
  - `canvasProgramInvokeContract.transportKind = canvas_program_ws_candidate`
  - `canvasProgramInvokeContract.wsUrl = ws://127.0.0.1:9998`
- 这说明 focused discovery 已经不再通过 generic `/app` 聊天/模式切换来“伪推进” program-owned
- 同时 `latestResponsePair` 仍然可能继续出现一个后续复制出来的 proxy app，但 canonical handle 已固定优先保留 share 直接产出的那一个

验证：

- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
- focused probe：
  - `$env:GEMINI_CANVAS_PROGRAM_HANDLE_OPERATION='video'`
  - `$env:GEMINI_CANVAS_PROGRAM_HANDLE_DISCOVERY_ONLY='true'`
  - `node gateway/scripts/probe-gemini-canvas-program-handle.mjs`

当前结论：

- 这轮修掉的不是小字段，而是 `program-owned` focused discovery 的主 surface 错位
- 浏览器现在终于回到正确角色：
  - 建 program
  - 识别 share 产出的 `Browser API Proxy Client` app
  - 抓 websocket candidate contract
  - 停止
- 下一轮才应该继续推进真正的 `Canvas app websocket invoke`，而不是再围着 generic `/app` 页面工作流打转

---

## 第一百四十三轮结果：`canvas_proxy` 缺失 connected client 时改为 fail-closed，program-owned websocket 主线再次 fresh 复验全绿

本轮主动作：

1. `gateway/scripts/gemini-canvas-browser-pool.mjs`
   - `runFetchOperation(...)` 在 `googleFetchMode = canvas_proxy` 时不再允许：
     - loopback connected client bootstrap 失败后继续退回普通 fetch
     - 没有任何 authenticated connected client 时继续走 generic 页面/直连 fetch
   - 现在语义改成：
     - 若 `canvas_proxy` 已被选中，就必须存在可用的 Canvas app websocket connected client
     - 否则直接 fail-closed，返回：
       - `gemini_canvas_program_ws_bootstrap_failed`
       - 或 `gemini_canvas_program_ws_client_unavailable`
2. `docs/20-ai-gateway/服务商实现线与Provider目录.md`
   - 当前 `Gemini Canvas` 的正式主叙事进一步收紧为：
     - `canvas_web_reverse / program-owned / canvas app websocket contract owner`
   - `official API identity` 的说明也同步改成：
     - 用于 `Canvas app websocket / connected client` 后半段发送正规 Gemini API 形状请求
     - 不再把 `connected fetch` 文案误读成 generic browser-owned 兜底线

验证：

- `node --check gateway/scripts/gemini-canvas-browser-pool.mjs`
- `node --check gateway/scripts/probe-gemini-canvas-program-handle.mjs`
- fresh live：
  - `python deploy/test-gateway-protocol-matrix.py --run --suite gemini_canvas_program_text_live --output-dir output/gemini_canvas_program_text_live-20260508-ownerize-v3`
  - `python deploy/test-gateway-protocol-matrix.py --run --suite gemini_canvas_program_media_live --output-dir output/gemini_canvas_program_media_live-20260508-ownerize-v3`
  - `python deploy/test-gateway-protocol-matrix.py --run --suite gemini_canvas_program_tts_live --output-dir output/gemini_canvas_program_tts_live-20260508-ownerize-v3`

结果：

- `gemini_canvas_program_text_live`：
  - `5/5`
- `gemini_canvas_program_media_live`：
  - `5/5`
- `gemini_canvas_program_tts_live`：
  - `2/2`

当前结论：

- `program-owned` 这条线现在已经不再允许“先宣称 websocket owner，再在 client 不可用时偷偷退回普通 fetch”
- 当前 caller-visible green 依旧成立，但这条 green 的真实含义更严格了：
  - 成功必须来自 materialized Canvas program runtime
  - 并通过 `canvas app websocket / connected client` 主链完成
  - 不能再靠 generic fetch/browser-owned 兜底伪绿

---

## 第一百四十四轮结果：`share -> canvas app` 创建流程已拿到纯 HTTP 证据

本轮目标只盯一个更小的问题：

- `Gemini Canvas program-owned` 的第一步，也就是：
  - `share -> concrete canvas app handle`
- 这一步能否像 `gemini web reverse` 的 bootstrap 一样，先独立做成纯 HTTP

本轮新增：

1. `gateway/scripts/probe-gemini-canvas-program-create-pure-http.mjs`
   - 新增一个独立 focused probe，不调用 browser pool
   - 只做：
     - `GET /share/<shareId>` 取 bootstrap
     - `POST rpcids=ujx1Bf` 到 `/_/BardChatUi/data/batchexecute`
     - 解析 `conversationId / responseId`
     - 若回包里未直接带 `/app/<id>`，则按当前仓库既有规则从 `conversationId` 归一出：
       - `appPath`
       - `programUrl`
   - 当前 request 形状固定为：
     - `source-path = /share/<shareId>`
     - `f.req = [[["ujx1Bf","[null,\"<shareId>\",[4]]",null,"generic"]]]`
   - 这一步只证明：
     - `share -> canvas app handle` 可 HTTP 化
   - 不证明：
     - 后续 websocket 执行链已经 browserless

验证：

- `node --check gateway/scripts/probe-gemini-canvas-program-create-pure-http.mjs`
- `node gateway/scripts/probe-gemini-canvas-program-create-pure-http.mjs --outDir output/gemini_canvas_program_create_pure_http_20260508_v2`

focused 证据：

- `output/gemini_canvas_program_create_pure_http_20260508_v2/summary.json`
  - `status = 200`
  - `handle.conversationId = c_4abc4e7577b6149f`
  - `handle.responseId = r_1d583cfb0fa7aee4`
  - `handle.appPath = /app/4abc4e7577b6149f`
  - `handle.programUrl = https://gemini.google.com/app/4abc4e7577b6149f`
  - `handle.sourceSurface = canvas_proxy_client`

当前结论：

- `Gemini Canvas` 的“创建 canvas app”这一步，当前已经拿到纯 HTTP 证据
- 当前最近成功样本说明：
  - 不需要 browser pool
  - 不需要页面点击
  - 只要有效 session/cookie + share page bootstrap + `ujx1Bf` 请求体，就能拿到 concrete app handle
- 下一轮才应该继续追：
  - 这份 handle 之后的 websocket contract 是否也能进一步脱离浏览器
  - 但现在不能把“创建已 HTTP 化”误说成“整条 `canvas app websocket` 已 browserless”

---

## 第一百四十五轮结果：Rust bootstrap 主链已先接入 pure HTTP create

本轮只继续完成上一轮结论里的“第一条”：

- 不扩 websocket 后半段
- 不动 `gemini web reverse`
- 只把：
  - `share -> ujx1Bf -> concrete canvas app handle`
  这条纯 HTTP create 合同真正接进 Rust `canvas_program_web_reverse` 主链

本轮代码：

1. `gateway/src/upstream/gemini/canvas_program_web_reverse/bootstrap.rs`
   - 新增：
     - `GEMINI_CANVAS_PROGRAM_CREATE_RPCID = "ujx1Bf"`
     - `build_program_create_pure_http_request(...)`
     - `current_program_create_reqid()`
     - `runtime_patch_from_pure_http_create_response(...)`
   - 当前 Rust 侧已能直接构造：
     - `rpcids=ujx1Bf`
     - `source-path=/share/<shareId>`
     - `f.req=[[[\"ujx1Bf\",\"[null,\\\"<shareId>\\\",[4]]\",null,\"generic\"]]]`
   - 并把回包解析成：
     - `canvasProgramUrl`
     - `appPath`
     - `conversationId`
     - `responseId`
     - `stableProgramPair / latestResponsePair / candidatePairs / aggregateHints`

2. `gateway/src/upstream/client.rs`
   - `ensure_gemini_canvas_program_payload_handle(...)` 现在的顺序改成：
     - 若当前还没有 concrete handle：
       - 先走 pure HTTP create
     - 若 pure HTTP create 失败：
       - 只把它当作“没拿到 handle”，再回退到浏览器 discovery
   - 这意味着：
     - 第一步 `share -> app` 不再只能依赖 browser pool
   - 同时修正了旧的抵消行为：
     - pure HTTP create 成功拿到 handle 后，不再立刻把 handle hints 全部 strip 掉
     - 避免后续 discovery 又退回 generic 页面语义

3. `gateway/src/upstream/gemini/canvas_program_web_reverse/tests.rs`
   - 新增定向测试覆盖：
     - `build_program_create_pure_http_request_matches_captured_ujx1bf_shape`
     - `runtime_patch_from_pure_http_create_response_extracts_canvas_handle`
     - `runtime_patch_from_pure_http_create_response_derives_app_path_from_conversation_only`

验证：

- `cargo test --manifest-path gateway/Cargo.toml upstream::gemini::canvas_program_web_reverse -- --nocapture`
  - `29 passed`
- `cargo test --manifest-path gateway/Cargo.toml protocol::gemini::canvas_program_web_reverse -- --nocapture`
  - `2 passed`

当前结论：

- “创建 canvas app”这一步已经不是单独脚本 proof-of-concept
- 它现在已经正式进入 Rust `canvas_program_web_reverse` bootstrap 主链
- 当前主链语义变成：
  - 先 pure HTTP create 拿 concrete handle
  - 再决定是否继续走浏览器 discovery 补后续 websocket contract
- 这仍然只证明：
  - 第一段 `share -> app` 可 HTTP 化
- 还不证明：
  - 后半段 websocket invoke 已 browserless

## 第一百四十八轮结果：`program-owned / no-key / music` 已 caller-visible 打绿，主阻塞从 contract 模糊失败收缩到 TTS

这轮只继续推进 `gemini canvas web reverse / program-owned / no-key`，没有改动 `gemini web reverse` 行为线。

### 1. `music` 主线的真正收口

本轮真正起作用的点有四个：

1. `cookieHeader` 现在会从最新 `program-handle.json` / runtime material 一路保真到 provider payload 与 Rust 执行层。
2. `program-owned music StreamGenerate` 现在补上了 `xsrf -> at=` 的纯 HTTP 自愈重放。
3. `program-owned runtime api context` 不再把空 `payload.base_url` 继续带进 page/app origin；当前会回落到 `https://gemini.google.com` / app page。
4. `music` 的 direct asset fetch 现在显式拒收：
   - `accounts.google.com/ServiceLogin`
   - `accounts.google.com/CookieMismatch`
   - 以及 `text/html` 假音频页面

对应代码主要落在：

- `gateway/src/protocol/gemini_canvas.rs`
- `gateway/src/upstream/client.rs`
- `deploy/test-gateway-protocol-matrix.py`

### 2. 当前 live 证据

这轮 fresh live 已经把 `program-owned / no-key / music` 打回 caller-visible 通过：

- output/gemini_canvas_program_media_live-music-20260511-v52/summary.md（本地验收归档）
  - `music.basic = pass`
- output/gemini_canvas_program_media_live-20260511-v27b/summary.md（本地验收归档）
  - `gemini_canvas_program_media_live = 5/5`

同时，当前日志已经明确证明：

- `music` 的 first-hop 不再卡在 `1060`
- 当前 `StreamGenerate` 会进入：
  - `wrb.fr`
  - `18 / 21`
  - `music_gen`
  - `audio/mpeg`
  - `.mp3`

而且媒体下载阶段已经不再把 `CookieMismatch` HTML 误判成最终音频资产。

### 3. `video` 当前正式语义

`video` 本轮没有回退，仍然保持：

- app-scoped `StreamGenerate`
- no-key
- pure HTTP
- caller-visible `accepted/pending`

为了让 current live 结果和 owner 真相一致，`gemini_canvas_program_media_live.video.basic` 的验收已经改成接受：

- `"object":"video.generation"`
- `"provider":"gemini_canvas"`
- `"accepted":true`

因此当前 `program-owned media live` 已经重新全绿。

### 4. 当前剩余 blocker

还没有收口完成的是：

- `gemini_canvas_program_tts_live`

当前 fresh 结果：

- output/gemini_canvas_program_tts_live-20260511-v29/summary.md（本地验收归档）
  - 仍然是 `1/2`

而且这条线的失败面已经前移成：

- 不再是 browser relay/page submit
- 当前 program-owned TTS 已改成优先走 pure HTTP
- 但 live 仍然卡在：
  - `302`
  - `{"error":{"code":null,"message":"","type":"Unknown"}}`

也就是说，这轮之后最准确的状态是：

- `create`：已 HTTP 化
- `media`：`5/5`，其中 `music` 已重新打绿，`video` 以 accepted/pending 语义通过
- `tts`：仍未完成
- `text`：本轮没有 fresh 完整重跑结论
