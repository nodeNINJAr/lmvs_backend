import OpenAI from 'openai';
import { DocType } from '../types';

// timeout/maxRetries: the SDK retries 408/409/429/5xx with backoff automatically — important
// since a flaky OpenAI response or transient rate limit shouldn't fail a whole verification run.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 2 });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/* ──────────────────────────── Types ──────────────────────────── */

export interface ExtractedFields {
  name: string;
  nid: string;
  passport: string;
  dob: string; // YYYY-MM-DD or ''
  certificateNo: string;
  issuer: string;
  documentLooksAuthentic: boolean; // model's tamper impression
  extractionConfidence: number;    // 0-100, how legible the doc was
}

export interface AIDecision {
  status: 'VERIFIED' | 'REVIEW_REQUIRED' | 'REJECTED';
  confidence: number;     // 0-100
  matched: boolean;
  reasons: string[];
  fieldChecks: {
    field: string;
    submitted: string;
    extracted: string;
    external: string;
    match: boolean;
  }[];
}

/* ──────────────────────────── Helpers ──────────────────────────── */

function aiError(message: string, status = 502) {
  return Object.assign(new Error(message), { status });
}

/** Safe JSON parse that tolerates stray markdown fences. */
function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as T;
}

/** Call OpenAI and parse JSON, retrying once if the model returns malformed JSON. */
async function jsonCompletion<T>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages,
    });
    const raw = resp.choices[0]?.message?.content ?? '';
    try {
      return parseJson<T>(raw);
    } catch {
      if (attempt === 1) throw aiError('AI returned invalid JSON');
    }
  }
  throw aiError('AI completion failed');
}

const clamp = (n: any) => Math.max(0, Math.min(100, Number(n) || 0));
const str = (v: any) => (typeof v === 'string' ? v.trim() : '');
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();

/* ──────────────────── 1) READ: Vision extraction ──────────────────── */

const EXTRACT_SYSTEM = `You are a precise OCR and field-extraction engine for official Bangladeshi documents
(NID, passport, training/skill/experience certificates). Read ONLY what is visibly printed.
Never invent or guess values. Return STRICT JSON with EXACTLY these keys:
{
  "name": string,
  "nid": string,
  "passport": string,
  "dob": string,                    // normalise to YYYY-MM-DD; "" if absent/unclear
  "certificateNo": string,
  "issuer": string,                 // issuing authority/institute if printed
  "documentLooksAuthentic": boolean,// false if you see signs of tampering/editing
  "extractionConfidence": number    // 0-100, how legible/complete the document was
}
Use "" for any text field not clearly present. Output JSON only, no commentary.`;



async function toDataUrl(imageUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(imageUrl, { signal: controller.signal });
  } catch (e: any) {
    throw Object.assign(new Error(e?.name === 'AbortError' ? 'Timed out fetching document image' : `Cannot fetch image: ${e?.message}`), { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw Object.assign(new Error(`Cannot fetch image (${res.status})`), { status: 502 });
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${ct};base64,${buf.toString('base64')}`;
}

export async function extractWithAI(
  imageUrl: string,
  docType: DocType
): Promise<ExtractedFields> {
  const dataUrl = await toDataUrl(imageUrl);

  const p = await jsonCompletion<any>([
    { role: 'system', content: EXTRACT_SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Document type: ${docType}. Extract the fields.` },
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
      ],
    },
  ]);
 console.log("==",p, imageUrl, docType);
  return {
    name: str(p.name),
    nid: str(p.nid).replace(/\s/g, ''),
    passport: str(p.passport).replace(/\s/g, ''),
    dob: str(p.dob),
    certificateNo: str(p.certificateNo),
    issuer: str(p.issuer),
    documentLooksAuthentic: p.documentLooksAuthentic !== false,
    extractionConfidence: clamp(p.extractionConfidence),
  };
}

/* ──────────────────── 2) VERIFY: reasoning + hard rules ──────────────────── */

const VERIFY_SYSTEM = `You are a verification analyst for a labor-migration system.
Compare three sources of truth: (a) data the user submitted at registration,
(b) data extracted from their uploaded document, (c) data returned by the external
government/issuer source. Assess consistency and authenticity.
Return STRICT JSON only:
{
  "matched": boolean,
  "confidence": number,             // 0-100
  "reasons": string[],              // short bullet explanations
  "fieldChecks": [                  // one row per compared field
    {"field": string, "submitted": string, "extracted": string, "external": string, "match": boolean}
  ]
}
Compare names case-insensitively allowing minor transliteration differences.
Output JSON only.`;

export async function verifyWithAI(input: {
  docType: DocType;
  submitted: Record<string, any>;
  extracted: ExtractedFields;
  externalData: Record<string, any>;
  externalFound: boolean;
}): Promise<AIDecision> {
  const ai = await jsonCompletion<any>([
    { role: 'system', content: VERIFY_SYSTEM },
    { role: 'user', content: JSON.stringify(input) },
  ]);

  const fieldChecks = Array.isArray(ai.fieldChecks) ? ai.fieldChecks : [];
  const reasons: string[] = Array.isArray(ai.reasons) ? ai.reasons : [];
  let confidence = clamp(ai.confidence);

  // ── Deterministic hard rules (do NOT trust the model alone) ──
  const { submitted, extracted, externalFound } = input;

  const nameMismatch =
    submitted.fullName && extracted.name &&
    norm(submitted.fullName) !== norm(extracted.name) &&
    !norm(extracted.name).includes(norm(submitted.fullName));

  const nidMismatch =
    submitted.nidNumber && extracted.nid &&
    submitted.nidNumber.replace(/\s/g, '') !== extracted.nid;

  let status: AIDecision['status'];

  if (nidMismatch || nameMismatch || extracted.documentLooksAuthentic === false) {
    status = 'REJECTED';
    confidence = Math.min(confidence, 35);
    if (nidMismatch) reasons.push('NID does not match the submitted value.');
    if (nameMismatch) reasons.push('Name does not match the submitted value.');
    if (extracted.documentLooksAuthentic === false) reasons.push('Document shows signs of tampering.');
  } else if (externalFound && confidence >= 85) {
    status = 'VERIFIED';
  } else {
    status = 'REVIEW_REQUIRED';
    if (!externalFound) reasons.push('Record not found in the external source.');
  }
   

  return {
    status,
    confidence,
    matched: status === 'VERIFIED',
    reasons,
    fieldChecks,
  };
}