"use strict";
/**
 * MessageBridge Skill - 统一实现（TypeScript）
 * 使用飞书 WebSocket 长连接。配置：环境变量 或 ~/.message-bridge/config.json
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
exports.description = exports.name = void 0;
exports.getConfig = getConfig;
exports.setFirstMessageResolver = setFirstMessageResolver;
exports.waitNextMessage = waitNextMessage;
exports.init = init;
exports.notify = notify;
exports.send = send;
exports.close = close;
exports.runConnectMode = runConnectMode;
const lark = __importStar(require("@larksuiteoapi/node-sdk"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
function loadConfigFromFile() {
    const configPath = path.join(os.homedir(), ".message-bridge", "config.json");
    try {
        const raw = fs.readFileSync(configPath, "utf8");
        const data = JSON.parse(raw);
        return data.feishu || {};
    }
    catch {
        return {};
    }
}
const fileCfg = loadConfigFromFile();
const config = {
    appId: process.env.FEISHU_APP_ID || process.env.DITING_FEISHU_APP_ID || fileCfg.appId || "",
    appSecret: process.env.FEISHU_APP_SECRET || process.env.DITING_FEISHU_APP_SECRET || fileCfg.appSecret || "",
    chatId: process.env.FEISHU_CHAT_ID || process.env.DITING_FEISHU_CHAT_ID || fileCfg.chatId || "",
};
function getConfig() {
    return { ...config };
}
let firstMessageResolver = null;
function setFirstMessageResolver(resolver) {
    firstMessageResolver = resolver;
}
let waitNextResolver = null;
let waitNextTimer = null;
function clearWaitNext() {
    if (waitNextTimer)
        clearTimeout(waitNextTimer);
    waitNextTimer = null;
    waitNextResolver = null;
}
/** 仅等待下一条消息，不向用户推送任何内容（用于心跳）。超时也 resolve 为 status "timeout"，与 notify 一致。 */
function waitNextMessage(timeoutSec) {
    const cap = Math.min(timeoutSec, 2147483);
    return new Promise((resolve) => {
        waitNextResolver = (r) => {
            clearWaitNext();
            resolve({ success: true, status: "replied", reply: r.reply, replyUser: r.replyUser });
        };
        waitNextTimer = setTimeout(() => {
            clearWaitNext();
            resolve({ success: true, status: "timeout", error: "Timeout waiting for reply" });
        }, cap * 1000);
        init();
    });
}
let httpClient = null;
let wsClient = null;
let eventDispatcher = null;
let isInitialized = false;
const pendingTasks = new Map();
async function init() {
    if (isInitialized)
        return;
    process.stderr.write("[MessageBridge] 初始化...\n");
    httpClient = new lark.Client({
        appId: config.appId,
        appSecret: config.appSecret,
        appType: lark.AppType.SelfBuild,
        domain: lark.Domain.Feishu,
    });
    eventDispatcher = new lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (data) => {
            const message = data.message;
            try {
                const content = JSON.parse(message.content);
                const senderId = message.sender?.sender_id?.open_id || message.sender?.sender_id?.user_id || "unknown";
                const text = content.text || "";
                process.stderr.write(`[MessageBridge] 收到消息: ${text} (from ${senderId})\n`);
                for (const [, task] of pendingTasks.entries()) {
                    if (task.status === "pending") {
                        task.reply = text;
                        task.replyUser = senderId;
                        task.status = "resolved";
                        task.repliedAt = new Date();
                        if (task.resolve)
                            task.resolve(task);
                        process.stderr.write(`[MessageBridge] 任务 ${task.taskId} 已解决\n`);
                        break;
                    }
                }
                const chatId = message.chat_id || (message.chat && message.chat.chat_id) || data.chat_id;
                if (firstMessageResolver && chatId) {
                    firstMessageResolver(chatId);
                    firstMessageResolver = null;
                }
                else if (waitNextResolver) {
                    waitNextResolver({ reply: text, replyUser: senderId });
                    clearWaitNext();
                }
            }
            catch (error) {
                console.error("[MessageBridge] 处理消息失败:", error.message);
            }
            return { code: 0 };
        },
    });
    wsClient = new lark.WSClient({
        appId: config.appId,
        appSecret: config.appSecret,
        loggerLevel: lark.LoggerLevel.error,
    });
    wsClient.start({ eventDispatcher: eventDispatcher });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    isInitialized = true;
    process.stderr.write("[MessageBridge] 初始化完成\n");
    process.stderr.write("[MessageBridge] 请到飞书群聊或私聊中向机器人发送任意一条消息，收到后我会在飞书回复并说明后续用法。\n");
}
async function notify(params) {
    const { message, platform = "feishu", userId, groupId, timeout = 60 } = params;
    await init();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
        taskId,
        message,
        platform,
        userId,
        groupId,
        timeout,
        status: "pending",
        createdAt: new Date(),
        reply: null,
        replyUser: null,
        repliedAt: null,
    };
    pendingTasks.set(taskId, task);
    try {
        const targetId = groupId || config.chatId || userId || "";
        const receiveIdType = groupId || config.chatId ? "chat_id" : "open_id";
        process.stderr.write(`[MessageBridge] 发送消息 (${receiveIdType}): ${message}\n`);
        const res = await httpClient.im.message.create({
            params: { receive_id_type: receiveIdType },
            data: {
                receive_id: targetId,
                msg_type: "text",
                content: JSON.stringify({ text: message }),
            },
        });
        if (res.code !== 0)
            throw new Error(`发送失败: ${res.msg}`);
        const mid = res.data?.message_id ?? "";
        process.stderr.write(`[MessageBridge] 消息已发送: ${mid}\n`);
        const result = await new Promise((resolve, reject) => {
            task.resolve = resolve;
            task.reject = reject;
            setTimeout(() => {
                if (task.status === "pending") {
                    task.status = "timeout";
                    reject(new Error("Timeout waiting for reply"));
                }
            }, timeout * 1000);
        });
        pendingTasks.delete(taskId);
        return {
            success: true,
            reply: result.reply || "",
            replyUser: result.replyUser || "",
            timestamp: result.repliedAt?.toISOString(),
            status: "replied",
        };
    }
    catch (error) {
        pendingTasks.delete(taskId);
        const msg = error.message;
        if (msg.includes("Timeout")) {
            return { success: true, status: "timeout", error: msg };
        }
        return { success: false, status: "error", error: msg };
    }
}
async function send(params) {
    const { message, platform = "feishu", userId, groupId } = params;
    await init();
    try {
        const targetId = groupId || config.chatId || userId || "";
        const receiveIdType = groupId || config.chatId ? "chat_id" : "open_id";
        process.stderr.write(`[MessageBridge] 发送消息 (${receiveIdType}): ${message}\n`);
        const res = await httpClient.im.message.create({
            params: { receive_id_type: receiveIdType },
            data: {
                receive_id: targetId,
                msg_type: "text",
                content: JSON.stringify({ text: message }),
            },
        });
        if (res.code !== 0)
            throw new Error(`发送失败: ${res.msg}`);
        const messageId = res.data?.message_id ?? "";
        process.stderr.write(`[MessageBridge] 消息已发送: ${messageId}\n`);
        return { success: true, messageId };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
function close() {
    if (wsClient)
        process.stderr.write("[MessageBridge] 关闭连接\n");
    isInitialized = false;
}
function runConnectMode() {
    return new Promise((resolve) => {
        setFirstMessageResolver(resolve);
        init();
    });
}
exports.name = "messageBridge";
exports.description = "AI 智能体的消息桥梁，连接飞书/钉钉/企微，实现异步通知与确认";
exports.default = {
    init,
    notify,
    send,
    close,
    getConfig,
    runConnectMode,
    setFirstMessageResolver,
    waitNextMessage,
    name: exports.name,
    description: exports.description,
};
