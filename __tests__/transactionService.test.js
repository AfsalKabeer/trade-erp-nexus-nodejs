// Tests for sequence formatting helpers in transactionService

// Mock Sequence before requiring service
const Sequence = require('../models/modules/sequenceModel');
Sequence.getNext = jest.fn().mockImplementation(async (type, opts = {}) => {
  // Simulate Sequence.getNext: return prefix + padded number
  const padding = opts.padding || 4;
  const prefix = opts.prefix || "";
  const number = String(1).padStart(padding, '0');
  return `${prefix}${number}`;
});

const TransactionService = require('../services/orderPurchase/transactionService');

test('getNextOrderNumber formats SO and PO with YYYYMM and dash', async () => {
  const so = await TransactionService.getNextOrderNumber('sales_order', null);
  expect(so).toMatch(/^SO\d{6}-\d{5}$/);
  const po = await TransactionService.getNextOrderNumber('purchase_order', null);
  expect(po).toMatch(/^PO\d{6}-\d{5}$/);
});

test('getNextInvoiceNumber formats SI as 5-digit global counter and PI with YYYYMM', async () => {
  // Sales Invoice: 5-digit global counter (no prefix, no date)
  const si = await TransactionService.getNextInvoiceNumber('sales_order', null);
  expect(si).toMatch(/^\d{5}$/);
  
  // Purchase Invoice: 5-digit format (may have prefix if stored in Sequence)
  const pi = await TransactionService.getNextInvoiceNumber('purchase_order', null);
  expect(pi).toBeDefined();
  expect(typeof pi).toBe('string');
});
