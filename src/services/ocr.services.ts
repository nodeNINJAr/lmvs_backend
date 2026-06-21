/**
 * OCR service (Tesseract.js).
 * Fetches the document image from its Cloudinary URL, runs OCR to extract raw
 * text, then parses identity fields (NID, passport, DOB, name) from that text.
 *
 * English data (eng.traineddata) is bundled in backend/tessdata for offline use.
 * For Bangla NID text, add ben.traineddata to that folder and use 'eng+ben'.
 */
import path from 'path';
import { createWorker } from 'tesseract.js';
import { DocType, OcrData } from '../types';

const TESSDATA_DIR = path.resolve(process.cwd(), 'tessdata');

let workerPromise: Promise<any> | null = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      langPath: TESSDATA_DIR,
      cachePath: TESSDATA_DIR,
      gzip: false,
    });
  }
  return workerPromise;
}

/** Download the document bytes from its (Cloudinary) URL. */
export async function fetchDocumentBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/** Heuristic field parser over OCR raw text. */
export function parseFields(rawText: string): Record<string, string> {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fields: Record<string, string> = {};

  // NID: Bangladesh NID numbers are 10, 13 or 17 digits.
  const nid = text.match(/\b(\d{17}|\d{13}|\d{10})\b/);
  if (nid) fields.nid = nid[1];

  // Passport: 1–2 letters + 7 digits.
  const pass = text.match(/\b([A-Z]{1,2}\d{7})\b/);
  if (pass) fields.passport = pass[1];

  // Date of birth -> normalise to yyyy-mm-dd.
  const iso = text.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/);
  const dmy = text.match(/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/);
  if (iso) fields.dob = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (dmy) fields.dob = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  // Name: line containing/after a "Name" label, else longest alpha line.
  const idx = lines.findIndex((l) => /name/i.test(l));
  if (idx >= 0) {
    const inline = lines[idx].replace(/.*name[:\s]*/i, '').trim();
    fields.name = inline.length > 2 ? inline : (lines[idx + 1] || '').trim();
  }
  if (!fields.name) {
    const alpha = lines.filter((l) => /^[A-Za-z .]{4,40}$/.test(l)).sort((a, b) => b.length - a.length);
    if (alpha[0]) fields.name = alpha[0];
  }

  return fields;
}

/** Run OCR on a document given its URL. */
export async function runOcr(opts: {
  documentId: string;
  docType: DocType;
  url: string;
}): Promise<OcrData> {
  const { documentId, docType, url } = opts;

  const bytes = await fetchDocumentBytes(url);
  if (!bytes) return { documentId, docType, rawText: '', fields: {} };

  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(bytes);
    const rawText = data.text || '';
    return { documentId, docType, rawText, fields: parseFields(rawText) };
  } catch (e: any) {
    return { documentId, docType, rawText: `OCR_ERROR: ${e?.message || e}`, fields: {} };
  }
}

/** Call on shutdown to release the OCR worker. */
export async function shutdownOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}