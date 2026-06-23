import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { adminChat, workerChat, type ChatMessage } from '../services/chat.service';

function parseHistory(history: unknown): ChatMessage[] {
  return Array.isArray(history)
    ? history
        .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .map((h: any) => ({ role: h.role, content: h.content }))
    : [];
}

export async function chat(req: AuthRequest, res: Response) {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string') {
    throw Object.assign(new Error('message is required'), { status: 400 });
  }

  const reply = await adminChat(message, parseHistory(history));
  res.json({ reply });
}

export async function workerChatHandler(req: AuthRequest, res: Response) {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string') {
    throw Object.assign(new Error('message is required'), { status: 400 });
  }

  const reply = await workerChat(req.user!.id, message, parseHistory(history));
  res.json({ reply });
}
