# 根目录 .js 与 src/ TypeScript 说明

## 当前状态

- **发布与运行**：实际生效的是**根目录的 JavaScript**（`index.js`、`cli.js`、`feishu-turn.js` 等）。`npm run build:dist` 会把它们复制到 `dist/`，`package.json` 的 `main` 指向 `dist/index.js`，发布到 npm 的也是这套。
- **TypeScript**：`src/` 下有一套 TS 实现（`index.ts`、`platforms/feishu.ts`、`queue.ts`、`types.ts`），架构与根目录 JS 不同（queue + adapter 模式）。`npm run build`（tsc）会编译到 `dist/`，但 **prepublishOnly 只执行 build:dist（复制根目录 JS）**，不跑 tsc，所以**发布产物不包含 src 的编译结果**。

因此会出现「项目里用了 TS，但根目录还有很多 .js」：**根目录 .js 才是当前主实现**，src/ 的 TS 是另一套实现，未接进发布流程。

## 根目录 .js 有哪些、能否删

| 文件 | 用途 | 能否删 |
|------|------|--------|
| `index.js` | 主入口，notify/send/getConfig/runConnectMode，被 dist 和 require 使用 | **不可删**，删则发布与运行都会断 |
| `cli.js` | 统一 CLI，复制到 dist，bin 指向 dist/cli.js | **不可删** |
| `feishu-turn.js` | 单轮发+等回复，已由 cli 统一；仍被 copy-to-dist 复制以兼容旧引用 | 可选：若不再兼容旧 `node dist/feishu-turn.js`，可删并从 copy-to-dist 移除 |
| `session-bridge.js` | 会话切换（切到飞书/切回），被 example 与 test 引用 | **不可删**（除非移除 Session Bridge 能力） |
| `feishu-conversation.js` | 纯飞书端对话（npm run conversation） | **不可删**（功能脚本） |
| `index-async.js` / `index-polling.js` | 备选实现，被 example-async / example-polling 引用 | 可归档到 `examples/` 或删：若删需同时删或改对应 example |
| `ai-wrapper.js` | 被 example-ai-wrapper 引用 | 示例用，可随 example 移入 examples/ 或保留 |
| `test.js`、`test-quick.js`、`test-complete.js`、`test-session-bridge.js` | 正式测试 | **不可删** |
| `example-*.js` | 示例 | 可移入 `examples/` 目录，非删除 |

**结论**：不能为「用 TS」而简单删掉根目录核心 .js（index、cli、session-bridge、feishu-conversation），否则发布和运行都会失效。可清理的是：feishu-turn 若不再兼容可去掉、index-async/index-polling 可归档或删并调整 example。

## 若要以 TypeScript 为主（迁移方向）

1. **把根目录逻辑迁回 src**：将 `index.js` 的 config 读取、getConfig、runConnectMode、notify、send 等迁到 `src/index.ts`（或拆成 platforms/feishu 等），与现有 src 的 queue/adapter 设计二选一或合并。
2. **CLI**：`cli.js` 改为 `src/cli.ts`，编译到 `dist/cli.js`，bin 继续指向 `dist/cli.js`。
3. **构建与发布**：`prepublishOnly` 改为先 `tsc` 再按需 `copy-to-dist`（仅复制非 tsc 产物的文件，如 feishu-turn 若保留）。
4. **根目录**：迁移完成后，根目录只保留测试、示例、脚本和配置文件，主逻辑仅在 src/ + dist/。

当前未做上述迁移前，**保留根目录 .js 是必须的**；src/ 的 TS 可视为实验或备选实现，仅在本地 `npm run build` 时产出，不参与发布。
