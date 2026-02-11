# 贡献指南 / Contributing

欢迎参与 MessageBridge 的共建。本项目**不限定单一渠道**，当前已实现飞书，欢迎社区补全钉钉、企微等其它渠道。

We welcome contributions. The project supports multiple channels (Feishu implemented; DingTalk, WeCom, etc. welcome).

---

## 一、贡献流程 / How to Contribute

### 目标
- 代码、文档、单测符合规范，便于维护与 AI 协作。

### 步骤
1. Fork 本仓库，在个人 fork 上创建分支（如 `feature/dingtalk` 或 `fix/xxx`）。
2. 修改后在本机运行 `npm run build:dist`（若有改 src）及现有测试（如 `node test-quick.js`）。
3. 提交信息建议格式：`类型: 简短描述`（如 `feat: 钉钉发送与等待回复`、`docs: README 英文版`）。
4. 向本仓库发起 Pull Request，描述变更与自测结果。
5. 维护者 Review 后合并。

### 验收标准
- [ ] 新代码有对应单测或已通过现有测试。
- [ ] 文档/README 如有涉及则同步更新（中英双语优先）。
- [ ] PR 描述说明「做了什么、如何验证」。

---

## 二、新渠道接入 / Adding a New Channel

### 目标
- 在不破坏现有飞书能力的前提下，新增一个 IM 渠道（如钉钉、企微），实现「发消息」与「等回复」。

### 步骤与可执行清单（供人工或 AI 逐条完成）

- [ ] **1. 平台适配器**  
  在 `src/platforms/` 下新增 `<channel>.ts`（参考 `feishu.ts`），实现：
  - 获取 access token（或该渠道等价物）。
  - 建立长连接/订阅（若需收消息）。
  - `sendMessage(task)`：发送一条消息并返回消息 ID。
  - 在收到用户消息时，调用 `messageQueue.resolveTask(taskId, { reply, replyUser })` 与队列对接。
- [ ] **2. 注册适配器**  
  在 `src/index.ts`（或统一平台注册处）根据 `platform` 参数选择对应 adapter，保持 `notify(params)` / `send(params)` 的 `platform` 入参生效。
- [ ] **3. Turn 脚本**  
  新增 `dist/<channel>-turn.js`（可参考 `feishu-turn.js`）：读环境变量、调 `notify({ message, timeout })`、stdout 最后一行为单行 JSON `{"status":"replied"|"timeout"|"error","reply":"...","replyUser":"?"}`。
- [ ] **4. 环境变量**  
  在 README 与本文档中说明新渠道所需环境变量（如 `DINGTALK_APP_KEY`、`DINGTALK_APP_SECRET`、会话 ID 等）。
- [ ] **5. 单测**  
  为该渠道增加至少 1 个可运行的测试（发送或 mock 收消息），保证 CI/本地 `npm test` 或等价命令可覆盖。
- [ ] **6. 文档**  
  - README「支持的渠道」中列出新渠道及配置说明（中英双语）。
  - 本文档「新渠道接入」下可补充该渠道的简要说明或链接。

### 验收标准
- [ ] 新渠道可通过 `notify` 发消息并拿到用户回复（或 timeout）。
- [ ] 新渠道的 turn 脚本可在项目根目录执行并输出约定 JSON。
- [ ] 单测通过；README/CONTRIBUTING 已更新。

---

## 三、单测要求 / Testing

- **新功能**：应有对应单测（发送、收回复、超时、错误处理等，可 mock 网络）。
- **新渠道**：至少覆盖「发送成功」或「模拟收到回复」一条路径。
- **运行方式**：在项目根目录执行 `node test-quick.js` 或 `npm test`（以 package.json 为准）；CI 可在此基础上增加流水线。
- **单测写法**：可参考现有 `test-quick.js`、`test-complete.js`；保持用例独立、不依赖外部未 mock 的服务。

---

## 四、文档与 AI 友好 / Docs & AI-Friendly

为方便人类与 AI 贡献者按步骤完成工作，文档约定如下：

- **结构化**：每个主题包含「目标 / 步骤 / 验收标准」三块，便于按步骤执行并自检。
- **可执行清单**：如「新渠道接入」采用 checkbox 列表，可逐条勾选完成。
- **格式与示例**：目录命名、单测风格、PR 描述格式在本文档中给出示例，贡献者可按示例仿写。
- **中英双语**：README、CONTRIBUTING 及与贡献者相关的说明尽量提供中英版本（可在同一文件中用标题分隔）。

---

## 五、给 AI 贡献者 / For AI Contributors

本项目欢迎由 AI 按文档完成的贡献（代码、文档、单测）。建议：

- **推荐起点**：从「新渠道接入」或「文档/README 中英双语补全」类 issue 或任务入手。
- **必读文件**：`README.md`、`CONTRIBUTING.md`（本文）、`src/platforms/feishu.ts`、`src/index.ts`、`feishu-turn.js` / `dist/feishu-turn.js`。
- **执行顺序**：按 CONTRIBUTING 中「步骤」与「可执行清单」逐条完成，并在 PR 中说明已完成项与验收结果。
- **提交与 PR**：提交信息与 PR 描述请写清「做了什么、如何验证」，便于维护者 Review。

---

## 六、发布到 GitHub / Publishing to GitHub

若你希望将本仓库发布到自己的 GitHub 账号下：

1. 在本机安装 [GitHub CLI](https://cli.github.com/)：`sudo apt install -y gh`（或 `brew install gh` / 见官方文档）。
2. 登录：`gh auth login`，按提示完成 GitHub 授权。
3. 在**本项目目录**下（若尚未初始化 git）：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create message-bridge --public --source=. --push
   ```
4. 若仓库已存在，则：`git remote add origin <your-repo-url>` 后 `git push -u origin main`。

（此节仅作说明，不要求贡献者必须执行。）

发版 npm 由 GitHub Actions 在推送 `v*` tag 时自动执行，见 `.github/workflows/publish.yml`，无需写入贡献说明。

---

# English (summary)

- **Contribution flow**: Fork → branch → implement & test → commit (message: `type: short desc`) → open PR with description and self-check.
- **New channel**: Add adapter in `src/platforms/`, register in index, add turn script and env docs, add tests, update README (EN+ZH).
- **Testing**: New code should have tests; new channels need at least one test covering send or mock reply.
- **Docs**: Structured (goal / steps / acceptance), checklists, examples; bilingual (EN+ZH) preferred.
- **AI contributors**: Start from "new channel" or "docs i18n"; read README, CONTRIBUTING, `src/platforms/feishu.ts`, `src/index.ts`, turn script; follow checklists and state completion in PR.
