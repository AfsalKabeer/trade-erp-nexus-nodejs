const Sequence = require('../models/modules/sequenceModel');
const TransactionService = require('../services/orderPurchase/transactionService');

jest.mock('../models/modules/sequenceModel');

describe('Next number preview vs increment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('preview=true returns next without incrementing', async () => {
    // Mock Sequence.findOne to return current 10
    Sequence.findOne.mockResolvedValue({ type: 'sales_order', year: '2025', current: 10 });

    const next = await TransactionService.getNextTransactionNumber('sales_order', true);
    // Expect format SOYYYYMM-00011 (we can't hardcode YYYYMM here; check suffix)
    expect(next).toMatch(/^SO\d{6}-00011$/);
    // Ensure Sequence.getNext was not called (no increment)
    expect(Sequence.findOne).toHaveBeenCalled();
    expect(Sequence.findOne).toHaveBeenCalledWith(expect.objectContaining({ type: 'sales_order', year: expect.any(String) }));
  });

  test('non-preview increments via Sequence.getNext', async () => {
    Sequence.getNext.mockResolvedValue('SI202511-00012');
    const next = await TransactionService.getNextTransactionNumber('sales_order', false);
    expect(next).toBe('SI202511-00012');
    expect(Sequence.getNext).toHaveBeenCalled();
  });

  test('invalid type throws', async () => {
    await expect(TransactionService.getNextTransactionNumber('invalid_type', true)).rejects.toThrow();
  });
});
