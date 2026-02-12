#!/usr/bin/env node
"use strict";
/**
 * skill-message-bridge 统一 CLI
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const readline = __importStar(require("readline"));
const child_process_1 = require("child_process");
const mb = __importStar(require("./index"));
const REPO_URL = "https://github.com/hulk-yin/message-bridge.git";
function prompt(question, opts) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        if (opts?.mask) {
            // 密文输入（例如 App Secret）：不回显实际字符，仅显示 *
            // 提示文案使用 console.log 打印，避免被覆盖
            console.log(question);
            // 覆盖输出逻辑，将用户输入的可见字符替换为 *
            rl._writeToOutput = function (stringToWrite) {
                if (stringToWrite.includes("\n") || stringToWrite.includes("\r")) {
                    process.stdout.write(stringToWrite);
                }
                else {
                    process.stdout.write("*");
                }
            };
            rl.question("", (answer) => {
                rl.close();
                resolve((answer || "").trim());
            });
        }
        else {
            rl.question(question, (answer) => {
                rl.close();
                resolve((answer || "").trim());
            });
        }
    });
}
/** 默认单轮等待秒数：12 小时。可通过 FEISHU_TURN_TIMEOUT 或 --timeout 覆盖；0 或 -1 表示用 MAX_SAFE_TIMEOUT_SEC。 */
const DEFAULT_TIMEOUT_SEC = 12 * 3600; // 12h
const MAX_SAFE_TIMEOUT_SEC = 2147483; // 2^31-1 ms / 1000，Node 不溢出
const FEISHU_TURN_TIMEOUT = parseInt(process.env.FEISHU_TURN_TIMEOUT || String(DEFAULT_TIMEOUT_SEC), 10);
const CONFIG_DIR = path.join(os.homedir(), ".message-bridge");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
/** 配对成功后发到飞书的引导文案（面向用户，与 SKILL 中「会话切换到飞书」说明一致） */
const FEISHU_PAIRING_SUCCESS_GUIDE = "配对成功！已自动保存本会话，下次在 Cursor/Codex 里你只要说「切换到飞书」「切到飞书」或「离开一会」，就可以把对话切到这里继续和青鸟对话；说「结束」或「切回」则切回。";
/** 每轮返回给调用方的会话提示，避免 Cursor 等忘记 in-loop 约束自动退出。不做内容匹配，是否结束由调用方根据语义判断。 */
const SESSION_HINT_CONTINUE = "用户未说「结束」或「切回」前请继续循环发消息，勿退出飞书会话。";
/** 超时时的明确指令：让调用方执行 --heartbeat 重新拉起；若心跳再超时则继续发心跳，不要只发一次就停。 */
const SESSION_HINT_TIMEOUT = "本轮超时，请执行 npx skill-message-bridge --heartbeat [--timeout=N] 重新拉起会话；若返回仍为 timeout，继续再发 --heartbeat，勿只发一次就停，勿退出。";
function sessionHint(status, _reply) {
    return status === "timeout" ? SESSION_HINT_TIMEOUT : SESSION_HINT_CONTINUE;
}
/** 会话回复后自动补一句给调用方（Cursor 等）的提醒。输出到 stderr，不破坏 stdout 单行 JSON。 */
function printSessionReminder() {
    process.stderr.write("[MessageBridge] 请根据 sessionHint 继续发下一条消息到飞书，勿退出会话。\n");
}
function loadConfigFile() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return { feishu: {} };
    }
}
function saveConfigFile(obj) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(obj, null, 2), "utf8");
}
function parseConfigSetArgs(argv) {
    const out = {};
    for (let i = 3; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--app-id" && argv[i + 1] != null)
            out.appId = argv[++i];
        else if (arg === "--app-secret" && argv[i + 1] != null)
            out.appSecret = argv[++i];
        else if (arg === "--chat-id" && argv[i + 1] != null)
            out.chatId = argv[++i];
        else if (arg.startsWith("--app-id="))
            out.appId = arg.replace(/^--app-id=/, "");
        else if (arg.startsWith("--app-secret="))
            out.appSecret = arg.replace(/^--app-secret=/, "");
        else if (arg.startsWith("--chat-id="))
            out.chatId = arg.replace(/^--chat-id=/, "");
    }
    return out;
}
function readStdin() {
    if (!process.stdin.isTTY) {
        return fs.readFileSync(0, "utf8").trim();
    }
    return "";
}
function getMessageFromArgv(argv, afterSubcommand) {
    const arg = argv[afterSubcommand];
    if (arg !== undefined && arg !== "" && !arg.startsWith("--"))
        return arg;
    return readStdin();
}
function parseTimeout(argv) {
    let sec = FEISHU_TURN_TIMEOUT;
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === "--timeout" && argv[i + 1] != null) {
            sec = parseInt(argv[i + 1], 10);
            if (sec <= 0)
                sec = MAX_SAFE_TIMEOUT_SEC; // 0 或 -1 表示永不过期
            else if (Number.isNaN(sec))
                sec = 60;
            break;
        }
        if (argv[i].startsWith("--timeout=")) {
            sec = parseInt(argv[i].replace(/^--timeout=/, ""), 10);
            if (sec <= 0)
                sec = MAX_SAFE_TIMEOUT_SEC;
            else if (Number.isNaN(sec))
                sec = 60;
            break;
        }
    }
    return Math.min(sec, MAX_SAFE_TIMEOUT_SEC);
}
async function verifyFeishuCredentials(appId, appSecret) {
    try {
        const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        });
        const data = (await res.json());
        if (data.code === 0)
            return { ok: true };
        return { ok: false, message: data.msg || "获取 token 失败" };
    }
    catch (e) {
        return { ok: false, message: e.message };
    }
}
async function checkEnv() {
    const cfg = mb.getConfig();
    const appId = process.env.FEISHU_APP_ID || process.env.DITING_FEISHU_APP_ID || cfg.appId;
    const appSecret = process.env.FEISHU_APP_SECRET || process.env.DITING_FEISHU_APP_SECRET || cfg.appSecret;
    const chatId = process.env.FEISHU_CHAT_ID || process.env.DITING_FEISHU_CHAT_ID || cfg.chatId;
    const ok = (v) => v && String(v).trim().length > 0;
    const mask = (v) => (v && v.length > 8 ? v.slice(0, 4) + "***" + v.slice(-2) : "(未设置)");
    const fromFile = !process.env.FEISHU_APP_ID && !process.env.DITING_FEISHU_APP_ID && cfg.appId ? " (来自 ~/.message-bridge/config.json)" : "";
    console.log("飞书配置自检\n");
    console.log("  App ID:", ok(appId) ? mask(appId) + " ✓" + fromFile : "未设置 ✗");
    console.log("  App Secret:", ok(appSecret) ? "*** ✓" + fromFile : "未设置 ✗");
    console.log("  Chat ID (群聊/私聊会话):", ok(chatId) ? mask(chatId) + " ✓" : "未设置 ✗");
    if (ok(appId) && ok(appSecret) && !ok(chatId)) {
        const verify = await verifyFeishuCredentials(appId, appSecret);
        if (!verify.ok) {
            console.log("\n  凭证校验: ✗ 无效或网络错误");
            console.log("  当前使用的 App ID:", appId);
            console.log("  App Secret 长度:", appSecret.length, "字符");
            console.log("  飞书返回错误:", verify.message || "(无详情)");
            console.log("\n❌ 请核对飞书开放平台「凭证与基础信息」中的 App ID / App Secret，或检查网络。");
            process.exit(1);
        }
        console.log("  凭证校验: ✓ 有效（仅缺 Chat ID）");
    }
    const allOk = ok(appId) && ok(appSecret) && ok(chatId);
    if (allOk) {
        console.log("\n✅ 配置完整。可运行: npx skill-message-bridge send \"测试\"");
        process.exit(0);
    }
    else {
        console.log("\n❌ 请补全上述缺失项。");
        if (!ok(appId) || !ok(appSecret)) {
            console.log("  使用 npx 配置: npx skill-message-bridge config set feishu --app-id=xxx --app-secret=xxx");
        }
        else {
            console.log("  获取 Chat ID: npx skill-message-bridge connect，在群聊或私聊中向机器人发一条消息后按提示保存。");
        }
        console.log("  完整步骤见 docs/ONBOARDING-FEISHU.md");
        process.exit(1);
    }
}
function help() {
    console.log(`
skill-message-bridge（青鸟）— 飞书/钉钉/企微 消息桥梁（npx 优先，无需安装）

用法:
  npx skill-message-bridge <消息>              发到飞书并等待回复（默认 notify）
  npx skill-message-bridge notify <消息> [--timeout=N]  同上，可指定超时秒数
  npx skill-message-bridge --heartbeat [--timeout=N]  仅等待下一条消息，不向飞书推送（心跳）
  npx skill-message-bridge install [--target=cursor|codex|claude-code|vscode] [--global] [--dir=/path]  将本 skill 安装到目标工具（已知 target 按规则存放；未知用 --dir 指定 skills 根目录）
  npx skill-message-bridge send <消息>        只发送，不等待回复
  npx skill-message-bridge check-env          检查配置（环境变量或 ~/.message-bridge/config.json）
  npx skill-message-bridge config set feishu [--app-id=xxx] [--app-secret=xxx] [--chat-id=xxx]  写入配置（缺省项可交互输入）
  npx skill-message-bridge config show        查看当前配置（脱敏）
  npx skill-message-bridge config path       显示配置文件路径
  npx skill-message-bridge connect           启动长连接，收到首条消息（群聊或私聊）后输出 chat_id 并提示保存
  npx skill-message-bridge --help | -h       本帮助

配置: 优先使用环境变量 FEISHU_* / DITING_FEISHU_*；否则使用 ~/.message-bridge/config.json
首次使用与 Channel 选择: 见 SKILL.md「首次使用引导」；飞书完整引导见 docs/ONBOARDING-FEISHU.md
`);
    process.exit(0);
}
async function main() {
    const argv = process.argv.slice();
    const a0 = argv[2];
    if (!a0 || a0 === "--help" || a0 === "-h") {
        help();
        return;
    }
    if (a0 === "check-env") {
        await checkEnv();
        return;
    }
    if (a0 === "config") {
        const sub = argv[3];
        if (sub === "set") {
            const channel = argv[4];
            if (channel !== "feishu") {
                console.error("当前仅支持 feishu。其他 channel 请到 GitHub 提 issue：https://github.com/hulk-yin/message-bridge/issues");
                process.exit(1);
            }
            let opts = parseConfigSetArgs(argv);
            const hasAnyArg = (opts.appId && opts.appId.length > 0) || (opts.appSecret && opts.appSecret.length > 0) || (opts.chatId && opts.chatId.length > 0);
            if (!hasAnyArg && !process.stdin.isTTY) {
                console.error("未检测到交互终端，未传入任何参数。");
                console.error("要看到「请输入 App ID」等交互式引导，请在本机终端中亲自执行（不要通过助手代跑）：");
                console.error("  cd " + path.dirname(__dirname) + " && npm run dev:cli -- config set feishu");
                console.error("或直接传参：npx skill-message-bridge config set feishu --app-id=xxx --app-secret=xxx [--chat-id=xxx]");
                process.exit(1);
            }
            const data = loadConfigFile();
            if (!data.feishu)
                data.feishu = {};
            const existing = data.feishu;
            const mask = (v) => (v && v.length > 8 ? v.slice(0, 4) + "***" + v.slice(-2) : v && v.length > 0 ? v.slice(0, 2) + "***" : "");
            if (process.stdin.isTTY && !hasAnyArg) {
                console.log("未传入参数，进入交互式输入（已有项直接回车保留）\n");
            }
            if (process.stdin.isTTY) {
                if (opts.appId === undefined || opts.appId === "") {
                    const label = existing.appId ? `请输入 App ID (当前: ${mask(existing.appId)}，直接回车保留): ` : "请输入 App ID: ";
                    const answer = (await prompt(label)).trim();
                    opts.appId = answer || existing.appId || "";
                }
                if (opts.appSecret === undefined || opts.appSecret === "") {
                    const label = existing.appSecret ? "请输入 App Secret (已设置，直接回车保留): " : "请输入 App Secret: ";
                    const answer = (await prompt(label, { mask: true })).trim();
                    opts.appSecret = answer || existing.appSecret || "";
                }
                if (opts.chatId === undefined || opts.chatId === "") {
                    if (existing.chatId) {
                        const label = `当前已配置 Chat ID (${mask(existing.chatId)})。直接回车保留，输入 1 或 new 重新配对: `;
                        const answer = (await prompt(label)).trim().toLowerCase();
                        if (answer === "1" || answer === "new") {
                            opts.chatId = ""; // 表示要求重新配对，下面会清空并进入 connect
                        }
                        else if (answer) {
                            opts.chatId = answer;
                        }
                        else {
                            opts.chatId = existing.chatId;
                        }
                    }
                    else {
                        const chatId = await prompt("请输入 Chat ID（可选，直接回车则进入配对获取）: ");
                        if (chatId)
                            opts.chatId = chatId.trim();
                    }
                }
            }
            if (!data.feishu)
                data.feishu = {};
            if (opts.appId !== undefined && opts.appId !== "")
                data.feishu.appId = opts.appId;
            if (opts.appSecret !== undefined && opts.appSecret !== "")
                data.feishu.appSecret = opts.appSecret;
            if (opts.chatId !== undefined) {
                if (opts.chatId === "")
                    delete data.feishu.chatId;
                else if (opts.chatId)
                    data.feishu.chatId = opts.chatId;
            }
            saveConfigFile(data);
            console.log("已写入 " + CONFIG_PATH);
            if (opts.chatId && opts.chatId !== "") {
                console.log("chat_id 已保存，可运行 npx skill-message-bridge send \"测试\" 验证。");
                process.exit(0);
            }
            if (process.stdin.isTTY) {
                console.log("\n" + (existing.chatId && (opts.chatId === "" || !opts.chatId) ? "将重新配对会话。" : "尚未配置 Chat ID，") + "接下来将自动进入 connect 模式以获取 chat_id。\n");
                mb.runConnectMode()
                    .then(async (chatId) => {
                    try {
                        await mb.send({ message: FEISHU_PAIRING_SUCCESS_GUIDE, groupId: chatId });
                    }
                    catch {
                        // 发送引导失败仍自动保存并提示
                    }
                    const cfg = loadConfigFile();
                    if (!cfg.feishu)
                        cfg.feishu = {};
                    cfg.feishu.chatId = chatId;
                    saveConfigFile(cfg);
                    console.log("\n已收到首条消息，会话 chat_id（群聊/私聊均可）:", chatId);
                    console.log("已自动保存到 " + CONFIG_PATH + "，可运行 npx skill-message-bridge send \"测试\" 验证。");
                    mb.close();
                    process.exit(0);
                })
                    .catch((err) => {
                    console.error("连接或接收失败:", err.message);
                    console.log("若无法收到消息，请先在飞书开放平台完成「事件订阅」→ 选择「长连接」→ 订阅 im.message.receive_v1。");
                    mb.close();
                    process.exit(1);
                });
                return;
            }
            // 非交互环境下，仅提醒后退出
            console.log("尚未配置 Chat ID。可稍后运行: npx skill-message-bridge connect，在群聊或私聊中向机器人发送任意一条消息后按提示保存。");
            process.exit(0);
        }
        if (sub === "show") {
            const data = loadConfigFile();
            const f = data.feishu || {};
            const mask = (v) => (v && v.length > 0 ? (v.length > 8 ? v.slice(0, 4) + "***" + v.slice(-2) : v.slice(0, 2) + "***") : "(未设置)");
            console.log("feishu:");
            console.log("  appId:", f.appId ? mask(f.appId) : "(未设置)");
            console.log("  appSecret:", f.appSecret ? "***" : "(未设置)");
            console.log("  chatId:", f.chatId ? mask(f.chatId) : "(未设置)");
            process.exit(0);
        }
        if (sub === "path") {
            console.log(CONFIG_PATH);
            process.exit(0);
        }
        console.error("用法: config set feishu --app-id=xxx --app-secret=xxx [--chat-id=xxx] | config show | config path");
        process.exit(1);
    }
    if (a0 === "install") {
        const getOpt = (name) => {
            for (let i = 0; i < argv.length; i++) {
                if (argv[i] === `--${name}` && argv[i + 1] != null)
                    return argv[i + 1];
                if (argv[i].startsWith(`--${name}=`))
                    return argv[i].replace(new RegExp(`^--${name}=`), "");
            }
            return undefined;
        };
        const dir = getOpt("dir");
        const targetOpt = getOpt("target");
        const globalFlag = argv.includes("--global");
        const doInstall = (destDir) => {
            if (fs.existsSync(destDir)) {
                console.error("目标已存在: " + destDir + "，请先删除或选择其他路径");
                process.exit(1);
            }
            fs.mkdirSync(path.dirname(destDir), { recursive: true });
            console.log("安装到: " + destDir);
            (0, child_process_1.execSync)(`git clone --depth 1 ${REPO_URL} "${destDir}"`, { stdio: "inherit" });
            (0, child_process_1.execSync)("npm install", { cwd: destDir, stdio: "inherit" });
            (0, child_process_1.execSync)("npm run build", { cwd: destDir, stdio: "inherit" });
            console.log("安装完成。请重启对应 IDE 或重新加载 skills，并配置飞书环境变量（见 docs/ONBOARDING-FEISHU.md）。");
            process.exit(0);
        };
        if (dir) {
            doInstall(path.resolve(dir, "message-bridge"));
            return;
        }
        if (targetOpt) {
            const target = targetOpt.toLowerCase();
            if (target === "cursor") {
                doInstall(globalFlag
                    ? path.join(os.homedir(), ".cursor", "skills", "message-bridge")
                    : path.join(process.cwd(), ".cursor", "skills", "message-bridge"));
            }
            else if (target === "codex") {
                const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
                doInstall(path.join(codexHome, "skills", "message-bridge"));
            }
            else if (target === "claude-code" || target === "vscode") {
                doInstall(path.join(os.homedir(), ".claude", "skills", "message-bridge"));
            }
            else {
                console.error("未知 target，请用 1–5 选择或 --dir=/path");
                process.exit(1);
            }
            return;
        }
        const runInteractive = async () => {
            const { default: select } = await Promise.resolve().then(() => __importStar(require("@inquirer/select")));
            const choice = await select({
                message: "请选择要安装到的工具（方向键选择，回车确认）",
                choices: [
                    { value: "cursor-project", name: "Cursor（当前项目 .cursor/skills）" },
                    { value: "cursor-global", name: "Cursor（用户级，所有项目可用）" },
                    { value: "codex", name: "Codex（$CODEX_HOME/skills）" },
                    { value: "claude-vscode", name: "Claude Code / VS Code（~/.claude/skills）" },
                    { value: "other", name: "其他（手动输入 skills 根目录路径）" },
                ],
            });
            if (choice === "cursor-project")
                return path.join(process.cwd(), ".cursor", "skills", "message-bridge");
            if (choice === "cursor-global")
                return path.join(os.homedir(), ".cursor", "skills", "message-bridge");
            if (choice === "codex")
                return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills", "message-bridge");
            if (choice === "claude-vscode")
                return path.join(os.homedir(), ".claude", "skills", "message-bridge");
            const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
            const pathAnswer = await new Promise((res) => rl2.question("请输入 skills 根目录路径: ", (a) => { rl2.close(); res((a || "").trim()); }));
            if (!pathAnswer)
                throw new Error("未输入路径，已取消");
            return path.resolve(pathAnswer, "message-bridge");
        };
        runInteractive()
            .then(doInstall)
            .catch((err) => { console.error(err.message); process.exit(1); });
        return;
    }
    if (a0 === "connect") {
        console.log("正在启动飞书长连接…\n");
        mb.runConnectMode()
            .then(async (chatId) => {
            try {
                await mb.send({ message: FEISHU_PAIRING_SUCCESS_GUIDE, groupId: chatId });
            }
            catch {
                // 发送引导失败仍自动保存并提示
            }
            const cfg = loadConfigFile();
            if (!cfg.feishu)
                cfg.feishu = {};
            cfg.feishu.chatId = chatId;
            saveConfigFile(cfg);
            console.log("\n已收到首条消息，会话 chat_id（群聊/私聊均可）:", chatId);
            console.log("已自动保存到 " + CONFIG_PATH + "，可运行 npx skill-message-bridge send \"测试\" 验证。");
            mb.close();
            process.exit(0);
        })
            .catch((err) => {
            console.error("连接或接收失败:", err.message);
            console.log("若无法收到消息，请先在飞书开放平台完成「事件订阅」→ 选择「长连接」→ 订阅 im.message.receive_v1。");
            mb.close();
            process.exit(1);
        });
        return;
    }
    if (a0 === "send") {
        const message = getMessageFromArgv(argv, 3);
        if (!message) {
            console.error("错误: 请提供消息，例如 npx skill-message-bridge send \"内容\"");
            process.exit(1);
        }
        try {
            const result = await mb.send({ message });
            console.log(JSON.stringify(result));
            process.exit(0);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
        finally {
            mb.close();
        }
        return;
    }
    if (a0 === "notify") {
        const timeout = parseTimeout(argv);
        const message = getMessageFromArgv(argv, 3);
        if (!message) {
            console.error("错误: 请提供消息，例如 npx skill-message-bridge notify \"内容\" [--timeout=60]");
            process.exit(1);
        }
        try {
            const result = await mb.notify({ message, timeout });
            const out = {
                status: result.status || "error",
                reply: result.reply || "",
                replyUser: result.replyUser || "",
                sessionHint: sessionHint(result.status || "error", result.reply || ""),
            };
            if (result.error)
                out.error = result.error;
            console.log(JSON.stringify(out));
            printSessionReminder();
            process.exit(result.status === "replied" ? 0 : 1);
        }
        catch (err) {
            const errOut = { status: "error", reply: "", error: err.message, sessionHint: SESSION_HINT_CONTINUE };
            console.log(JSON.stringify(errOut));
            printSessionReminder();
            process.exit(1);
        }
        finally {
            mb.close();
        }
        return;
    }
    if (argv.includes("--heartbeat")) {
        const timeout = parseTimeout(argv);
        try {
            const result = await mb.waitNextMessage(timeout);
            const out = {
                status: result.status || "error",
                reply: result.reply || "",
                replyUser: result.replyUser || "",
                sessionHint: SESSION_HINT_CONTINUE,
            };
            if (result.error)
                out.error = result.error;
            console.log(JSON.stringify(out));
            printSessionReminder();
            process.exit(result.status === "replied" ? 0 : 1);
        }
        catch (err) {
            const errOut = { status: "error", reply: "", error: err.message, sessionHint: SESSION_HINT_CONTINUE };
            console.log(JSON.stringify(errOut));
            printSessionReminder();
            process.exit(1);
        }
        finally {
            mb.close();
        }
        return;
    }
    const message = getMessageFromArgv(argv, 2);
    if (!message) {
        console.log(JSON.stringify({ status: "error", reply: "", error: "empty message" }));
        process.exit(1);
    }
    try {
        const result = await mb.notify({ message, timeout: FEISHU_TURN_TIMEOUT });
        const out = {
            status: result.status || "error",
            reply: result.reply || "",
            replyUser: result.replyUser || "",
            sessionHint: sessionHint(result.status || "error", result.reply || ""),
        };
        if (result.error)
            out.error = result.error;
        console.log(JSON.stringify(out));
        printSessionReminder();
        process.exit(result.status === "replied" ? 0 : 1);
    }
    catch (err) {
        const errOut = { status: "error", reply: "", error: err.message, sessionHint: SESSION_HINT_CONTINUE };
        console.log(JSON.stringify(errOut));
        printSessionReminder();
        process.exit(1);
    }
    finally {
        mb.close();
    }
}
main();
