import OpenAI from 'openai';
import { UserModel, QRCodeRecordModel, DocumentModel, VerificationResultModel } from '../models';

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

const DOC_GUIDE = `Accepted document types: NID, PASSPORT, SKILL_CERTIFICATE, TRAINING_CERTIFICATE,
EXPERIENCE_CERTIFICATE, PHOTO. Each upload must be a clear image (PNG/JPG) of the original document —
no PDFs, no screenshots of screenshots, no edited/cropped-over text.

How verification works: (1) AI reads the document and extracts the name/NID/passport/DOB/certificate
number printed on it. (2) That extracted data is cross-checked against the relevant external/issuer
source. (3) The submitted profile data, the extracted data, and the external data are compared.

Why documents get rejected or held for review, and how to avoid it:
- Name, date of birth, NID number, or passport number on the document must match what was entered at
  registration EXACTLY (minor transliteration spelling differences are tolerated, typos are not).
- The document image must be sharp, well-lit, and fully legible — blurry or cropped photos lower the
  AI's extraction confidence and can cause a REVIEW_REQUIRED or REJECTED result.
- The document must show no visible signs of tampering or editing.
- If the external/issuer source has no record matching the extracted details, the result becomes
  REVIEW_REQUIRED even if the document itself looks fine — this usually needs an admin to manually
  confirm it.
- A REJECTED status can be manually overridden by an admin after manual review (this also shows up as
  a separate "verified manually by admin" entry).`;

/** Answer a worker's question about how the platform works, and about THEIR OWN documents/status only. */
export async function workerChat(userId: string, message: string, history: ChatMessage[] = []) {
  const user = await UserModel.findById(userId).select('-passwordHash').lean();
  if (!user) throw Object.assign(new Error('Worker not found'), { status: 404 });

  const documents = await DocumentModel.find({ userId })
    .select('docType sourceVerified sourceLink uploadedAt')
    .lean();

  const latestVerification = await VerificationResultModel.findOne({ userId })
    .sort({ createdAt: -1 })
    .lean();

  const context = {
    profile: {
      fullName: user.fullName || null,
      status: user.profileStatus,
      trustScore: user.trustScore,
    },
    documents: documents.map((d) => ({
      type: d.docType,
      sourceVerified: d.sourceVerified,
      uploadedAt: (d as any).uploadedAt,
    })),
    latestVerification: latestVerification
      ? {
          status: latestVerification.status,
          trustScore: latestVerification.trustScore,
          analyzer: latestVerification.analyzer,
          notes: latestVerification.notes,
        }
      : null,
  };

  const systemPrompt = `You are a friendly support assistant for LMVS (Labor Migration Verification System),
helping a migrant worker understand how to use the platform, how to submit documents correctly, and what's
going on with their own verification. You can ONLY see this one worker's own data — you have no visibility
into other workers and must never claim otherwise.

${DOC_GUIDE}

THIS WORKER'S DATA: ${JSON.stringify(context)}

When asked "what's wrong with my documents" or similar, explain the latestVerification notes above in
plain, encouraging language and give concrete next steps. If latestVerification is null, tell them no
verification has been run yet and point them to the "Run AI verification" button. Keep answers concise.`;

  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content }) as const),
      { role: 'user', content: message },
    ],
  });

  return resp.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
}
