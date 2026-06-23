import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import * as auth from '../controllers/auth.controller';
import * as docs from '../controllers/document.controller';
import * as qr from '../controllers/qr.controller';
import * as admin from '../controllers/admin.controller';
import * as verify from '../controllers/verification.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const router = Router();

// ── Auth ──  (registration accepts multiple documents/images -> Cloudinary)
router.post('/auth/register', upload.array('files', 10), asyncHandler(auth.register));
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and get a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Token + user }
 *       401: { description: Invalid credentials }
 */
router.post('/auth/login', asyncHandler(auth.login));
router.get('/auth/me', authenticate, asyncHandler(auth.me));

// ── Documents ──
/**
 * @openapi
 * /documents/upload:
 *   post:
 *     summary: Upload one or more documents (worker)
 *     description: Files are uploaded to Cloudinary; only the links are stored. Use parallel arrays so each file carries its own type/source info (index-matched to files).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               docTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [NID, PASSPORT, SKILL_CERTIFICATE, TRAINING_CERTIFICATE, EXPERIENCE_CERTIFICATE, PHOTO]
 *               sourceLinks:
 *                 type: array
 *                 items: { type: string }
 *               issuers:
 *                 type: array
 *                 items: { type: string }
 *               certificateNos:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: Documents created
 *       400:
 *         description: No files provided or invalid docType
 *       401:
 *         description: Missing/invalid token
 *       403:
 *         description: Not a worker
 */
router.post('/documents/upload', authenticate, authorize('WORKER'), upload.array('files', 10), asyncHandler(docs.uploadDocuments));

/**
 * @openapi
 * /documents/me:
 *   get:
 *     summary: List my uploaded documents (worker)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of the worker's documents (newest first)
 *       401:
 *         description: Missing/invalid token
 *       403:
 *         description: Not a worker
 */
router.get('/documents/me', authenticate, authorize('WORKER'), asyncHandler(docs.listMyDocuments));

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     summary: Delete one of my documents (worker)
 *     description: Removes the file from Cloudinary and deletes the document record. Only the owning worker can delete their own document.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Document deleted
 *       401:
 *         description: Missing/invalid token
 *       403:
 *         description: Not a worker
 *       404:
 *         description: Document not found
 */
router.delete('/documents/:id', authenticate, authorize('WORKER'), asyncHandler(docs.deleteDocument));



/**
 * @openapi
 * /verification/run:
 *   post:
 *     tags: [Verification]
 *     summary: Run AI verification for a worker (worker self, or admin via userId)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string, description: "Admin only — worker to verify" }
 *     responses:
 *       201: { description: Verification result + trust score + QR if verified }
 *       400: { description: No documents to verify }
 */
 router.post('/verification/run', authenticate, authorize('WORKER', 'ADMIN'), asyncHandler(verify.runVerification));

/**
 * @openapi
 * /verification/me:
 *   get:
 *     tags: [Verification]
 *     summary: Get my latest verification result + active QR (worker self)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Latest verification record and active QR (either may be null) }
 */
router.get('/verification/me', authenticate, authorize('WORKER'), asyncHandler(verify.getMyVerification));

/**
 * @openapi
 * /verification/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a verification record by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Verification record }
 *       404: { description: Not found }
 */
router.get('/verification/:id', authenticate, asyncHandler(verify.getVerification));





// ── QR ──
// router.post('/qrcode/generate', authenticate, authorize('WORKER', 'ADMIN'), asyncHandler(qr.generateQr));
/**
 * @openapi
 * /verify/{token}:
 *   get:
 *     tags: [Verification]
 *     summary: Public QR verification (officer scans QR)
 *     parameters:
 *       - { in: path, name: token, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Worker profile, documents with source, and verification result }
 *       404: { description: Credential not found }
 *       410: { description: Credential revoked }
 */
router.get('/verify/:token', asyncHandler(qr.verifyByToken)); // PUBLIC

/**
 * @openapi
 * /public/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Public counters for the landing page (no auth)
 *     responses:
 *       200: { description: Worker/verification/QR counters }
 */
router.get('/public/stats', asyncHandler(admin.publicStats)); // PUBLIC

// ── Admin ──
/**
 * @openapi
 * /admin/workers:
 *   get:
 *     tags: [Admin]
 *     summary: List all workers
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of workers }
 */
router.get('/admin/workers', authenticate, authorize('ADMIN'), asyncHandler(admin.listWorkers));

/**
 * @openapi
 * /admin/workers/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get one worker (profile, documents, verifications)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Worker detail }
 *       404: { description: Not found }
 */
router.get('/admin/workers/:id', authenticate, authorize('ADMIN'), asyncHandler(admin.getWorker));

/**
 * @openapi
 * /admin/workers/{id}/decision:
 *   post:
 *     tags: [Admin]
 *     summary: Approve or reject a worker
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               decision: { type: string, enum: [APPROVED, REJECTED] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Decision applied }
 */
router.post('/admin/workers/:id/decision', authenticate, authorize('ADMIN'), asyncHandler(admin.decideWorker));

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: System statistics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Counters }
 */
router.get('/admin/stats', authenticate, authorize('ADMIN'), asyncHandler(admin.systemStats));

/**
 * @openapi
 * /admin/documents/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: View one document with its source check
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Document detail }
 *       404: { description: Not found }
 */
router.get('/admin/documents/:id', authenticate, authorize('ADMIN'), asyncHandler(admin.getDocument));

