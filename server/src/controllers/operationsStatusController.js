import mongoose from 'mongoose';
import { EmailOutbox, PaymentInbox } from '../automation/models.js';
import TenantRegistry from '../models/TenantRegistry.js';

// Platform metadata only; never read customer operational databases here.
export async function getOperationsStatus(req, res) {
  const now = new Date();
  const queue = async model => {
    const [groups, oldest] = await Promise.all([
      model.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      model.findOne({ status: 'PENDING' }).sort({ createdAt: 1 }).select('createdAt').lean(),
    ]);
    return { counts: Object.fromEntries(groups.map(row => [row._id, row.count])),
      oldestPendingSeconds: oldest ? Math.max(0, Math.floor((now - oldest.createdAt) / 1000)) : 0 };
  };
  const [email, payment, failedActivations, migrations] = await Promise.all([
    queue(EmailOutbox), queue(PaymentInbox),
    TenantRegistry.countDocuments({ activationEmailStatus: 'FAILED' }),
    TenantRegistry.countDocuments({ databaseRoutingState: 'MIGRATING' }),
  ]);
  res.json({ checkedAt: now, databaseConnected: mongoose.connection.readyState === 1,
    email, payment, failedActivations, migrations,
    configuration: { email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      payment: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET) },
    notice: 'Configuration presence does not verify provider access, delivery or backup recovery.' });
}
