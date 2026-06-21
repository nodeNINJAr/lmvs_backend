import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getMe, loginUser, registerUser } from '../services/auth.services';

export async function register(req: AuthRequest, res: Response) {
  const files = ((req.files as Express.Multer.File[]) || []).map((f, i) => ({
    buffer: f.buffer,
    originalname: f.originalname,
    docType: ([] as string[]).concat(req.body.docTypes || [])[i],
    sourceLink: ([] as string[]).concat(req.body.sourceLinks || [])[i],
    issuer: ([] as string[]).concat(req.body.issuers || [])[i],
    certificateNo: ([] as string[]).concat(req.body.certificateNos || [])[i],
  }));

  const result = await registerUser(req.body, files);
  res.status(201).json(result);
}

export async function login(req: AuthRequest, res: Response) {
  const { phone, password } = req.body;
  const result = await loginUser(phone, password);
  res.json(result);
}

export async function me(req: AuthRequest, res: Response) {
  const user = await getMe(req.user!.id);
  res.json({ user });
}