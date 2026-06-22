import { Response } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { UserModel, DocumentModel } from '../models';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../services/storage.service';

const VALID = ['NID', 'PASSPORT', 'SKILL_CERTIFICATE', 'TRAINING_CERTIFICATE', 'EXPERIENCE_CERTIFICATE', 'PHOTO'];

// POST /documents/upload  (multipart: files[] + parallel docTypes[] + optional source fields)
export async function uploadDocuments(req: AuthRequest, res: Response) {
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'At least one file is required (field "files")' });
  }

  const user = await UserModel.findById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Parallel arrays from the form (one entry per file). All optional except docTypes.
  const docTypes = ([] as string[]).concat(req.body.docTypes || []);
  const sourceLinks = ([] as string[]).concat(req.body.sourceLinks || []);
  const issuers = ([] as string[]).concat(req.body.issuers || []);
  const certificateNos = ([] as string[]).concat(req.body.certificateNos || []);

  const created = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const docType = (docTypes[i] || 'PHOTO').toUpperCase();
    if (!VALID.includes(docType)) {
      return res.status(400).json({ error: `Invalid docType "${docType}"` });
    }

    const up = await uploadBufferToCloudinary(f.buffer, `lmvs/${user._id}`);
    const doc = await DocumentModel.create({
      userId: user._id,
      docType,
      fileName: f.originalname,
      url: up.secure_url,
      publicId: up.public_id,
      sha256: crypto.createHash('sha256').update(f.buffer).digest('hex'),
      sourceLink: sourceLinks[i] || undefined,
      issuer: issuers[i] || undefined,
      certificateNo: certificateNos[i] || undefined,
      sourceVerified: false,
    });
    created.push(doc);
  }

  return res.status(201).json({ documents: created });
}

// GET /documents/me
export async function listMyDocuments(req: AuthRequest, res: Response) {
  const documents = await DocumentModel.find({ userId: req.user!.id }).sort({ uploadedAt: -1 });
  return res.json({ documents });
}

// DELETE /documents/:id
export async function deleteDocument(req: AuthRequest, res: Response) {
  const doc = await DocumentModel.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  await deleteFromCloudinary(doc.publicId);
  await doc.deleteOne();

  return res.json({ message: 'Document deleted' });
}