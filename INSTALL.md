# 安装为 Skill / Install as Skill

本仓库可作为 **Skill** 被 Cursor、Codex、Claude Code、VS Code（Claude 插件）等 AI 编码环境加载，实现「会话切换到飞书/钉钉」、发消息、等回复等能力。**推荐**：无需安装，直接使用 **npx** 完成全部操作。

---

## Install 指令（推荐：一条命令安装到目标工具）

在任意目录执行 **`npx skill-message-bridge install`**，可按目标工具自动 clone 仓库、执行 `npm install` 与 `npm run build`，无需手写路径。

```bash
# 安装到 Cursor（当前项目 .cursor/skills/message-bridge）
npx skill-message-bridge install --target=cursor

# 安装到 Cursor 用户级（所有项目可用）
npx skill-message-bridge install --target=cursor --global

# 安装到 Codex（$CODEX_HOME/skills，默认 ~/.codex/skills）
npx skill-message-bridge install --target=codex

# 安装到 Claude Code / VS Code 常用目录（~/.claude/skills）
npx skill-message-bridge install --target=claude-code

# 未知工具或国内 IDE：指定 skills 根目录，将安装到 <dir>/message-bridge
npx skill-message-bridge install --dir=/path/to/your/skills/root
```

| 目标 | 说明 |
|------|------|
| `--target=cursor` | 当前项目 `.cursor/skills/message-bridge`；加 `--global` 为 `~/.cursor/skills/message-bridge` |
| `--target=codex` | `$CODEX_HOME/skills/message-bridge`（未设置则 `~/.codex/skills/message-bridge`） |
| `--target=claude-code` / `vscode` | `~/.claude/skills/message-bridge`（可按你本地约定改用 `--dir`） |
| `--dir=/path` | 安装到 `/path/message-bridge`，适合国内 IDE 或自定义 skills 目录 |

安装后重启对应 IDE 或重新加载 skills，并配置飞书环境变量（见 [ONBOARDING-FEISHU](./docs/ONBOARDING-FEISHU.md)）。

---

## 推荐：直接使用 npx（无需安装）

配置好环境变量 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_CHAT_ID` 后，任意目录执行：

```bash
npx skill-message-bridge check-env        # 自检环境变量
npx skill-message-bridge send "测试"      # 只发不等
npx skill-message-bridge "消息"           # 发并等回复（默认 notify）
npx skill-message-bridge notify "消息" --timeout=60
npx skill-message-bridge --help          # 帮助
```

**从零到获取 chat_id 的完整步骤**见 [docs/ONBOARDING-FEISHU.md](./docs/ONBOARDING-FEISHU.md)。若需在 Cursor/Codex 中作为「可加载的 skill」（含 SKILL.md），可将 skill 目录指向 `node_modules/skill-message-bridge`（见下），或用 Git 克隆到 `.cursor/skills/`。

---

## 方式一：npm 包（需在代码中 require 时）

```bash
npm install skill-message-bridge
```

```javascript
const messageBridge = require("skill-message-bridge");
const result = await messageBridge.notify({ message: "请确认", timeout: 60 });
```

命令行仍可直接用 npx，无需全局安装。**发布状态**：包名 `skill-message-bridge`，已上架 npm；亦可 `npm install github:hulk-yin/message-bridge`。

---

## 方式二：Git 克隆（完整 Skill）/ Via Git clone

安装后，**所有命令均在 skill 目录（即本仓库根目录）执行**。适合需要完整 SKILL.md + 源码、或需改代码贡献的场景。

### Cursor

Cursor 从项目的 `.cursor/skills/<name>/` 或用户级 skills 目录加载 skill；本仓库包含 `SKILL.md` + 实现代码，**整仓克隆到 skill 目录即可**。

### 方式一：项目内安装（仅当前项目可用）

在**项目根目录**执行：

```bash
git clone https://github.com/hulk-yin/message-bridge.git .cursor/skills/message-bridge
cd .cursor/skills/message-bridge && npm install && npm run build
```

之后 Cursor 会识别 `.cursor/skills/message-bridge/SKILL.md`，实现代码即同目录下的 `dist/index.js`、`dist/cli.js`（由 `src/*.ts` 编译）；AI 执行 `npm run turn` 时在 **`.cursor/skills/message-bridge`** 下执行即可（需先 `npm run build`）。

### 方式二：用户级安装（所有项目可用）

若希望所有 Cursor 项目都能用，可克隆到 Cursor 用户级 skills 目录（具体路径以 Cursor 文档为准，常见为 `~/.cursor/skills/` 或 Cursor 设置中的 “Skills path”）：

```bash
mkdir -p ~/.cursor/skills
git clone https://github.com/hulk-yin/message-bridge.git ~/.cursor/skills/message-bridge
cd ~/.cursor/skills/message-bridge && npm install && npm run build
```

安装后**重启 Cursor** 或重新加载技能，配置好 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_CHAT_ID` 即可使用。

---

## Codex (OpenAI)

Codex 使用 `$CODEX_HOME/skills`（默认 `~/.codex/skills`），通过 **skill-installer** 从 GitHub 安装。若你已安装 [skill-installer](https://github.com/openai/skills) 的脚本，在具备网络权限的环境执行：

```bash
# 从 Codex 的 skill-installer 目录执行（或把 install-skill-from-github.py 放到 PATH）
scripts/install-skill-from-github.py --repo hulk-yin/message-bridge --path .
```

将安装到 `$CODEX_HOME/skills/message-bridge`，目录内包含 `SKILL.md` 与完整实现。安装后**重启 Codex** 以加载新 skill。需在 skill 目录执行 `npm install` 与 `npm run build` 后，`npm run turn` 等命令才可用。

若无法使用上述脚本，可手动克隆：

```bash
git clone https://github.com/hulk-yin/message-bridge.git "${CODEX_HOME:-$HOME/.codex}/skills/message-bridge"
cd "${CODEX_HOME:-$HOME/.codex}/skills/message-bridge" && npm install && npm run build
```

---

## Claude Code / 其他环境

只要该环境支持「从某目录加载 skill（读取 SKILL.md 或等价描述）」，即可将本仓库克隆到该目录：

```bash
# 将 <SKILLS_ROOT> 替换为环境的 skill 根目录
git clone https://github.com/hulk-yin/message-bridge.git <SKILLS_ROOT>/message-bridge
cd <SKILLS_ROOT>/message-bridge && npm install && npm run build
```

约定：

- **Skill 根目录** = 本仓库根目录 = 包含 `SKILL.md` 与 `package.json` 的目录。
- 所有文档中的 `npm run turn`、`npm run check-env` 等命令，均在 **该目录** 下执行。
- 环境变量 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_CHAT_ID` 需在运行前配置（或使用 `DITING_FEISHU_*`）。

---

## 安装后自检

在 **skill 根目录**（即本仓库根）执行：

```bash
npm install
npm run build
# 1. 检查环境变量（不请求飞书）
npx skill-message-bridge check-env
# 2. 配置 FEISHU_* 后做一次快速测试（会真实发飞书）
npx skill-message-bridge send "测试"
# 或发并等回复
npx skill-message-bridge "请回复测试" --timeout=60
```

未配置飞书时，先按 [docs/ONBOARDING-FEISHU.md](./docs/ONBOARDING-FEISHU.md) 完成从创建应用到获取 chat_id 的整条链路。若测试通过，即可在 Cursor/Codex/Claude 中通过「会话切换到飞书」或对应指令使用本 skill。

---

## 小结

| 方式 | 环境        | 安装方式 | 说明 |
|------|-------------|----------|------|
| **npm** | 任意 Node 项目 | `npm install skill-message-bridge` | 代码中 `require("skill-message-bridge")`；命令行 `npx skill-message-bridge "..."`；未发布前可用 `npm install github:hulk-yin/message-bridge` |
| **Git** | Cursor 项目 | `git clone ... .cursor/skills/message-bridge` | 项目内 `.cursor/skills/message-bridge` |
| **Git** | Cursor 全局 | `git clone ... ~/.cursor/skills/message-bridge` | `~/.cursor/skills/message-bridge` |
| **Git** | Codex       | `install-skill-from-github.py --repo hulk-yin/message-bridge --path .` 或手动 clone | `$CODEX_HOME/skills/message-bridge` |
| **Git** | 其他        | `git clone ... <SKILLS_ROOT>/message-bridge` | `<SKILLS_ROOT>/message-bridge` |

**统一约定**：Git 方式下，实现与命令均以「本仓库根目录」为当前目录；npm 方式下，命令在安装目录 `node_modules/skill-message-bridge` 或通过 `npx` 运行。
