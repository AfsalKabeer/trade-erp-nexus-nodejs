const { buildOrderPayload, buildApprovePayload, validateManualNumber } = require('../client/helpers/orderPayload');

test('sales-auto: omit numbers', () => {
  const payload = buildOrderPayload('sales_order', { manual: false }, { partyId: 'p1', partyType: 'Customer' });
  expect(payload.type).toBe('sales_order');
  expect(payload.orderNumber).toBeUndefined();
  expect(payload.transactionNo).toBeUndefined();
});

test('sales-manual: include orderNumber and omit transactionNo', () => {
  const payload = buildOrderPayload('sales_order', { manual: true, orderNumber: 'SO202512-54321' }, { partyId: 'p1' });
  expect(payload.orderNumber).toBe('SO202512-54321');
  expect(payload.transactionNo).toBeUndefined();
});

test('purchase-auto: omit numbers', () => {
  const payload = buildOrderPayload('purchase_order', { manual: false }, { partyId: 'p2' });
  expect(payload.type).toBe('purchase_order');
  expect(payload.transactionNo).toBeUndefined();
  expect(payload.orderNumber).toBeUndefined();
});

test('purchase-manual: include transactionNo only', () => {
  const payload = buildOrderPayload('purchase_order', { manual: true, transactionNo: 'PO202512-00001' }, { partyId: 'p2' });
  expect(payload.transactionNo).toBe('PO202512-00001');
  expect(payload.orderNumber).toBeUndefined();
});

test('approve payload', () => {
  const body = buildApprovePayload();
  expect(body).toEqual({ action: 'approve' });
});

test('validate manual numbers', () => {
  expect(validateManualNumber('ABC-123')).toBe(true);
  expect(validateManualNumber('')).toBe(false);
  expect(validateManualNumber('with space')).toBe(false);
});
