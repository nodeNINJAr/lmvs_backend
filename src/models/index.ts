import mongoose, { InferSchemaType, Model, Schema } from 'mongoose';


const UserSchema = new Schema({
  role:               { type: String, enum: ['WORKER','ADMIN'], default: 'WORKER', required: true },
  phone:              { type: String, unique: true, required: true },
  email:              String,
  passwordHash:       { type: String, required: true },
  fullName:           String,
  dateOfBirth:        String,
  nidNumber:          String,
  passportNumber:     String,
  address:            String,
  emergencyContact:   String,
  occupation:         String,
  countryOfEmployment:String,
  profileStatus:      { type: String, default: 'DRAFT' },
  trustScore:         { type: Number, default: null },
}, { timestamps: true });
UserSchema.index({ nidNumber: 1 },      { unique: true, partialFilterExpression: { nidNumber: { $type: 'string' } } });
UserSchema.index({ passportNumber: 1 }, { unique: true, partialFilterExpression: { passportNumber: { $type: 'string' } } });


const DocumentSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  docType:    { type: String, required: true },
  fileName:   String,
  url:        { type: String, required: true },
  publicId:   { type: String, required: true },
  sha256:     { type: String, index: true },

  sourceLink:     String,
  issuer:         String,
  certificateNo:  String,
  sourceVerified: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'uploadedAt', updatedAt: false } });

const ExternalSourceSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  source:   String,
  query:    Object,
  response: Object,
  matched:  Boolean,
}, { timestamps: { createdAt: 'fetchedAt', updatedAt: false } });


const VerificationResultSchema = new Schema({
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  submittedData:   Object,
  ocrData:         Array,
  externalData:    Array,
  comparisons:     Array,
  confidenceScore: Number,
  trustScore:      Number,
  status:          String,
  analyzer:        String,
  notes:           String,
}, { timestamps: true });



const QRCodeRecordSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token:     { type: String, unique: true },
  serial:    { type: String, unique: true },
  verifyUrl: String,
  qrDataUrl: String,
  status:    { type: String, default: 'ACTIVE' },
}, { timestamps: { createdAt: 'issuedAt', updatedAt: false } });



type UserDoc = InferSchemaType<typeof UserSchema>

export const UserModel: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>('User', UserSchema);
export const DocumentModel           = (mongoose.models.Document           || mongoose.model('Document', DocumentSchema)) as Model<any>;
export const ExternalSourceModel     = (mongoose.models.ExternalSource     || mongoose.model('ExternalSource', ExternalSourceSchema)) as Model<any>;
export const VerificationResultModel = (mongoose.models.VerificationResult || mongoose.model('VerificationResult', VerificationResultSchema)) as Model<any>;
export const QRCodeRecordModel       = (mongoose.models.QRCodeRecord       || mongoose.model('QRCodeRecord', QRCodeRecordSchema)) as Model<any>;