import OpenAI from 'openai';
import { UserModel, QRCodeRecordModel } from '../models';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Snapshot of worker data + stats the admin chat assistant is allowed to see. */
async function buildContext() {
  const workers = await UserModel.find({ role: 'WORKER' })
    .select('fullName phone profileStatus trustScore occupation countryOfEmployment nidNumber passportNumber createdAt')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();

  const ids = workers.map((w) => w._id);
  const qrs = await QRCodeRecordModel.find({ userId: { $in: ids }, status: 'ACTIVE' })
    .select('userId serial')
    .lean();
  const qrByUser = new Map(qrs.map((q) => [String(q.userId), q.serial]));

  const workerSummaries = workers.map((w) => ({
    name: w.fullName || null,
    phone: w.phone,
    status: w.profileStatus,
    trustScore: w.trustScore,
    occupation: w.occupation || null,
    destination: w.countryOfEmployment || null,
    nidNumber: w.nidNumber || null,
    passportNumber: w.passportNumber || null,
    qrSerial: qrByUser.get(String(w._id)) || null,
    registeredAt: (w as any).createdAt,
  }));

  const stats = {
    totalWorkers: workers.length,
    verified: workers.filter((w) => w.profileStatus === 'VERIFIED').length,
    rejected: workers.filter((w) => w.profileStatus === 'REJECTED').length,
    underReview: workers.filter((w) => w.profileStatus === 'REVIEW_REQUIRED').length,
    submitted: workers.filter((w) => w.profileStatus === 'SUBMITTED').length,
    qrIssued: qrByUser.size,
  };

  return { workerSummaries, stats };
}

/** Answer an admin's question about workers/stats, grounded only in the current DB snapshot. */
export async function adminChat(message: string, history: ChatMessage[] = []) {
  const { workerSummaries, stats } = await buildContext();

  const systemPrompt = `You are an assistant embedded in the LMVS (Labor Migration Verification System) admin dashboard.
Answer the admin's questions using ONLY the data provided below — never invent worker details that
aren't present. If the data doesn't contain what's asked, say so plainly. Be concise; use short lists
for multi-worker answers. Trust scores are 0-100. Statuses are one of: DRAFT, SUBMITTED, UNDER_REVIEW,
REVIEW_REQUIRED, VERIFIED, REJECTED.

STATS: ${JSON.stringify(stats)}

WORKERS: ${JSON.stringify(workerSummaries)}`;

  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content }) as const),
      { role: 'user', content: message },
    ],
  });

  return resp.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
}
