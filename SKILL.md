---
name: message-bridge
description: AI 智能体消息桥梁，连接飞书/钉钉/企微，实现异步通知与确认。发送消息到飞书群、等待用户回复、会话切换到飞书。在用户提到飞书、钉钉、企微、消息通知、审批确认、会话切换时使用。
---

# MessageBridge Skill

AI 智能体的消息桥梁，连接飞书/钉钉/企微，实现异步通知与确认。

**推荐用法**：**无需安装**，直接使用 `npx skill-message-bridge` 完成发消息、等回复、自检等全部操作。需在 Cursor/Codex 内做「会话切换飞书」闭环时，可将本仓克隆到 skill 目录并执行 `npm run turn -- "<内容>"`。安装方式见 [INSTALL.md](./INSTALL.md)。

## Quick Start（npx 优先，无需安装）

1. **配置飞书**：使用 `npx skill-message-bridge config set feishu --app-id=xxx --app-secret=xxx` 写入 `~/.message-bridge/config.json`，再用 `npx skill-message-bridge connect` 在群内发消息获取并保存 chat_id；或设置环境变量。完整步骤见 [飞书 Onboarding](./docs/ONBOARDING-FEISHU.md)。
2. **自检**：`npx skill-message-bridge check-env`
3. **使用**：
   - 只发不等：`npx skill-message-bridge send "测试"`
   - 发并等回复：`npx skill-message-bridge "消息"` 或 `npx skill-message-bridge notify "消息" [--timeout=60]`
   - 帮助：`npx skill-message-bridge --help`

## 1. Skill 配置自检

- **包名**：`skill-message-bridge`。
- **CLI 入口**：`dist/cli.js`（bin：`skill-message-bridge` / `message-bridge-turn`）。所有能力均可通过 npx 完成。
- **飞书配置**：优先使用环境变量；否则使用 `~/.message-bridge/config.json`（通过 `npx skill-message-bridge config set feishu ...` 写入）。`npx skill-message-bridge check-env` 可自检；完整引导见 [飞书 Onboarding](./docs/ONBOARDING-FEISHU.md)。

## 2. 功能

- ✅ 发送消息到飞书群聊
- ✅ 发送消息并等待用户回复
- ✅ 长连接实时接收（飞书事件订阅）
- ✅ 超时处理
- ✅ 任务队列管理

## 3. Channel 配置总览

| Channel | 状态 | 环境变量 | 说明与文档 |
|--------|------|----------|------------|
| **飞书 Feishu** | ✅ 已支持 | `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_CHAT_ID`（或 `DITING_FEISHU_*`） | 长连接收消息；完整从创建应用到获取 chat_id 见 [飞书 Onboarding](./docs/ONBOARDING-FEISHU.md) |
| 钉钉 DingTalk | 📌 规划中 | （待定） | 见 [CONTRIBUTING.md](./CONTRIBUTING.md#二新渠道接入--adding-a-new-channel) |
| 企微 WeCom | 📌 规划中 | （待定） | 同上 |

当前仅飞书可用；钉钉/企微欢迎按 CONTRIBUTING 接入。

## 4. 使用方式（全部可用 npx，无需安装）

### 4.1 npx 命令一览（推荐）

| 命令 | 说明 |
|------|------|
| `npx skill-message-bridge check-env` | 检查配置（环境变量或 ~/.message-bridge/config.json） |
| `npx skill-message-bridge config set feishu --app-id=xxx --app-secret=xxx [--chat-id=xxx]` | 将飞书配置写入 ~/.message-bridge/config.json |
| `npx skill-message-bridge config show` | 查看当前配置（脱敏） |
| `npx skill-message-bridge config path` | 显示配置文件路径 |
| `npx skill-message-bridge connect` | 启动长连接，收到首条群消息后输出 chat_id 并提示保存 |
| `npx skill-message-bridge send "<消息>"` | 只发送，不等待回复 |
| `npx skill-message-bridge "<消息>"` | 发送并等待回复（默认 notify） |
| `npx skill-message-bridge notify "<消息>" [--timeout=N]` | 同上，可指定超时秒数 |
| `npx skill-message-bridge --help` | 帮助 |

消息可从参数或 stdin 传入，例如：`echo "内容" \| npx skill-message-bridge send`。

不要使用 `require("@skills/message-bridge")`（包名为 `skill-message-bridge`）。

### 4.2 在代码中调用（可选）

需要在自己写的 Node 脚本里调用时，可安装后 require：

```bash
npm install skill-message-bridge
```

```javascript
const messageBridge = require("skill-message-bridge");
// 或在本仓库根目录开发时: require("./index.js")
```

### 4.3 环境变量（飞书）

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
export FEISHU_CHAT_ID="oc_xxx"
```

（也支持 `DITING_FEISHU_*`。如何获取 chat_id 见 [飞书 Onboarding](./docs/ONBOARDING-FEISHU.md)。）

### 4.4 在 Node.js 中使用

```javascript
const messageBridge = require("skill-message-bridge");   // 从 npm 安装时
// 或 const messageBridge = require("./index.js");      // 在本仓库根目录时

// 发送消息并等待回复
const result = await messageBridge.notify({
  message: "需要你确认一下这个操作",
  timeout: 60,
});

if (result.status === "replied") {
  console.log("用户回复:", result.reply);
} else if (result.status === "timeout") {
  console.log("超时未回复");
}

await messageBridge.send({ message: "任务已完成！" });
```

### 4.5 在 OpenClaw / 其他 AI 智能体中

```javascript
const { notify, send } = require("skill-message-bridge");

const result = await notify({
  message: "检测到异常，是否继续？",
  timeout: 120,
});

if (result.status === "replied" && result.reply.includes("继续")) {
  console.log("用户确认，继续执行");
} else {
  console.log("用户拒绝或超时，停止执行");
}
```

## API 摘要

- **notify({ message, timeout? })**：发消息并等待用户回复；返回 `status: "replied"|"timeout"|"error"`、`reply`、`replyUser`。
- **send({ message })**：仅发送消息，不等待回复；返回 `messageId`。

参数与返回值详见 [reference.md](./reference.md)。

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

## 首次使用引导与 Channel 选择

1. **选择 Channel**  
   - **默认飞书**：直接进入飞书引导，见 **[docs/ONBOARDING-FEISHU.md](./docs/ONBOARDING-FEISHU.md)**（独立文档：App ID/App Secret → npx config set → 权限配置含 [权限列表 JSON](./docs/feishu-permissions.json) → 启动长连接 → 事件订阅 → 群内发消息确认并保存 chat_id）。
   - **其他 Channel（钉钉/企微等）**：当前未实现。请到 GitHub 仓库 [Issues](https://github.com/hulk-yin/message-bridge/issues) **先搜索**是否已有「xx channel 需求」或「支持 xx」类 issue：  
     - **若已有**：在文档或回复中给出该 issue 链接，供用户跟进。  
     - **若没有**：引导用户 [新建 Issue](https://github.com/hulk-yin/message-bridge/issues/new)，说明需要的 channel 与使用场景，便于后续支持或社区共建。

2. **飞书 Channel 配置要点**  
   - 使用 **npx** 写入配置，不依赖环境变量：`npx skill-message-bridge config set feishu --app-id=xxx --app-secret=xxx`，配置保存在 **`~/.message-bridge/config.json`**。  
   - 权限：在飞书后台按 [docs/feishu-permissions.json](./docs/feishu-permissions.json) 中的权限名开通；飞书平台若支持批量导入则可使用该 JSON。  
   - 先启动长连接（`npx skill-message-bridge connect`），再在飞书后台配置**事件订阅（长连接 + im.message.receive_v1）**，然后在群内 @机器人 发消息，收到后 CLI 会输出 chat_id，执行 `npx skill-message-bridge config set feishu --chat-id=oc_xxx` 保存。  
   - **若无法发送或收不到消息**：先完成飞书后台的**长连接事件订阅**配置，再重试。

## 会话切换到飞书 = 飞书长周期对话闭环

当调用方（如 Cursor AI）收到用户说**「会话切换到飞书」**时，应进入**你与 skill 的长周期对话环境**：非飞书渠道启动 → AI 的输出发到飞书 → 飞书用户回复 → AI 基于回复继续思考 → 结果再发飞书，循环执行；**仅**在用户说「结束」「切回」时退出，不设轮数上限，不主动结束则永远 loop。

**单轮工具**（供 AI 循环调用）：

```bash
npx skill-message-bridge "<AI 的回复内容>"
# 或指定超时：npx skill-message-bridge notify "<内容>" --timeout=3600
# 若在 skill 目录内：npm run turn -- "<AI 的回复内容>"
```

- 把内容发到飞书并等待用户回复。
- 输出单行 JSON：`{"status":"replied","reply":"用户回复", "replyUser":"?"}`；超时为 `"status":"timeout"`。
- 超时：默认 `FEISHU_TURN_TIMEOUT=3600`（秒）；可用 `--timeout=N` 覆盖。单轮超时后不要退出闭环，发「等待超时，如需继续请直接回复」并再次等待。

**闭环**：循环执行「AI 生成回复 → 调用 `npx skill-message-bridge "<内容>"`（或 `npm run turn -- "<内容>"`）→ 解析 reply → 再生成 → 再调用」；仅用户说「结束」/「切回」时退出，不设轮数上限，永远 loop。

**为何会自动断掉**：闭环在 Cursor 单次回复里跑，有工具调用/上下文上限，跑一段时间就会结束当次回复。**解决**：要不依赖 Cursor 的持久对话，可运行常驻进程 `node feishu-conversation.js`（配置 AI_REPLY_URL 或 OPENAI_API_KEY），在飞书里一直聊直到你说结束；若继续用 Cursor 闭环，断掉后说「继续飞书」即恢复。

## 可选：纯飞书端对话（feishu-conversation.js）

不经过 Cursor、只在飞书里和机器人对话时，可单独运行：

```bash
node feishu-conversation.js   # 或 npm run conversation
```

需配置 **AI_REPLY_URL** 或 **OPENAI_API_KEY**（+ OPENAI_BASE_URL、OPENAI_MODEL）。飞书需已订阅 `im.message.receive_v1`（长连接）。

## 测试

```bash
# 自检环境变量（不请求飞书）
npx skill-message-bridge check-env

# 只发一条（不等待回复）
npx skill-message-bridge send "测试"

# 发并等回复（需在飞书群内有人回）
npx skill-message-bridge "请回复测试"   # 或 npx skill-message-bridge notify "..." --timeout=60
```

在仓库内还可运行：`node test.js`（主测试）、`node test-quick.js`（快速 notify）、`node test-complete.js`（完整功能）、`node test-session-bridge.js`（Session Bridge）。

## 更多参考

- **API 参数与返回值、npm 发布与验证、技术实现、限制与未来计划**：见 [reference.md](./reference.md)。
