import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '4000', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmvs';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('[db] Connected to MongoDB');

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] LMVS backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});

// graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.disconnect();
  process.exit(0);
});