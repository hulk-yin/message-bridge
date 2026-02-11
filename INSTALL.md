# 安装为 Skill / Install as Skill

本仓库可作为 **Skill** 被 Cursor、Codex、Claude Code 等 AI 编码环境加载，实现「会话切换到飞书/钉钉」、发消息、等回复等能力。安装后，**所有命令均在 skill 目录（即本仓库根目录）执行**。

This repo can be installed as a **skill** in Cursor, Codex, Claude Code, etc. All commands below assume you run them from the **skill root** (this repo root).

---

## Cursor

Cursor 从项目的 `.cursor/skills/<name>/` 或用户级 skills 目录加载 skill；本仓库包含 `SKILL.md` + 实现代码，**整仓克隆到 skill 目录即可**。

### 方式一：项目内安装（仅当前项目可用）

在**项目根目录**执行：

```bash
git clone https://github.com/hulk-yin/message-bridge.git .cursor/skills/message-bridge
cd .cursor/skills/message-bridge && npm install && npm run build:dist
```

之后 Cursor 会识别 `.cursor/skills/message-bridge/SKILL.md`，实现代码即同目录下的 `index.js`、`dist/feishu-turn.js` 等；AI 执行 `npm run turn` 时在 **`.cursor/skills/message-bridge`** 下执行即可。

### 方式二：用户级安装（所有项目可用）

若希望所有 Cursor 项目都能用，可克隆到 Cursor 用户级 skills 目录（具体路径以 Cursor 文档为准，常见为 `~/.cursor/skills/` 或 Cursor 设置中的 “Skills path”）：

```bash
mkdir -p ~/.cursor/skills
git clone https://github.com/hulk-yin/message-bridge.git ~/.cursor/skills/message-bridge
cd ~/.cursor/skills/message-bridge && npm install && npm run build:dist
```

安装后**重启 Cursor** 或重新加载技能，配置好 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_CHAT_ID` 即可使用。

---

## Codex (OpenAI)

Codex 使用 `$CODEX_HOME/skills`（默认 `~/.codex/skills`），通过 **skill-installer** 从 GitHub 安装。若你已安装 [skill-installer](https://github.com/openai/skills) 的脚本，在具备网络权限的环境执行：

```bash
# 从 Codex 的 skill-installer 目录执行（或把 install-skill-from-github.py 放到 PATH）
scripts/install-skill-from-github.py --repo hulk-yin/message-bridge --path .
```

将安装到 `$CODEX_HOME/skills/message-bridge`，目录内包含 `SKILL.md` 与完整实现。安装后**重启 Codex** 以加载新 skill。需在 skill 目录执行 `npm install` 与 `npm run build:dist` 后，`npm run turn` 等命令才可用。

若无法使用上述脚本，可手动克隆：

```bash
git clone https://github.com/hulk-yin/message-bridge.git "${CODEX_HOME:-$HOME/.codex}/skills/message-bridge"
cd "${CODEX_HOME:-$HOME/.codex}/skills/message-bridge" && npm install && npm run build:dist
```

---

## Claude Code / 其他环境

只要该环境支持「从某目录加载 skill（读取 SKILL.md 或等价描述）」，即可将本仓库克隆到该目录：

```bash
# 将 <SKILLS_ROOT> 替换为环境的 skill 根目录
git clone https://github.com/hulk-yin/message-bridge.git <SKILLS_ROOT>/message-bridge
cd <SKILLS_ROOT>/message-bridge && npm install && npm run build:dist
```

约定：

- **Skill 根目录** = 本仓库根目录 = 包含 `SKILL.md` 与 `package.json` 的目录。
- 所有文档中的 `npm run turn`、`node dist/feishu-turn.js` 等命令，均在 **该目录** 下执行。
- 环境变量 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_CHAT_ID` 需在运行前配置（或使用 `DITING_FEISHU_*`）。

---

## 安装后自检

在 **skill 根目录**（即本仓库根）执行：

```bash
npm install
npm run build:dist
# 配置 FEISHU_* 后做一次快速测试（会真实发飞书）
node test-quick.js
```

若测试通过，即可在 Cursor/Codex/Claude 中通过「会话切换到飞书」或对应指令使用本 skill。

---

## 小结

| 环境        | 安装方式 | Skill 根目录 |
|-------------|----------|----------------|
| Cursor 项目 | `git clone ... .cursor/skills/message-bridge` | 项目内 `.cursor/skills/message-bridge` |
| Cursor 全局 | `git clone ... ~/.cursor/skills/message-bridge` | `~/.cursor/skills/message-bridge` |
| Codex       | `install-skill-from-github.py --repo hulk-yin/message-bridge --path .` 或手动 clone | `$CODEX_HOME/skills/message-bridge` |
| 其他        | `git clone ... <SKILLS_ROOT>/message-bridge` | `<SKILLS_ROOT>/message-bridge` |

**统一约定**：实现与命令均以「本仓库根目录」为当前目录，不依赖绝对路径。
