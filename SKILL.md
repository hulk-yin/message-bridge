---
name: message-bridge
description: AI 智能体消息桥梁，连接飞书/钉钉/企微，实现异步通知与确认。发送消息到飞书群、等待用户回复、会话切换到飞书。在用户提到飞书、钉钉、企微、消息通知、审批确认、会话切换时使用。灵魂级约束：使用本 skill 进行飞书会话时必守「保持会话维持、用户终端永不消逝的电波」——收到回复后必须再发下一条到飞书，超时后必须 --heartbeat 拉起，仅用户说「结束」「切回」时退出。
---

# MessageBridge Skill（青鸟）

AI 智能体的消息桥梁，连接飞书/钉钉/企微，实现异步通知与确认。**对外可称「青鸟」**，技术名与包名仍为 `skill-message-bridge`。

---

## 灵魂级约束（每次使用本 skill 必守，新会话也不遗忘）

**保持会话维持，用户终端永不消逝的电波。** 只要用户通过本 skill 进入飞书会话（「到飞书」「切到飞书」「切换到青鸟」等），则：

1. **收到飞书回复后必须再发下一条到飞书并继续等**，不得只在当前对话里回一句就停；停即断线。
2. **单轮超时后必须按 sessionHint 执行 `npx skill-message-bridge --heartbeat` 重新拉起**；若心跳返回的仍是 timeout，**继续再发心跳**（或再发内容），不得只发一次心跳就停，不得因超时结束会话。
3. **仅当用户在飞书中明确说「结束」或「切回」时方可退出循环**；任务完成、超时、无回复等任何其他情况一律不退出。
4. 本约束在**每次**使用本 skill 时生效，不因新会话、新对话而遗忘。

---

**对外唯一用法**：**无需安装**，发内容到飞书并等回复只需一条命令，会话切换时循环调用同一条：

```bash
npx skill-message-bridge "<内容>"
# 可选超时：npx skill-message-bridge "<内容>" --timeout=3600
```

其余（自检、配置、首次配对等）都是该命令的**内部逻辑**，见下文「命令内部逻辑与配置」。需在 Cursor/Codex 内做「会话切换飞书」闭环时，可将本仓克隆到 skill 目录并执行 `npm run turn -- "<内容>"`。安装方式见 [INSTALL.md](./INSTALL.md)。

## Quick Start

**无需 `npm install`**，任意目录执行（npx 会从 npm 拉取并运行）：

```bash
npx skill-message-bridge "<要发到飞书的内容>"
```

- 把内容发到飞书并等待用户回复；stdout 输出单行 JSON（`status`、`reply`、`sessionHint` 等）。
- 「到飞书」/ 会话切换：循环执行「AI 生成回复 → `npx skill-message-bridge "<内容>"` → 解析回复 → 再生成 → 再调用」，直到用户说「结束」或「切回」。
- 若未配置飞书，命令内部会自检并给出引导，按提示完成配置后再用同一条命令即可（配置与首次配对见下文「命令内部逻辑与配置」）。

## 1. Skill 配置

- **包名**：`skill-message-bridge`。
- **对外用法**：`npx skill-message-bridge "<内容>"`（发到飞书并等回复）；自检、config、connect 等为命令内部逻辑，见 §4.2。
- **飞书配置**：环境变量或 `~/.message-bridge/config.json`；完整引导见 [飞书 Onboarding](./docs/ONBOARDING-FEISHU.md)。

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

## 4. 使用方式

### 4.1 对外唯一用法（AI / 调用方只认这一条）

```bash
npx skill-message-bridge "<内容>"
npx skill-message-bridge "<内容>" --timeout=3600   # 可选：单轮超时秒数
```

- 把 `<内容>` 发到飞书并等待用户回复；**stdout 仅输出一行 JSON**（`status`、`reply`、`replyUser`、`sessionHint` 等），便于 agent 解析、避免历史噪音；[MessageBridge] 等日志在 stderr，解析时只认 stdout 该行 JSON 即可。
- 消息也可从 stdin 传入：`echo "内容" | npx skill-message-bridge`。
- **「到飞书」/ 会话切换**：只循环调用这一条命令，由 AI 维持会话，直到用户说「结束」或「切回」。

不要使用 `require("@skills/message-bridge")`（包名为 `skill-message-bridge`）。

### 4.2 命令内部逻辑与配置（非对外用法）

以下均为**命令内部**或**用户首次配置**时涉及的行为，AI 不需要根据场景选择「用 check-env 还是 connect 还是 send」；只需用 `npx skill-message-bridge "<内容>"`，未配置时命令会自检并给出引导。

| 内部/配置用途 | 说明 |
|---------------|------|
| **自检** | 命令执行时会检查环境变量或 `~/.message-bridge/config.json`；缺项时输出引导，不直接发消息。 |
| **写入配置** | 用户首次配置：`npx skill-message-bridge config set feishu --app-id=xxx --app-secret=xxx` 写入配置文件；交互式引导需用户**本机终端**执行（TTY），npx 代跑多为非 TTY。 |
| **首次配对（chat_id）** | 仅缺 Chat ID 时：用户在本机终端执行 `npx skill-message-bridge connect`，在飞书发一条消息后终端输出 chat_id，再执行 `config set feishu --chat-id=oc_xxx` 保存。**connect 仅用于此次配对**，AI 在「到飞书」时**不要**调用 connect，只循环调用 `npx skill-message-bridge "<内容>"`。 |
| **仅发不等** | 内部对应 `send` 子命令；对外统一用「发内容并等回复」这一条即可，需要「只发不等」时可由调用方发完即忽略回复或设极短超时。 |
| **心跳（--heartbeat）** | 仅等待飞书下一条消息，**不向飞书推送任何内容**；用于单轮超时后**把会话重新拉起**、继续等飞书。用法：`npx skill-message-bridge --heartbeat [--timeout=N]`。**心跳可连续调用**：若本次 `--heartbeat` 返回的仍是 `status:"timeout"`，必须**再次**执行 `--heartbeat`（或发一条新内容），不能只发一次心跳就停；循环直到收到 `replied` 或用户说「结束」「切回」。输出格式与 `"<内容>"` 一致，超时同样为 `status:"timeout"`。 |
| **帮助** | `npx skill-message-bridge --help`、`config show`、`config path` 等为调试/运维用，非会话闭环所需。 |

完整飞书配置与权限步骤见 [飞书 Onboarding](./docs/ONBOARDING-FEISHU.md)。

### 4.3 在代码中调用（可选）

需要在自己写的 Node 脚本里调用时，可安装后 require：

```bash
npm install skill-message-bridge
```

```javascript
const messageBridge = require("skill-message-bridge");
// 或在本仓库根目录开发时: require("./dist/index.js")（需先 npm run build）
```

### 4.4 环境变量（飞书）

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
export FEISHU_CHAT_ID="oc_xxx"
```

（也支持 `DITING_FEISHU_*`。如何获取 chat_id 见 [飞书 Onboarding](./docs/ONBOARDING-FEISHU.md)。）

### 4.5 在 Node.js 中使用

```javascript
const messageBridge = require("skill-message-bridge");   // 从 npm 安装时
// 或 const messageBridge = require("./dist/index.js");  // 在本仓库根目录时（需先 npm run build）

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

### 4.6 在 OpenClaw / 其他 AI 智能体中

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

## 首次使用与配置引导（命令内部逻辑）

**（AI 必读）当用户说「切到飞书」「切换到飞书」「发消息到飞书」时：你只需循环调用 `npx skill-message-bridge "<内容>"`。** 不需要先跑 check-env、再选 config 或 connect；自检与配置是**命令内部逻辑**，未配置时命令会报错或提示，你再按下面引导用户即可。

若调用 `npx skill-message-bridge "<内容>"` 失败或提示未配置，按**缺项顺序**引导用户（以下均为命令内部/用户侧操作，不是你多调几种子命令）：

- **缺少 App ID 或 App Secret**：引导用户到 [飞书开放平台](https://open.feishu.cn/) 创建应用并复制凭证，再让用户执行 `npx skill-message-bridge config set feishu --app-id=xxx --app-secret=xxx` 保存；完整步骤见 [docs/ONBOARDING-FEISHU.md](./docs/ONBOARDING-FEISHU.md)。
- **仅缺 Chat ID**：需在飞书后台配置事件订阅（长连接 + `im.message.receive_v1`），再让用户**在本机终端**执行 `npx skill-message-bridge connect`，在群聊或私聊给机器人发一条消息后终端会输出 chat_id，再执行 `config set feishu --chat-id=oc_xxx` 保存。**connect 仅此次配对用，由用户本机执行，AI 不要代跑；「到飞书」时只循环 `npx skill-message-bridge "<内容>"`。**

配置完成后用户再说「切到飞书」即可正常循环上述唯一命令。

- **其他 Channel（钉钉/企微）**：当前未实现，可到 [Issues](https://github.com/hulk-yin/message-bridge/issues) 搜索或新建需求。

## 会话切换到飞书 = 飞书长周期对话闭环

**（AI 必读）除用户明确发出结束信号（如在飞书说「结束」「切回」）外，会话永不结束。** 单轮超时、任务完成、长时间无回复等任何场景均不结束会话；超时后用心跳把会话重新拉起，继续等飞书下一条。

当用户说**「会话切换到飞书」**时，进入长周期对话：AI 的输出发到飞书 → 飞书用户回复 → AI 基于回复再生成 → 再发飞书，循环；**仅**在用户说「结束」「切回」时退出，不设轮数上限。

**唯一用法**（与上文 4.1 一致）：

```bash
npx skill-message-bridge "<AI 的回复内容>"
npx skill-message-bridge "<内容>" --timeout=3600   # 可选
# 若在 skill 目录内：npm run turn -- "<内容>"
```

- 把内容发到飞书并等待用户回复；stdout 输出单行 JSON：`{"status":"replied","reply":"用户回复", "replyUser":"?", "sessionHint":"..."}`，超时为 `"status":"timeout"`。
- **sessionHint**：通常为「用户未说「结束」或「切回」前请继续循环发消息，勿退出飞书会话」。**当 status 为 "timeout" 时**，sessionHint 会改为明确指令：「本轮超时，请执行 npx skill-message-bridge --heartbeat [--timeout=N] 重新拉起会话；若返回仍为 timeout，继续再发 --heartbeat，勿只发一次就停，勿退出。」调用方按此执行即可。
- stderr 会提示：`[MessageBridge] 请根据 sessionHint 继续发下一条消息到飞书，勿退出会话。`
- 超时：默认约 12 小时（或 `FEISHU_TURN_TIMEOUT`）；可用 `--timeout=N` 覆盖。**单轮超时后永不退出**：用 **心跳** `npx skill-message-bridge --heartbeat [--timeout=N]` 把会话重新拉起，挂起等飞书下一条（不推送任何内容）；或发「等待超时，如需继续请直接回复」后再发一条 `"<内容>"`。超时≠结束会话。

**闭环**：循环「AI 生成回复 → `npx skill-message-bridge "<内容>"` → 解析 reply、sessionHint；若本轮超时 → 用 `npx skill-message-bridge --heartbeat [--timeout=N]` 重新拉起；**若心跳返回的仍是 timeout，继续再发心跳（或再发内容），不要只发一次心跳就停** → 直到收到 replied 再生成 → 再调用」。**仅当用户发出明确结束信号（如「结束」「切回」）时退出；任务结束、超时、无回复等任何其他场景一律不退出。**

**为何会自动断掉**：闭环在 Cursor 单次回复里跑，有工具调用/上下文上限，跑一段时间就会结束当次回复。**解决**：要不依赖 Cursor 的持久对话，可运行常驻进程 `npm run conversation`（即 `node scripts/feishu-conversation.js`，需配置 AI_REPLY_URL 或 OPENAI_API_KEY），在飞书里一直聊直到你说结束；若继续用 Cursor 闭环，断掉后说「继续飞书」即恢复。

## 可选：纯飞书端对话（scripts/feishu-conversation.js）

不经过 Cursor、只在飞书里和机器人对话时，可单独运行：

```bash
npm run conversation   # 或 node scripts/feishu-conversation.js
```

需配置 **AI_REPLY_URL** 或 **OPENAI_API_KEY**（+ OPENAI_BASE_URL、OPENAI_MODEL）。飞书需已订阅 `im.message.receive_v1`（长连接）。

## 测试

**验证唯一用法**（发到飞书并等回复，需飞书群内有人回）：

```bash
npx skill-message-bridge "请回复测试"
```

自检、只发不等等为命令内部/调试用（见 §4.2）。在仓库内还可运行：`npm test`、`npm run test:quick`、`npm run test:complete`、`npm run test:session-bridge`。

## 更多参考

- **API 参数与返回值、npm 发布与验证、技术实现、限制与未来计划**：见 [reference.md](./reference.md)。
