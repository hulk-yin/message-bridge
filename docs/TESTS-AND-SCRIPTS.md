# 测试与脚本说明

## 正式测试（保留）

| 文件 | 说明 | 命令 |
|------|------|------|
| `test.js` | 主测试：校验配置（环境变量或 ~/.message-bridge/config.json）、获取 token、可选发送到群聊 | `npm test` |
| `test-quick.js` | 快速测试：调用 `notify()` 发一条并等回复（默认 60 秒超时） | `node test-quick.js` |
| `test-complete.js` | 完整功能：依次测试 notify 与 send | `node test-complete.js` |
| `test-session-bridge.js` | Session Bridge：模拟「切到飞书」与状态 | `node test-session-bridge.js` |

以上均需有效飞书配置（环境变量或 config 文件）；无 chat_id 时 test.js 仅校验凭证。

## 已删除（临时/调试，不再保留）

- `test-sdk.js` - 手写 SDK 测试，与 index.js 能力重复
- `test-websocket.js` - 手写 WebSocket 测试，与主实现重复
- `test-ws-debug.js` - WebSocket 调试用
- `test-ws-final.js` / `test-ws-full.js` - 开发过程版本

## 示例（参考用，不参与发布主流程）

| 文件 | 说明 |
|------|------|
| `example-claude-code.js` | Claude Code 中 Session Bridge 对话切换演示 |
| `example-ai-wrapper.js` | ai-wrapper 确认式执行示例 |
| `example-async.js` | 使用 index-async.js 的异步非阻塞示例 |
| `example-polling.js` | 使用 index-polling.js 的轮询示例 |

## 其他脚本

| 文件 | 说明 |
|------|------|
| `index.js` | 主入口（同步 notify/send + 长连接） |
| `index-async.js` / `index-polling.js` | 备选实现（异步/轮询），被上述 example 引用 |
| `feishu-conversation.js` | 纯飞书端对话（不经过 Cursor），`npm run conversation` |
| `feishu-turn.js` | 单轮发+等回复，已由 `cli.js` 统一实现；仍复制到 dist 以兼容旧引用 |
| `session-bridge.js` | 会话切换逻辑（切到飞书/切回） |
| `scripts/check-feishu-env.js` | 环境变量自检（CLI 已内联 check-env，此脚本可单独运行） |
| `scripts/copy-to-dist.js` | 构建时复制 index/cli/feishu-turn 到 dist |
