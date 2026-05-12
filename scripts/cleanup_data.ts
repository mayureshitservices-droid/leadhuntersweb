
import { prisma } from '../src/config/db.js';

async function cleanup() {
  console.log('--- Starting Database Cleanup ---');

  // 1. Remove Duplicate Call Logs
  // We look for logs with the same telecaller_id and local_log_id
  const logs = await prisma.callLog.findMany({
    orderBy: { created_at: 'asc' }
  });

  const seen = new Set();
  const duplicates = [];

  for (const log of logs) {
    if (log.local_log_id) {
      const key = `${log.telecaller_id}_${log.local_log_id}`;
      if (seen.has(key)) {
        duplicates.push(log.id);
      } else {
        seen.add(key);
      }
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate logs. Deleting...`);
    await prisma.callLog.deleteMany({
      where: { id: { in: duplicates } }
    });
    console.log('Duplicates deleted.');
  } else {
    console.log('No duplicate logs found.');
  }

  // 2. Fix "Stuck" Lead Statuses
  // Find leads marked PENDING that actually have a call log with a result
  const stuckLeads = await prisma.lead.findMany({
    where: { 
      status: 'PENDING',
      call_logs: { some: {} } // Has at least one call log
    },
    include: { call_logs: { orderBy: { created_at: 'desc' }, take: 1 } }
  });

  if (stuckLeads.length > 0) {
    console.log(`Found ${stuckLeads.length} leads stuck in PENDING status. Fixing...`);
    for (const lead of stuckLeads) {
      const lastLog = lead.call_logs[0];
      const newStatus = lastLog.outcome || lastLog.call_status || 'MISSED';
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: newStatus.toUpperCase().replace(/ /g, '_') as any }
      });
    }
    console.log('Lead statuses fixed.');
  } else {
    console.log('No stuck leads found.');
  }

  console.log('--- Cleanup Finished ---');
  process.exit(0);
}

cleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
