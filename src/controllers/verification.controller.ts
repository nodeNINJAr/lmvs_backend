import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { verifyWorker } from "../services/documentVerify.service";
import { VerificationResultModel, QRCodeRecordModel } from "../models";

export async function runVerification(req: AuthRequest, res: Response) {
  const userId =
    req.user!.role === 'ADMIN' && req.body.userId ? req.body.userId : req.user!.id;
  const result = await verifyWorker(userId);
  res.status(201).json(result);
}

export async function getVerification(req: AuthRequest, res: Response) {
  const record = await VerificationResultModel.findById(req.params.id);
  if (!record) throw Object.assign(new Error('Verification record not found'), { status: 404 });

  res.json(record);
}

// GET /verification/me — worker's own latest verification result + active QR (persisted, survives reload)
export async function getMyVerification(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const [verification, qr] = await Promise.all([
    VerificationResultModel.findOne({ userId }).sort({ createdAt: -1 }),
    QRCodeRecordModel.findOne({ userId, status: 'ACTIVE' }),
  ]);
  res.json({ verification, qr });
}