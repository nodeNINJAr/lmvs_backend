import { QRCodeRecordModel, UserModel, DocumentModel, VerificationResultModel } from '../models';
import crypto from 'crypto';
import QRCode from 'qrcode';

function notFound(msg: string) {
  return Object.assign(new Error(msg), { status: 404 });
}

/** Build the full profile snapshot shown after a QR scan. */
export async function getProfileByToken(token: string) {
  const qr = await QRCodeRecordModel.findOne({ token });
  if (!qr) throw notFound('Credential not found');
  if (qr.status !== 'ACTIVE') {
    throw Object.assign(new Error('Credential revoked'), { status: 410 });
  }

  const user = await UserModel.findById(qr.userId).lean();
  if (!user) throw notFound('Worker not found');
  delete (user as any).passwordHash;

  const documents = await DocumentModel.find({ userId: qr.userId })
    .select('docType fileName url sourceLink issuer certificateNo sourceVerified uploadedAt')
    .lean();

  const verification = await VerificationResultModel.findOne({ userId: qr.userId })
    .sort({ createdAt: -1 })
    .lean();

  return {
    credential: { serial: qr.serial, status: qr.status, issuedAt: qr.issuedAt },
    worker: user,
    documents,                        // each with its sourceLink + sourceVerified
    verification: verification
      ? {
          trustScore: verification.trustScore,
          confidenceScore: verification.confidenceScore,
          status: verification.status,
          analyzer: verification.analyzer,
          notes: verification.notes,
          comparisons: verification.comparisons,
          externalData: verification.externalData,
          verifiedAt: verification.createdAt,
        }
      : null,
  };
}

export async function issueQrForUser(userId: string) {
  const existing = await QRCodeRecordModel.findOne({ userId, status: 'ACTIVE' });
  if (existing) return existing;

  const token = crypto.randomBytes(24).toString('hex');
  const seq = (await QRCodeRecordModel.countDocuments()) + 1;
  const serial = `LABOR-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
  const verifyUrl = `${process.env.FRONTEND_BASE_URL}/verify/${token}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 320 });

  return QRCodeRecordModel.create({ userId, token, serial, verifyUrl, qrDataUrl, status: 'ACTIVE' });
}