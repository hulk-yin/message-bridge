# MessageBridge

AI 智能体的多渠道消息桥梁，实现「发消息」与「等回复」，支持与 AI 对话闭环。**当前已实现飞书；钉钉、企微等欢迎社区共建。**

A multi-channel message bridge for AI agents: send messages and wait for replies. **Feishu is implemented; DingTalk, WeCom, etc. welcome community contributions.**

---

## 如何对接不同渠道 / Supported Channels

| 渠道 Channel | 状态 Status | 说明 |
|-------------|-------------|------|
| 飞书 Feishu | ✅ 已实现 | 需配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_CHAT_ID`（或 `DITING_FEISHU_*`），长连接收消息。 |
| 钉钉 DingTalk | 📌 待共建 | 接口形态类似：发消息 + 收回复；接入步骤见 [CONTRIBUTING.md](./CONTRIBUTING.md#二新渠道接入--adding-a-new-channel)。 |
| 企微 WeCom | 📌 待共建 | 同上，欢迎按 CONTRIBUTING 清单提交适配。 |

扩展新渠道：在 `src/platforms/` 增加适配器并实现「发消息 + 将用户回复回填到队列」，详见 [CONTRIBUTING](./CONTRIBUTING.md)。

---

## 参与共建 / Community

欢迎补全其它 IM 渠道、补全文档与单测、或改进现有实现。请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)，按「新渠道接入」清单或「贡献流程」提 PR；**欢迎 AI 按文档参与贡献**（见 CONTRIBUTING「给 AI 贡献者」）。

---

## 快速开始 / Quick Start

**无需安装**，配置环境变量后直接使用 npx：

```bash
# 1. 配置环境变量（飞书示例，完整步骤见 docs/ONBOARDING-FEISHU.md）
export FEISHU_APP_ID="your_app_id"
export FEISHU_APP_SECRET="your_app_secret"
export FEISHU_CHAT_ID="oc_xxx"

# 2. 自检
npx skill-message-bridge check-env

# 3. 使用
npx skill-message-bridge send "测试"      # 只发
npx skill-message-bridge "消息"           # 发并等回复
npx skill-message-bridge --help
```

在仓库内开发时：`npm install` → `npm run build:dist` → `node test-quick.js`。

## 功能特性

✅ **消息发送** - 发送消息到飞书群聊  
✅ **等待回复** - 发送消息并等待用户回复  
✅ **实时接收** - WebSocket 长链接实时接收消息  
✅ **超时处理** - 可配置超时时间  
✅ **任务队列** - 支持多任务管理  

## 使用示例

```javascript
const messageBridge = require("./index.js");

// 发送消息并等待回复
const result = await messageBridge.notify({
  message: "需要你确认一下",
  timeout: 60,
});

if (result.status === "replied") {
  console.log("用户回复:", result.reply);
}

// 仅发送消息
await messageBridge.send({
  message: "任务完成！",
});
```

## 文档 / Docs

- [INSTALL.md](./INSTALL.md) - **安装为 Cursor / Codex / Claude Code Skill**（中英）
- [CONTRIBUTING.md](./CONTRIBUTING.md) - 贡献流程、新渠道接入、单测与 AI 友好说明（中英）
- [SKILL.md](./SKILL.md) - 与 AI 技能/闭环使用相关的详细说明

## 开发进度

详细进度请查看 [PROGRESS.md](./PROGRESS.md)

## 测试与示例

**正式测试**（需配置飞书凭证或 config 文件）：
- `test.js` - 主测试（凭证 + 发送），`npm test`
- `test-quick.js` - 快速 notify（发并等回复）
- `test-complete.js` - 完整功能（notify + send）
- `test-session-bridge.js` - Session Bridge（切到飞书/切回）

**示例**（参考用）：`example-claude-code.js`、`example-ai-wrapper.js`、`example-async.js`、`example-polling.js`  
详见 [docs/TESTS-AND-SCRIPTS.md](./docs/TESTS-AND-SCRIPTS.md)。

## 技术栈

- Node.js
- @larksuiteoapi/node-sdk
- WebSocket 长链接

## 作者

7号智创 - "7号，启航！"

## 许可 / License

MIT

---

## 安装方式 / Install

- **npm**：`npm install skill-message-bridge`（已上架 [npm](https://www.npmjs.com/package/skill-message-bridge)）。代码中 `require("skill-message-bridge")`，命令行 `npx skill-message-bridge "..."`。
- **Skill（Cursor / Codex / Claude）**：见 **[INSTALL.md](./INSTALL.md)**，支持 Git 克隆到各环境 skill 目录或从 npm 安装后使用。

## English (short)

- **What**: Send messages and wait for user replies over IM (Feishu implemented; other channels welcome).
- **Quick start**: `npm install` → set `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_CHAT_ID` → `npm run build:dist` → `node test-quick.js`.
- **API**: `notify({ message, timeout })` returns `{ status: "replied"|"timeout"|"error", reply, replyUser }`; `send({ message })` for fire-and-forget.
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md) for new channels, tests, and AI-friendly checklists.
