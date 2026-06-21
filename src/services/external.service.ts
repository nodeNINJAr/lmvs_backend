// import { DocType } from '../types';

// export interface ExternalLookupResult {
//   found: boolean;
//   source: string;              // which authority answered (NIDW, DIP, BTEB...)
//   sourceLink: string | null;   // canonical verification URL to store if found
//   data: Record<string, any>;   // what the source returned (for comparison)
// }

// const BASE = process.env.EXTERNAL_API_BASE_URL || 'http://localhost:4000/mock';

// // ── NID (NIDW / Porichoy) ──
// async function lookupNid(nid: string): Promise<ExternalLookupResult> {
//   const res = await fetch(`${BASE}/nid/${nid}`);
//   const data = await res.json();
//   const found = data?.status === 'Found';
//   return {
//     found,
//     source: 'NIDW',
//     sourceLink: found ? `${BASE}/nid/${nid}` : null,
//     data,
//   };
// }

// // ── Passport (DIP) ──
// async function lookupPassport(passportNo: string): Promise<ExternalLookupResult> {
//   const res = await fetch(`${BASE}/passport/${passportNo}`);
//   const data = await res.json();
//   const found = data?.status === 'Found';
//   return {
//     found,
//     source: 'DIP',
//     sourceLink: found ? `${BASE}/passport/${passportNo}` : null,
//     data,
//   };
// }

// // ── Certificate (BTEB / TTC) ──
// async function lookupCertificate(certNo: string): Promise<ExternalLookupResult> {
//   const res = await fetch(`${BASE}/certificate/${certNo}`);
//   const data = await res.json();
//   const found = data?.status === 'Found';
//   return {
//     found,
//     source: 'BTEB',
//     sourceLink: found ? `${BASE}/certificate/${certNo}` : null,
//     data,
//   };
// }

// /**
//  * Decide which source to query based on document type + the fields OCR found,
//  * and return the lookup result.
//  */
// export async function verifyAgainstSource(
//   docType: DocType,
//   fields: Record<string, string>
// ): Promise<ExternalLookupResult> {
//   if (docType === 'NID' && fields.nid) return lookupNid(fields.nid);
//   if (docType === 'PASSPORT' && fields.passport) return lookupPassport(fields.passport);
//   if (
//     (docType === 'SKILL_CERTIFICATE' ||
//       docType === 'TRAINING_CERTIFICATE' ||
//       docType === 'EXPERIENCE_CERTIFICATE') &&
//     fields.certificateNo
//   ) {
//     return lookupCertificate(fields.certificateNo);
//   }
//   return { found: false, source: 'NONE', sourceLink: null, data: {} };
// }



import { DocType } from '../types';

export interface ExternalLookupResult {
  found: boolean;
  source: string;
  sourceLink: string | null;
  data: Record<string, any>;
}

const BASE = process.env.EXTERNAL_API_BASE_URL || 'http://localhost:4000/mock';

/* ──────────────── Mock datasets (10 each) ──────────────── */

const NID_DB: Record<string, any> = {
  '1234567890': { name: 'Mehedi Hassan', birthDate: '2000-01-01' },
  '1990785643': { name: 'Rahima Begum', birthDate: '1995-06-15' },
  '1745098321': { name: 'Abdul Karim', birthDate: '1988-11-30' },
  '1620034587': { name: 'Shahidul Islam', birthDate: '1992-03-22' },
  '1873450092': { name: 'Nasrin Akter', birthDate: '1998-09-10' },
  '1098273645': { name: 'Jahangir Alam', birthDate: '1985-12-05' },
  '1456789023': { name: 'Fatema Khatun', birthDate: '1997-07-18' },
  '1567890341': { name: 'Rasel Ahmed', birthDate: '1991-02-27' },
  '1789045612': { name: 'Sumon Mia', birthDate: '1994-08-14' },
  '1345678901': { name: 'Taslima Begum', birthDate: '1999-04-03' },
};

const PASSPORT_DB: Record<string, any> = {
  BR1234567: { name: 'Mehedi Hassan', birthDate: '2000-01-01' },
  BX5566778: { name: 'Rahima Begum', birthDate: '1995-06-15' },
  BM9988776: { name: 'Abdul Karim', birthDate: '1988-11-30' },
  BC1122334: { name: 'Shahidul Islam', birthDate: '1992-03-22' },
  BA4455667: { name: 'Nasrin Akter', birthDate: '1998-09-10' },
  BR7788990: { name: 'Jahangir Alam', birthDate: '1985-12-05' },
  BX2233445: { name: 'Fatema Khatun', birthDate: '1997-07-18' },
  BM6677889: { name: 'Rasel Ahmed', birthDate: '1991-02-27' },
  BC9900112: { name: 'Sumon Mia', birthDate: '1994-08-14' },
  BA3344556: { name: 'Taslima Begum', birthDate: '1999-04-03' },
};

const CERT_DB: Record<string, any> = {
  'BTEB-2023-55821': { name: 'Mehedi Hassan', course: 'Electrical Installation', issuer: 'BTEB' },
  'TTC-2022-10293': { name: 'Rahima Begum', course: 'Caregiving', issuer: 'TTC Dhaka' },
  'BTEB-2021-44102': { name: 'Abdul Karim', course: 'Welding (6G)', issuer: 'BTEB' },
  'TTC-2023-77345': { name: 'Shahidul Islam', course: 'Plumbing', issuer: 'TTC Chattogram' },
  'BTEB-2020-33890': { name: 'Nasrin Akter', course: 'Garments & Sewing', issuer: 'BTEB' },
  'TTC-2024-90011': { name: 'Jahangir Alam', course: 'Masonry', issuer: 'TTC Khulna' },
  'BTEB-2022-66120': { name: 'Fatema Khatun', course: 'Housekeeping', issuer: 'BTEB' },
  'TTC-2021-55478': { name: 'Rasel Ahmed', course: 'Driving (Heavy)', issuer: 'TTC Sylhet' },
  'BTEB-2023-21987': { name: 'Sumon Mia', course: 'Refrigeration & AC', issuer: 'BTEB' },
  'TTC-2024-13002': { name: 'Taslima Begum', course: 'Tailoring', issuer: 'TTC Rajshahi' },
};

/* ──────────────── Lookups (in-memory mock) ──────────────── */

async function lookupNid(nid: string): Promise<ExternalLookupResult> {
  const hit = NID_DB[nid];
  return {
    found: !!hit,
    source: 'NIDW',
    sourceLink: hit ? `${BASE}/nid/${nid}` : null,
    data: hit ? { nid, ...hit, status: 'Found' } : { nid, status: 'Not Found' },
  };
}

async function lookupPassport(passportNo: string): Promise<ExternalLookupResult> {
  const hit = PASSPORT_DB[passportNo];
  return {
    found: !!hit,
    source: 'DIP',
    sourceLink: hit ? `${BASE}/passport/${passportNo}` : null,
    data: hit ? { passport: passportNo, ...hit, status: 'Found' } : { passport: passportNo, status: 'Not Found' },
  };
}

async function lookupCertificate(certNo: string): Promise<ExternalLookupResult> {
  const hit = CERT_DB[certNo];
  return {
    found: !!hit,
    source: hit?.issuer || 'BTEB',
    sourceLink: hit ? `${BASE}/certificate/${certNo}` : null,
    data: hit ? { certificateNo: certNo, ...hit, status: 'Found' } : { certificateNo: certNo, status: 'Not Found' },
  };
}

/* ──────────────── Router ──────────────── */

export async function verifyAgainstSource(
  docType: DocType,
  fields: Record<string, string>
): Promise<ExternalLookupResult> {
  if (docType === 'NID' && fields.nid) return lookupNid(fields.nid);
  if (docType === 'PASSPORT' && fields.passport) return lookupPassport(fields.passport);
  if (
    (docType === 'SKILL_CERTIFICATE' ||
      docType === 'TRAINING_CERTIFICATE' ||
      docType === 'EXPERIENCE_CERTIFICATE') &&
    fields.certificateNo
  ) {
    return lookupCertificate(fields.certificateNo);
  }
  return { found: false, source: 'NONE', sourceLink: null, data: {} };
}