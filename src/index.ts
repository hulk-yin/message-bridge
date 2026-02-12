/**
 * MessageBridge Skill - 统一实现（TypeScript）
 * 使用飞书 WebSocket 长连接。配置：环境变量 或 ~/.message-bridge/config.json
 */

import * as lark from "@larksuiteoapi/node-sdk";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export interface NotifyParams {
  message: string;
  platform?: string;
  userId?: string;
  groupId?: string;
  timeout?: number;
}

export interface NotifyResult {
  success: boolean;
  status: "replied" | "timeout" | "error";
  reply?: string;
  replyUser?: string;
  timestamp?: string;
  error?: string;
}

export interface SendParams {
  message: string;
  platform?: string;
  userId?: string;
  groupId?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface PendingTask {
  taskId: string;
  message: string;
  platform: string;
  userId?: string;
  groupId?: string;
  timeout: number;
  status: string;
  createdAt: Date;
  reply: string | null;
  replyUser: string | null;
  repliedAt: Date | null;
  resolve?: (t: PendingTask) => void;
  reject?: (err: Error) => void;
}

function loadConfigFromFile(): Record<string, string> {
  const configPath = path.join(os.homedir(), ".message-bridge", "config.json");
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const data = JSON.parse(raw) as { feishu?: Record<string, string> };
    return data.feishu || {};
  } catch {
    return {};
  }
}

const fileCfg = loadConfigFromFile();
const config = {
  appId: process.env.FEISHU_APP_ID || process.env.DITING_FEISHU_APP_ID || fileCfg.appId || "",
  appSecret: process.env.FEISHU_APP_SECRET || process.env.DITING_FEISHU_APP_SECRET || fileCfg.appSecret || "",
  chatId: process.env.FEISHU_CHAT_ID || process.env.DITING_FEISHU_CHAT_ID || fileCfg.chatId || "",
};

export function getConfig(): { appId: string; appSecret: string; chatId: string } {
  return { ...config };
}

let firstMessageResolver: ((chatId: string) => void) | null = null;
export function setFirstMessageResolver(resolver: (chatId: string) => void): void {
  firstMessageResolver = resolver;
}

let waitNextResolver: ((r: { reply: string; replyUser: string }) => void) | null = null;
let waitNextTimer: ReturnType<typeof setTimeout> | null = null;
function clearWaitNext(): void {
  if (waitNextTimer) clearTimeout(waitNextTimer);
  waitNextTimer = null;
  waitNextResolver = null;
}
/** 仅等待下一条消息，不向用户推送任何内容（用于心跳）。超时也 resolve 为 status "timeout"，与 notify 一致。 */
export function waitNextMessage(timeoutSec: number): Promise<NotifyResult> {
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

let httpClient: lark.Client | null = null;
let wsClient: lark.WSClient | null = null;
let eventDispatcher: lark.EventDispatcher | null = null;
let isInitialized = false;
const pendingTasks = new Map<string, PendingTask>();

export async function init(): Promise<void> {
  if (isInitialized) return;

  process.stderr.write("[MessageBridge] 初始化...\n");

  httpClient = new lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  eventDispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data: { message: Record<string, unknown> }) => {
      const message = data.message as {
        content: string;
        sender?: { sender_id?: { open_id?: string; user_id?: string } };
        chat_id?: string;
        chat?: { chat_id?: string };
      };
      try {
        const content = JSON.parse(message.content) as { text?: string };
        const senderId = message.sender?.sender_id?.open_id || message.sender?.sender_id?.user_id || "unknown";
        const text = content.text || "";
        process.stderr.write(`[MessageBridge] 收到消息: ${text} (from ${senderId})\n`);

        for (const [, task] of pendingTasks.entries()) {
          if (task.status === "pending") {
            task.reply = text;
            task.replyUser = senderId;
            task.status = "resolved";
            task.repliedAt = new Date();
            if (task.resolve) task.resolve(task);
            process.stderr.write(`[MessageBridge] 任务 ${task.taskId} 已解决\n`);
            break;
          }
        }

        const chatId = message.chat_id || (message.chat && message.chat.chat_id) || (data as { chat_id?: string }).chat_id;
        if (firstMessageResolver && chatId) {
          firstMessageResolver(chatId);
          firstMessageResolver = null;
        } else if (waitNextResolver) {
          waitNextResolver({ reply: text, replyUser: senderId });
          clearWaitNext();
        }
      } catch (error) {
        console.error("[MessageBridge] 处理消息失败:", (error as Error).message);
      }
      return { code: 0 };
    },
  });

  wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    loggerLevel: lark.LoggerLevel.error,
  });

  wsClient.start({ eventDispatcher: eventDispatcher! });
  await new Promise((resolve) => setTimeout(resolve, 2000));

  isInitialized = true;
  process.stderr.write("[MessageBridge] 初始化完成\n");
  process.stderr.write("[MessageBridge] 请到飞书群聊或私聊中向机器人发送任意一条消息，收到后我会在飞书回复并说明后续用法。\n");
}

export async function notify(params: NotifyParams): Promise<NotifyResult> {
  const { message, platform = "feishu", userId, groupId, timeout = 60 } = params;

  await init();

  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const task: PendingTask = {
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

    const res = await httpClient!.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: targetId,
        msg_type: "text",
        content: JSON.stringify({ text: message }),
      },
    });

    if (res.code !== 0) throw new Error(`发送失败: ${res.msg}`);
    const mid = (res as { data?: { message_id?: string } }).data?.message_id ?? "";
    process.stderr.write(`[MessageBridge] 消息已发送: ${mid}\n`);

    const result = await new Promise<PendingTask>((resolve, reject) => {
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
  } catch (error) {
    pendingTasks.delete(taskId);
    const msg = (error as Error).message;
    if (msg.includes("Timeout")) {
      return { success: true, status: "timeout", error: msg };
    }
    return { success: false, status: "error", error: msg };
  }
}

export async function send(params: SendParams): Promise<SendResult> {
  const { message, platform = "feishu", userId, groupId } = params;

  await init();

  try {
    const targetId = groupId || config.chatId || userId || "";
    const receiveIdType = groupId || config.chatId ? "chat_id" : "open_id";
    process.stderr.write(`[MessageBridge] 发送消息 (${receiveIdType}): ${message}\n`);

    const res = await httpClient!.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: targetId,
        msg_type: "text",
        content: JSON.stringify({ text: message }),
      },
    });

    if (res.code !== 0) throw new Error(`发送失败: ${res.msg}`);
    const messageId = (res as { data?: { message_id?: string } }).data?.message_id ?? "";
    process.stderr.write(`[MessageBridge] 消息已发送: ${messageId}\n`);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function close(): void {
  if (wsClient) process.stderr.write("[MessageBridge] 关闭连接\n");
  isInitialized = false;
}

export function runConnectMode(): Promise<string> {
  return new Promise((resolve) => {
    setFirstMessageResolver(resolve);
    init();
  });
}

export const name = "messageBridge";
export const description = "AI 智能体的消息桥梁，连接飞书/钉钉/企微，实现异步通知与确认";

export default {
  init,
  notify,
  send,
  close,
  getConfig,
  runConnectMode,
  setFirstMessageResolver,
  waitNextMessage,
  name,
  description,
};
