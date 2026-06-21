import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { verifyWorker } from "../services/documentVerify.service";
import { VerificationResultModel } from "../models";

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