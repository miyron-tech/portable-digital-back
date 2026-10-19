// Run after npm run build. Uses an isolated temporary database and a fake provider.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const mongoose = require('mongoose');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { EstimateService } = require('../dist/estimate/estimate.service');
const { OrdersService } = require('../dist/orders/orders.service');
const { PaymentsService } = require('../dist/payments/payments.service');
const { EditOrderDto } = require('../dist/orders/dto/edit-order.dto');

test('order editing, payment exclusion and retry pricing', async t => {
  const db = await mongoose.createConnection(`mongodb://127.0.0.1:27029/portable_order_edit_test_${process.pid}_${Date.now()}`).asPromise();
  t.after(async () => { await db.dropDatabase(); await db.close(); });
  const model = (name, path) => db.model(name, require(`../dist/${path}`)[`${name}Schema`]);
  const Order = model('Order', 'orders/schemas/order.schema');
  const Payment = model('Payment', 'payments/schemas/payment.schema');
  const Service = model('Service', 'services/schemas/service.schema');
  const User = model('User', 'users/schemas/user.schema');
  const Message = model('OrderMessage', 'orders/schemas/order-message.schema');
  const Estimate = model('Estimate', 'estimate/schemas/estimate.schema');
  await Promise.all([Order, Payment, Service, User, Message, Estimate].map(m => m.init()));
  const estimates = new EstimateService(Estimate, Service);
  const orders = new OrdersService(estimates, Order, Estimate, Service, User, Payment, Message);
  const billing = { addressLine1: 'Test street', city: 'Test city', postalCode: '12345', countryCode: 'GB' };
  const user = await User.create({ name: 'Order Tester', email: 'orders@example.test', passwordHash: 'unused', billingAddress: billing });
  const service = await Service.create({ title: 'Test development', slug: 'test-development', summary: 'Test', description: 'Test', category: 'development', published: true, pricing: [
    { model: 'hourly', amount: 1000, minUnits: 1, maxUnits: 100, tiers: [{ minHours: 10, discountPercent: 10 }] },
    { model: 'fixed', amount: 5000, milestones: [{ key: 'base', title: 'Base', amount: 3000, required: true }, { key: 'extra', title: 'Extra', amount: 2000 }] },
    { model: 'retainer', amount: 10000, period: 'month', overageAmount: 1000 },
  ] });
  const line = { serviceId: service.id, model: 'hourly', units: 2 };
  const priced = await estimates.price({ items: [line] });
  let number = 100000;
  const create = (extra = {}) => Order.create({ orderNumber: String(++number), userId: user._id, items: priced.items, customer: { name: user.name, email: user.email }, billing, currency: 'EUR', subtotal: priced.subtotal, total: priced.total, status: 'awaiting_payment', termsAcceptance: { version: 'test', acceptedAt: new Date() }, ...extra });
  const dto = { revision: 0, items: [{ ...line, units: 10 }], note: 'Updated brief' };
  await t.test('validation rejects empty items, negative quantities and missing revision', async () => {
    for (const input of [{ items: [line] }, { revision: 0, items: [] }, { revision: 0, items: [{ ...line, units: -1 }] }]) {
      assert.ok((await validate(plainToInstance(EditOrderDto, input))).length);
    }
  });
  await t.test('preview is read-only; save retains number, discount and audit snapshot', async () => {
    const order = await create({ discount: { type: 'percent', value: 10 } });
    const quote = await orders.previewEdit(order.orderNumber, user.id, dto);
    assert.equal(quote.total, 8100);
    assert.equal((await Order.findById(order.id)).total, 2000);
    const saved = await orders.edit(order.orderNumber, user.id, { ...dto, quoteToken: quote.quoteToken });
    assert.equal(saved.orderNumber, order.orderNumber); assert.equal(saved.total, 8100); assert.equal(saved.revision, 1);
    assert.equal(saved.note, 'Updated brief'); assert.equal(saved.changes[0].before.total, 2000); assert.equal(saved.changes[0].after.total, 8100);
    assert.equal(saved.canEdit, true); assert.equal(saved.mutationLock, undefined);
    await assert.rejects(orders.edit(order.orderNumber, user.id, { ...dto, quoteToken: quote.quoteToken }), /changed/);
  });
  await t.test('ownership and lifecycle checked server-side', async () => {
    const order = await create();
    await assert.rejects(orders.previewEdit(order.orderNumber, new mongoose.Types.ObjectId().toString(), dto), /not found/);
    for (const status of ['paid', 'in_progress', 'in_review', 'completed', 'cancelled']) {
      await Order.updateOne({ _id: order._id }, { $set: { status } });
      await assert.rejects(orders.edit(order.orderNumber, user.id, dto), /awaiting payment/);
    }
  });
  await t.test('new price or forged quote cannot be silently accepted', async () => {
    const order = await create(); const quote = await orders.previewEdit(order.orderNumber, user.id, dto);
    await assert.rejects(orders.edit(order.orderNumber, user.id, { ...dto, quoteToken: 'forged' }), /Prices/);
    await Service.updateOne({ _id: service._id }, { $set: { 'pricing.0.amount': 1100 } });
    await assert.rejects(orders.edit(order.orderNumber, user.id, { ...dto, quoteToken: quote.quoteToken }), /Prices/);
    await Service.updateOne({ _id: service._id }, { $set: { 'pricing.0.amount': 1000 } });
  });
  await t.test('plan changes, required milestones, additional services and removal', async () => {
    const order = await create();
    const draft = { revision: 0, items: [{ ...line, model: 'fixed', units: 1, milestoneKeys: ['extra'] }, { ...line, model: 'retainer', units: 2, extraHours: 3 }] };
    const quote = await orders.previewEdit(order.orderNumber, user.id, draft);
    assert.equal(quote.total, 28000); assert.equal(quote.items[0].milestones.length, 2);
    const saved = await orders.edit(order.orderNumber, user.id, { ...draft, quoteToken: quote.quoteToken }); assert.equal(saved.items.length, 2);
    const smaller = { revision: 1, items: [line] }; const next = await orders.previewEdit(order.orderNumber, user.id, smaller);
    assert.equal((await orders.edit(order.orderNumber, user.id, { ...smaller, quoteToken: next.quoteToken })).items.length, 1);
  });
  await t.test('active, paid, refunded and reviewed payments block edits', async () => {
    const order = await create(); const payment = await Payment.create({ orderId: order._id, userId: user._id, referenceId: order.orderNumber, amount: order.total, currency: 'EUR' });
    for (const status of ['created', 'pending', 'authorized', 'awaiting_approval', 'paid', 'refunded']) {
      await Payment.updateOne({ _id: payment._id }, { $set: { status } });
      await assert.rejects(orders.previewEdit(order.orderNumber, user.id, dto), /payment is active/);
    }
    await Payment.updateOne({ _id: payment._id }, { $set: { status: 'declined', needsReview: true } });
    await assert.rejects(orders.previewEdit(order.orderNumber, user.id, dto), /payment is active/);
  });
  await t.test('only one concurrent save wins and locks release after failures', async () => {
    const order = await create(); const quote = await orders.previewEdit(order.orderNumber, user.id, dto);
    const saves = await Promise.allSettled([1, 2].map(() => orders.edit(order.orderNumber, user.id, { ...dto, quoteToken: quote.quoteToken })));
    assert.equal(saves.filter(s => s.status === 'fulfilled').length, 1);
    assert.equal((await Order.findById(order.id)).changes.length, 1);
    await assert.rejects(orders.withMutationLock(order.id, async () => { throw Error('test failure'); }), /test failure/);
    await orders.withMutationLock(order.id, async () => {});
  });
  await t.test('payment arriving during edit prevents overwriting its paid status', async () => {
    const order = await create(); const quote = await orders.previewEdit(order.orderNumber, user.id, dto);
    const originalPrice = estimates.price.bind(estimates);
    estimates.price = async input => { const result = await originalPrice(input); await orders.markPaid(order.id); return result; };
    try { await assert.rejects(orders.edit(order.orderNumber, user.id, { ...dto, quoteToken: quote.quoteToken }), /paid while/); }
    finally { estimates.price = originalPrice; }
    const unchanged = await Order.findById(order.id); assert.equal(unchanged.total, 2000); assert.equal(unchanged.status, 'paid');
  });
  await t.test('retry uses a new reference and revised total; initiation excludes edits', async () => {
    const order = await create();
    await Payment.create({ orderId: order._id, userId: user._id, referenceId: order.orderNumber, amount: order.total, currency: 'EUR', status: 'declined', providerPaymentId: 'old-payment', redirectUrl: 'https://example.test/old' });
    const quote = await orders.previewEdit(order.orderNumber, user.id, dto);
    await orders.edit(order.orderNumber, user.id, { ...dto, quoteToken: quote.quoteToken });
    let request;
    const provider = { configured: true, mapState: () => 'created', findByReferenceId: async () => null, createPayment: async input => {
      request = input;
      await assert.rejects(orders.withMutationLock(order.id, async () => {}), /already being processed/);
      return { id: 'new-payment', state: 'CREATED', amount: input.amountMinor / 100, currency: input.currency, redirectUrl: 'https://example.test/new' };
    } };
    const payments = new PaymentsService(Payment, User, provider, orders, { enqueueSafe: async () => {} });
    const result = await payments.initiate(user.id, order.orderNumber);
    assert.equal(request.amountMinor, 9000); assert.equal(request.referenceId, `PD-${order.orderNumber}-2`); assert.equal(result.redirectUrl, 'https://example.test/new');
    assert.equal((await Payment.findOne({ orderId: order._id })).amount, 9000);
    await assert.rejects(orders.previewEdit(order.orderNumber, user.id, { ...dto, revision: 1 }), /payment is active/);
  });
});
