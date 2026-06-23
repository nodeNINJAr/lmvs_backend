import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';

export async function listWorkers(_req: Request, res: Response) {
  const workers = await adminService.listWorkers();
  res.json({ workers });
}

export async function getWorker(req: Request, res: Response) {
  const data = await adminService.getWorker(String(req.params.id));
  res.json(data);
}

export async function decideWorker(req: Request, res: Response) {
  const { decision, reason } = req.body;
  const result = await adminService.decideWorker(String(req.params.id), decision, reason);
  res.json(result);
}

export async function systemStats(_req: Request, res: Response) {
  const stats = await adminService.systemStats();
  res.json(stats);
}

// GET /public/stats — PUBLIC, for the marketing landing page (no sensitive counts)
export async function publicStats(_req: Request, res: Response) {
  const { totalWorkers, verified, qrIssued } = await adminService.systemStats();
  res.json({ totalWorkers, verified, qrIssued });
}

export async function getDocument(req: Request, res: Response) {
  const data = await adminService.getDocument(String(req.params.id));
  res.json(data);
}