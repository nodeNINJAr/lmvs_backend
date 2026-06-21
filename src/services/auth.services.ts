import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserModel, DocumentModel } from '../models';
import { signToken } from '../middleware/auth';
import { uploadBufferToCloudinary } from './storage.service';

function sanitize(u: any) {
  const obj = u.toObject ? u.toObject() : u;
  delete obj.passwordHash;
  return obj;
}

// throw with a status so the controller/error handler can map it
function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

interface RegisterInput {
  phone: string;
  password: string;
  role?: string;
  fullName?: string;
  dateOfBirth?: string;
  nidNumber?: string;
  passportNumber?: string;
  address?: string;
  emergencyContact?: string;
  occupation?: string;
  countryOfEmployment?: string;
  email?: string;
}

interface UploadFile {
  buffer: Buffer;
  originalname: string;
  docType?: string;
  sourceLink?: string;
  issuer?: string;
  certificateNo?: string;
}

export async function registerUser(input: RegisterInput, files: UploadFile[] = []) {
  if (!input.phone || !input.password) {
    throw httpError(400, 'phone and password are required');
  }
  if (await UserModel.findOne({ phone: input.phone })) {
    throw httpError(409, 'Phone already registered');
  }
  if (input.nidNumber && (await UserModel.findOne({ nidNumber: input.nidNumber }))) {
    throw httpError(409, 'NID already registered');
  }
  if (input.passportNumber && (await UserModel.findOne({ passportNumber: input.passportNumber }))) {
    throw httpError(409, 'Passport already registered');
  }

  const role = input.role === 'ADMIN' ? 'ADMIN' : 'WORKER';
  const user = await UserModel.create({
    role,
    phone: input.phone,
    email: input.email,
    passwordHash: bcrypt.hashSync(input.password, 10),
    fullName: input.fullName,
    dateOfBirth: input.dateOfBirth,
    nidNumber: input.nidNumber,
    passportNumber: input.passportNumber,
    address: input.address,
    emergencyContact: input.emergencyContact,
    occupation: input.occupation,
    countryOfEmployment: input.countryOfEmployment,
    profileStatus: role === 'WORKER' ? 'SUBMITTED' : undefined,
  });

  const documents = [];
  for (const f of files) {
    const up = await uploadBufferToCloudinary(f.buffer, `lmvs/${user._id}`);
    const doc = await DocumentModel.create({
      userId: user._id,
      docType: (f.docType || 'PHOTO').toUpperCase(),
      fileName: f.originalname,
      url: up.secure_url,
      publicId: up.public_id,
      sha256: crypto.createHash('sha256').update(f.buffer).digest('hex'),
      sourceLink: f.sourceLink,
      issuer: f.issuer,
      certificateNo: f.certificateNo,
      sourceVerified: false,
    });
    documents.push(doc);
  }

  const token = signToken({ id: String(user._id), role: user.role, phone: user.phone });
  return { token, user: sanitize(user), documents };
}

export async function loginUser(phone: string, password: string) {
  const user = await UserModel.findOne({ phone });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw httpError(401, 'Invalid credentials');
  }
  const token = signToken({ id: String(user._id), role: user.role, phone: user.phone });
  return { token, user: sanitize(user) };
}

export async function getMe(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw httpError(404, 'Not found');
  return sanitize(user);
}