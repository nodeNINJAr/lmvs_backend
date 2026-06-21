import { Request, Response } from 'express';
import { getProfileByToken } from '../services/qr.service';

// GET /verify/:token   (PUBLIC — officer scans the QR)
export async function verifyByToken(req: Request, res: Response) {
  const profile = await getProfileByToken(String(req.params.token));
  res.json(profile);
}