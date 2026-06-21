export type Role = 'WORKER' | 'ADMIN';

export type ProfileStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

export type DocType =
  | 'NID'
  | 'PASSPORT'
  | 'SKILL_CERTIFICATE'
  | 'TRAINING_CERTIFICATE'
  | 'EXPERIENCE_CERTIFICATE'
  | 'PHOTO';

export interface User {
  id: string;
  role: Role;
  phone: string;
  email?: string;
  passwordHash: string;
  fullName?: string;
  dateOfBirth?: string;
  nidNumber?: string;
  passportNumber?: string;
  address?: string;
  emergencyContact?: string;
  occupation?: string;
  countryOfEmployment?: string;
  profileStatus?: ProfileStatus;
  trustScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  docType: DocType;
  fileName: string;
  url: string;             // Cloudinary secure_url
  publicId: string;        // Cloudinary public_id
  sha256: string;
  sourceLink?: string;     // issuer verification URL
  issuer?: string;         // issuing authority/institute
  certificateNo?: string;  // certificate / registration number
  sourceVerified?: boolean;
  uploadedAt: string;
}

export interface OcrData {
  documentId: string;
  docType: DocType;
  rawText: string;
  fields: Record<string, string>;   // e.g. { name, nid, passport, dob }
}

export interface ExternalSourceRecord {
  id: string;
  userId: string;
  source: string;                    // 'NIDW' | 'DIP'
  query: Record<string, string>;
  response: Record<string, any>;     // { nid, name, birthDate, status }
  matched: boolean;
  fetchedAt: string;
}

export interface FieldComparison {
  field: string;
  submitted: string;
  ocr: string;
  external: string;
  match: boolean;
}

export interface VerificationResult {
  id: string;
  userId: string;
  submittedData: Record<string, any>;
  ocrData: OcrData[];
  externalData: ExternalSourceRecord[];
  comparisons: FieldComparison[];
  confidenceScore: number;           // 0-100
  trustScore: number;                // 0-100 (fused)
  status: 'VERIFIED' | 'REVIEW_REQUIRED' | 'REJECTED';
  analyzer: 'openai' | 'rule-based';
  notes: string;
  createdAt: string;
}

export interface QRCodeRecord {
  id: string;
  userId: string;
  token: string;
  serial: string;                    // e.g. LABOR-2026-00001
  verifyUrl: string;
  qrDataUrl: string;                 // base64 PNG data URL
  status: 'ACTIVE' | 'REVOKED';
  issuedAt: string;
}