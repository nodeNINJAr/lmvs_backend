import {
  UserModel,
  DocumentModel,
  VerificationResultModel,
  QRCodeRecordModel,
  ExternalSourceModel,
} from '../models';
import { issueQrForUser } from './qr.service';

function notFound(msg: string) {
  return Object.assign(new Error(msg), { status: 404 });
}

/** Split a "|"-joined notes string into trimmed, deduplicated phrases. */
function dedupePhrases(notes?: string | null): string[] {
  if (!notes) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of notes.split('|')) {
    const phrase = raw.trim();
    if (!phrase || seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
  }
  return out;
}

/** List all workers with their latest status + trust score. */
export async function listWorkers() {
  const workers = await UserModel.find({ role: 'WORKER' })
    .select('-passwordHash')
    .sort({ createdAt: -1 })
    .lean();

  // attach whether each has an active QR
  const ids = workers.map((w) => w._id);
  const qrs = await QRCodeRecordModel.find({ userId: { $in: ids }, status: 'ACTIVE' })
    .select('userId serial')
    .lean();
  const qrByUser = new Map(qrs.map((q) => [String(q.userId), q.serial]));

  return workers.map((w) => ({
    ...w,
    qrSerial: qrByUser.get(String(w._id)) || null,
  }));
}

/** Full detail of one worker: profile + documents (with source) + verifications. */
export async function getWorker(id: string) {
  const worker = await UserModel.findById(id).select('-passwordHash').lean();
  if (!worker || worker.role !== 'WORKER') throw notFound('Worker not found');

  const documents = await DocumentModel.find({ userId: id })
    .select('docType fileName url sourceLink issuer certificateNo sourceVerified uploadedAt')
    .lean();

  const verifications = await VerificationResultModel.find({ userId: id })
    .sort({ createdAt: -1 })
    .lean();

  const qr = await QRCodeRecordModel.findOne({ userId: id, status: 'ACTIVE' }).lean();

  return { worker, documents, verifications, qr };
}

/** Approve or reject a worker. Approve auto-issues a QR; reject revokes it. */
export async function decideWorker(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string
) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw Object.assign(new Error('decision must be APPROVED or REJECTED'), { status: 400 });
  }

  const worker = await UserModel.findById(id);
  if (!worker || worker.role !== 'WORKER') throw notFound('Worker not found');

  const status = decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
  worker.profileStatus = status;
  await worker.save();

  let qr = null;
  if (status === 'VERIFIED') {
    qr = await issueQrForUser(id);
    // Admin sign-off covers the documents too, even ones the AI couldn't externally confirm.
    await DocumentModel.updateMany({ userId: id }, { $set: { sourceVerified: true } });
  } else {
    await QRCodeRecordModel.updateMany(
      { userId: id, status: 'ACTIVE' },
      { $set: { status: 'REVOKED' } }
    );
    // A rejection undoes any prior manual sign-off — documents go back to pending.
    await DocumentModel.updateMany({ userId: id }, { $set: { sourceVerified: false } });
  }

  // Record the manual decision as a verification entry too, so the worker (and anyone
  // scanning the QR) sees it was confirmed by an admin, alongside whatever the AI found.
  // Always look up the original AI run (never a prior admin override), so re-deciding
  // doesn't keep nesting "AI findings: Verified manually by admin | ..." on top of itself.
  // Phrases are also deduped defensively in case the underlying AI notes already repeat
  // (e.g. the same reason logged for more than one document).
  const lastAi = await VerificationResultModel.findOne({ userId: id, analyzer: { $ne: 'admin' } }).sort({ createdAt: -1 });
  const aiPhrases = dedupePhrases(lastAi?.notes);
  const notes = [
    `Verified manually by admin${reason ? `: ${reason}` : ''}`,
    aiPhrases.length ? `AI findings: ${aiPhrases.join(' | ')}` : null,
  ].filter(Boolean).join(' | ');

  await VerificationResultModel.create({
    userId: id,
    status,
    analyzer: 'admin',
    trustScore: worker.trustScore ?? lastAi?.trustScore ?? null,
    confidenceScore: lastAi?.confidenceScore ?? null,
    notes,
  });

  return { userId: id, status, reason: reason || null, qr };
}

/** Dashboard counters. */
export async function systemStats() {
  const [total, verified, rejected, underReview, qrIssued] = await Promise.all([
    UserModel.countDocuments({ role: 'WORKER' }),
    UserModel.countDocuments({ role: 'WORKER', profileStatus: 'VERIFIED' }),
    UserModel.countDocuments({ role: 'WORKER', profileStatus: 'REJECTED' }),
    UserModel.countDocuments({ role: 'WORKER', profileStatus: 'REVIEW_REQUIRED' }),
    QRCodeRecordModel.countDocuments({ status: 'ACTIVE' }),
  ]);
  return { totalWorkers: total, verified, rejected, underReview, qrIssued };
}


/** Get one document with its latest external-source check (for admin review). */
export async function getDocument(id: string) {
  const document = await DocumentModel.findById(id).lean();
  if (!document) throw Object.assign(new Error('Document not found'), { status: 404 });

  // most recent external lookup logged for this worker (audit trail)
  const externalSource = await ExternalSourceModel.find({ userId: document.userId })
    .sort({ fetchedAt: -1 })
    .limit(1)
    .lean();

  return { document, externalSource: externalSource[0] || null };
}