import {
  UserModel,
  DocumentModel,
  VerificationResultModel,
  QRCodeRecordModel,
} from '../models';
import { issueQrForUser } from './qr.service';

function notFound(msg: string) {
  return Object.assign(new Error(msg), { status: 404 });
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

  return { worker, documents, verifications };
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
  } else {
    await QRCodeRecordModel.updateMany(              
      { userId: id, status: 'ACTIVE' },
      { $set: { status: 'REVOKED' } }
    );
  }

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