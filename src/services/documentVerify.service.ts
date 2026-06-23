import { DocumentModel, ExternalSourceModel, UserModel, VerificationResultModel } from '../models';
import { extractWithAI, verifyWithAI } from './ai.service';
import { verifyAgainstSource } from './external.service';
import { issueQrForUser } from './qr.service';

/**
 * Verify ONE document end-to-end:
 *  1) AI reads the image -> structured fields
 *  2) External API lookup using those fields
 *  3) If found -> store source link + mark verified
 *  4) AI decides match/confidence over submitted vs extracted vs source
 */

export async function verifyDocument(documentId: string, submitted: Record<string, any>) {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 });
    // 1) AI extraction (Vision)
    const extracted = await extractWithAI(doc.url, doc.docType);
    if (doc.certificateNo && !extracted.certificateNo) extracted.certificateNo = doc.certificateNo;

    // 1b) Validity gate — stop if AI couldn't read a real document
    const hasAnyField =
      extracted.name || extracted.nid || extracted.passport || extracted.certificateNo;

    if (!hasAnyField || extracted.extractionConfidence < 30) {
      doc.sourceVerified = false;
      await doc.save();
      return {
        documentId: String(doc._id),
        docType: doc.docType,
        extracted,
        externalFound: false,
        sourceLink: null,
        sourceVerified: false,
        decision: {
          status: 'REJECTED',
          confidence: 0,
          matched: false,
          reasons: ['Uploaded file is not a valid/readable document. Please upload a clear image.'],
          fieldChecks: [],
        },
      };
    }

  // 2) External lookup
  const ext = await verifyAgainstSource(doc.docType, {
    nid: extracted.nid,
    passport: extracted.passport,
    certificateNo: extracted.certificateNo,
  });

  // audit log
  await ExternalSourceModel.create({
    userId: doc.userId,
    source: ext.source,
    query: { nid: extracted.nid, passport: extracted.passport, certificateNo: extracted.certificateNo },
    response: ext.data,
    matched: ext.found,
  });

  // 3) store source link if found
  if (ext.found && ext.sourceLink) {
    doc.sourceLink = ext.sourceLink;
    doc.sourceVerified = true;
    if (!doc.issuer && extracted.issuer) doc.issuer = extracted.issuer;
    await doc.save();
  }

  // 4) AI decision for this document
  const decision = await verifyWithAI({
    docType: doc.docType,
    submitted,
    extracted,
    externalData: ext.data,
    externalFound: ext.found,
  });

  return {
    documentId: String(doc._id),
    docType: doc.docType,
    extracted,
    externalFound: ext.found,
    sourceLink: doc.sourceLink || null,
    sourceVerified: doc.sourceVerified,
    decision,
  };
}

/**
 * Verify a WHOLE worker: run every document, aggregate into one trust score
 * + status, save the result, and auto-issue the QR if VERIFIED.
 */
export async function verifyWorker(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw Object.assign(new Error('Worker not found'), { status: 404 });

  const submitted = {
    fullName: user.fullName,
    dateOfBirth: user.dateOfBirth,
    nidNumber: user.nidNumber,
    passportNumber: user.passportNumber,
  };
  const docs = await DocumentModel.find({ userId });
  if (docs.length === 0) throw Object.assign(new Error('No documents to verify'), { status: 400 });
  // run each document through the pipeline
  const results = [];
  for (const d of docs) {
    results.push(await verifyDocument(String(d._id), submitted));
  }
  // ── aggregate ──
  const trustScore = Math.round(
    results.reduce((s, r) => s + r.decision.confidence, 0) / results.length
  );
  const anyRejected = results.some((r) => r.decision.status === 'REJECTED');
  const allVerified = results.every((r) => r.decision.status === 'VERIFIED');

  const finalStatus = anyRejected ? 'REJECTED' : allVerified ? 'VERIFIED' : 'REVIEW_REQUIRED';

  // save the verification record
  await VerificationResultModel.create({
    userId,
    submittedData: submitted,
    comparisons: results.flatMap((r) => r.decision.fieldChecks),
    confidenceScore: trustScore,
    trustScore,
    status: finalStatus,
    analyzer: 'openai',
    // Dedupe identical reasons surfaced by more than one document (e.g. NID and passport
    // both flagging "Name does not match the submitted value.") so notes don't repeat.
    notes: [...new Set(results.flatMap((r) => r.decision.reasons).map((s) => s.trim()).filter(Boolean))].join(' | '),
  });

  // update profile + auto-issue QR
  await UserModel.findByIdAndUpdate(userId, { profileStatus: finalStatus, trustScore });

  let qr = null;
  if (finalStatus === 'VERIFIED') {
    qr = await issueQrForUser(userId); 
  }

  return { userId, status: finalStatus, trustScore, results, qr };
}