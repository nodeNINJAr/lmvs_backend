import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { adminChat, type ChatMessage } from '../services/chat.service';

export async function chat(req: AuthRequest, res: Response) {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string') {
    throw Object.assign(new Error('message is required'), { status: 400 });
  }

  const safeHistory: ChatMessage[] = Array.isArray(history)
    ? history
        .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .map((h: any) => ({ role: h.role, content: h.content }))
    : [];

  const reply = await adminChat(message, safeHistory);
  res.json({ reply });
}
