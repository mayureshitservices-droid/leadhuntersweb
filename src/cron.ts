import cron from 'node-cron';
import { prisma } from './config/db.js';

// Run every night at Midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Running nightly cleanup: Unassigning abandoned PENDING leads...');
  try {
    const result = await prisma.lead.updateMany({
      where: {
        status: 'PENDING',
        telecaller_id: { not: null },
        updated_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      data: {
        telecaller_id: null
      }
    });
    console.log(`[Cron] Successfully returned ${result.count} abandoned leads to the pool.`);
  } catch (error) {
    console.error('[Cron] Error during nightly cleanup:', error);
  }
});
