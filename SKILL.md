# MessageBridge Skill

AI 智能体的消息桥梁，连接飞书/钉钉/企微，实现异步通知与确认。

**实现位置**：本仓库根目录即为 skill 实现目录。安装到 Cursor/Codex/Claude 等后，所有命令（如 `npm run turn`、`node dist/feishu-turn.js`）均在**该 skill 目录**下执行，不依赖绝对路径。安装方式见 [INSTALL.md](./INSTALL.md)。

## 功能

- ✅ 发送消息到飞书群聊
- ✅ 发送消息并等待用户回复
- ✅ WebSocket 长链接实时接收
- ✅ 超时处理
- ✅ 任务队列管理

## 使用方式

### 1. 环境变量配置（本 skill 无其他外部依赖）

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
export FEISHU_CHAT_ID="oc_xxx"
```

（也支持 `DITING_FEISHU_*` 命名，便于与使用 Diting 的项目共用同一套配置。）

### 2. 在 Node.js 中使用

```javascript
const messageBridge = require("./index.js");

// 发送消息并等待回复
const result = await messageBridge.notify({
  message: "需要你确认一下这个操作",
  timeout: 60, // 60秒超时
});

if (result.status === "replied") {
  console.log("用户回复:", result.reply);
  console.log("回复用户:", result.replyUser);
} else if (result.status === "timeout") {
  console.log("超时未回复");
}

// 仅发送消息（不等待回复）
await messageBridge.send({
  message: "任务已完成！",
});
```

### 3. 在 OpenClaw 中使用

```javascript
// 在其他 AI 智能体中调用
const { notify, send } = require("@skills/message-bridge");

// 发送通知并等待确认
const result = await notify({
  message: "检测到异常，是否继续？",
  timeout: 120,
});

if (result.status === "replied" && result.reply.includes("继续")) {
  // 用户确认继续
  console.log("用户确认，继续执行");
} else {
  // 用户拒绝或超时
  console.log("用户拒绝或超时，停止执行");
}
```

## API

### notify(params)

发送消息并等待用户回复。

**参数：**
- `message` (string, 必需) - 消息内容
- `timeout` (number, 可选) - 超时时间（秒），默认 60
- `platform` (string, 可选) - 平台类型，默认 "feishu"
- `userId` (string, 可选) - 用户 ID
- `groupId` (string, 可选) - 群聊 ID

**返回：**
```javascript
{
  success: true,
  status: "replied" | "timeout" | "error",
  reply: "用户回复内容",
  replyUser: "ou_xxx",
  timestamp: "2026-02-10T09:00:00.000Z"
}
```

### send(params)

仅发送消息，不等待回复。

**参数：**
- `message` (string, 必需) - 消息内容
- `platform` (string, 可选) - 平台类型，默认 "feishu"
- `userId` (string, 可选) - 用户 ID
- `groupId` (string, 可选) - 群聊 ID

**返回：**
```javascript
{
  success: true,
  messageId: "om_xxx"
}
```

## 使用场景

### 1. 审批流程
```javascript
const result = await notify({
  message: "检测到高风险操作，需要审批\n\n操作：删除生产数据库\n请回复「批准」或「拒绝」",
  timeout: 300, // 5分钟
});

if (result.status === "replied" && result.reply === "批准") {
  // 执行操作
}
```

### 2. 异常告警
```javascript
await send({
  message: "⚠️ 服务器 CPU 使用率超过 90%\n\n时间: " + new Date().toISOString(),
});
```

### 3. 任务完成通知
```javascript
await send({
  message: "✅ 数据备份完成\n\n文件数: 1234\n大小: 5.6GB",
});
```

### 4. 交互式确认
```javascript
const result = await notify({
  message: "发现 3 个待处理的问题，是否立即处理？",
  timeout: 60,
});

if (result.status === "replied" && result.reply.includes("是")) {
  // 处理问题
}
```

## 配置要求

### 飞书开放平台配置

1. **创建企业自建应用**
2. **开通权限：**
   - `im:message` - 发送消息
   - `im:message:send_as_bot` - 以机器人身份发送
3. **事件订阅：**
   - 订阅方式：选择「长连接」
   - 订阅事件：`im.message.receive_v1`
4. **发布应用**

## 会话切换到飞书 = 飞书长周期对话闭环

当调用方（如 Cursor AI）收到用户说**「会话切换到飞书」**时，应进入**你与 skill 的长周期对话环境**：非飞书渠道启动 → AI 的输出发到飞书 → 飞书用户回复 → AI 基于回复继续思考 → 结果再发飞书，循环执行；**仅**在用户说「结束」「切回」时退出，不设轮数上限，不主动结束则永远 loop。

**单轮工具**（供 AI 循环调用）：

```bash
npm run turn -- "<AI 的回复内容>" 或 node dist/feishu-turn.js "<AI 的回复内容>"（需先 npm run build:dist）
```

- 把内容发到飞书并等待用户回复。
- 输出单行 JSON：`{"status":"replied","reply":"用户回复", "replyUser":"?"}`；超时为 `"status":"timeout"`。
- 超时秒数：`FEISHU_TURN_TIMEOUT`（秒，默认 3600；飞书回复可能数小时可设 86400）。单轮超时后不要退出闭环，发「等待超时，如需继续请直接回复」并再次等待。

**闭环**：循环执行「AI 生成回复 → 调用 npm run turn 或 node dist/feishu-turn.js → 解析 reply → 再生成 → 再调用」；仅用户说「结束」/「切回」时退出，不设轮数上限，永远 loop。

**为何会自动断掉**：闭环在 Cursor 单次回复里跑，有工具调用/上下文上限，跑一段时间就会结束当次回复。**解决**：要不依赖 Cursor 的持久对话，可运行常驻进程 `node feishu-conversation.js`（配置 AI_REPLY_URL 或 OPENAI_API_KEY），在飞书里一直聊直到你说结束；若继续用 Cursor 闭环，断掉后说「继续飞书」即恢复。

## 可选：纯飞书端对话（feishu-conversation.js）

不经过 Cursor、只在飞书里和机器人对话时，可单独运行：

```bash
node feishu-conversation.js   # 或 npm run conversation
```

需配置 **AI_REPLY_URL** 或 **OPENAI_API_KEY**（+ OPENAI_BASE_URL、OPENAI_MODEL）。飞书需已订阅 `im.message.receive_v1`（长连接）。

## 测试

```bash
# 基础测试
node test.js

# 完整功能测试
node test-complete.js

# WebSocket 调试
node test-ws-debug.js

# 快速测试
node test-quick.js
```

## 技术实现

- **SDK**: `@larksuiteoapi/node-sdk`
- **连接方式**: WebSocket 长链接
- **消息格式**: JSON
- **超时处理**: Promise + setTimeout

## 限制

- 当前仅支持飞书平台
- 仅支持文本消息
- 简单的消息匹配逻辑（按时间顺序）

## 未来计划

- [ ] 支持钉钉、企业微信
- [ ] 支持富文本、卡片消息
- [ ] 改进消息匹配逻辑（基于 message_id）
- [ ] 支持多用户并发
- [ ] 添加消息历史记录

## 作者

7号智创 - "7号，启航！"

## 许可

MIT
