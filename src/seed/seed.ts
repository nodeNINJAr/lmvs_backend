import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmvs';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('[seed] Connected to MongoDB');

  // Admin
  await UserModel.updateOne(
    { phone: '01700000000' },
    {
      $set: {
        role: 'ADMIN',
        phone: '01700000000',
        passwordHash: bcrypt.hashSync('admin123', 10),
        fullName: 'System Admin',
      },
    },
    { upsert: true }
  );

  console.log('[seed] Done.');
  console.log('  Admin  -> 01700000000 / admin123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});