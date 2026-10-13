// Local-only, repeatable demo data. Never connects to production.
require('reflect-metadata');
const mongoose = require('mongoose');
const argon2 = require('argon2');
const { UserSchema } = require('../dist/users/schemas/user.schema');
const { OrderSchema } = require('../dist/orders/schemas/order.schema');
const { PaymentSchema } = require('../dist/payments/schemas/payment.schema');
const { OrderMessageSchema } = require('../dist/orders/schemas/order-message.schema');
const { ServiceSchema } = require('../dist/services/schemas/service.schema');
const { SERVICES_SEED } = require('../dist/seed/services.data');

(async () => {
  if (process.env.NODE_ENV === 'production') throw Error('Demo seeding is only available locally.');
  await mongoose.connect('mongodb://127.0.0.1:27029/portable_store');
  const User = mongoose.model('User', UserSchema);
  const Order = mongoose.model('Order', OrderSchema);
  const Payment = mongoose.model('Payment', PaymentSchema);
  const Message = mongoose.model('OrderMessage', OrderMessageSchema);
  const Service = mongoose.model('Service', ServiceSchema);
  for (const service of SERVICES_SEED) await Service.updateOne({ slug: service.slug }, { $set: service }, { upsert: true });
  const email = 'client@portable.local';
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email, name: 'Alex Morgan', passwordHash: await argon2.hash('PortableDemo2026!'), billingAddress: { addressLine1: '24 Kingsway', city: 'London', postalCode: 'WC2B 6LE', countryCode: 'GB' } });
  let manager = await User.findOne({ email: 'manager@portable.local' });
  if (!manager) manager = await User.create({ email: 'manager@portable.local', name: 'Jamie · Portable team', role: 'admin', passwordHash: await argon2.hash(require('crypto').randomBytes(32).toString('hex')) });
  const services = await Service.find({ published: true }).limit(6);
  const statuses = ['in_progress', 'awaiting_payment', 'in_review', 'completed', 'paid', 'cancelled'];
  for (let i = 0; i < statuses.length; i++) {
    const orderNumber = String(810001 + i);
    if (await Order.exists({ orderNumber })) continue;
    const service = services[i % services.length];
    const total = [245000, 85000, 125000, 180000, 64000, 42000][i];
    const createdAt = new Date(Date.now() - (i + 1) * 86400000 * 3);
    const order = await Order.create({ orderNumber, userId: user._id, customer: { name: user.name, email }, billing: user.billingAddress,
      items: [{ serviceId: service._id, slug: service.slug, title: service.title, model: 'fixed', unitAmount: total, units: 1, milestones: [], pricing: { baseTotal: total, billableHours: 0, hoursTotal: 0, volumeDiscountPercent: 0, volumeDiscountAmount: 0, total } }],
      subtotal: total, total, currency: 'EUR', status: statuses[i], note: i === 0 ? 'A clean, accessible experience for our upcoming launch.' : null,
      termsAcceptance: { version: '12 October 2026', acceptedAt: createdAt }, createdAt,
    });
    if (!['awaiting_payment', 'cancelled'].includes(statuses[i])) await Payment.create({ orderId: order._id, userId: user._id, referenceId: orderNumber, amount: total, currency: 'EUR', status: 'paid', paidAt: createdAt });
    await Message.create({ orderId: order._id, authorId: manager._id, authorRole: 'admin', authorName: manager.name,
      body: i === 0 ? 'Hi Alex! We have started your project. The initial direction is ready for discussion — share any references or questions here and we will keep everything in one place.' : i === 2 ? 'Your project is ready for review. Let us know your feedback here so we can take care of the final details.' : 'Welcome, Alex. This conversation is your direct line to the team for this order.',
      readByAdminAt: new Date(), readByCustomerAt: i < 3 ? null : new Date(), createdAt,
    });
  }
  console.log('Local demo ready: client@portable.local / PortableDemo2026!');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
