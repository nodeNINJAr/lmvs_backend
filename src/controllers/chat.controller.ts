import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { adminChat, workerChat, type ChatMessage } from '../services/chat.service';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 10;

function parseHistory(history: unknown): ChatMessage[] {
  return Array.isArray(history)
    ? history
        .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .slice(-MAX_HISTORY)
        .map((h: any) => ({ role: h.role, content: h.content.slice(0, MAX_MESSAGE_LENGTH) }))
    : [];
}

function parseMessage(message: unknown): string {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw Object.assign(new Error('message is required'), { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw Object.assign(new Error(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer`), { status: 400 });
  }
  return message.trim();
}

export async function chat(req: AuthRequest, res: Response) {
  const message = parseMessage(req.body.message);
  const reply = await adminChat(message, parseHistory(req.body.history));
  res.json({ reply });
}

export async function workerChatHandler(req: AuthRequest, res: Response) {
  const message = parseMessage(req.body.message);
  const reply = await workerChat(req.user!.id, message, parseHistory(req.body.history));
  res.json({ reply });
}
