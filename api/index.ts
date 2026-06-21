import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from '../src/app';

const MONGODB_URI = process.env.MONGODB_URI;

let cached = (global as any)._mongoose;
if (!cached) cached = (global as any)._mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

const app = createApp();

export default async function handler(req: any, res: any) {
  if (!MONGODB_URI) {
    return res.status(500).json({ error: 'MONGODB_URI not set in Vercel env' });
  }
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] connect failed', err);
    return res.status(500).json({ error: 'DB connection failed' });
  }
  return app(req, res);
}