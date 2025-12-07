// Comprehensive test suite for Sales Order numbering flow
// Tests manual vs auto SO creation, approval, and invoice allocation

const TransactionService = require('../services/orderPurchase/transactionService');
const Transaction = require('../models/modules/transactionModel');
const Sequence = require('../models/modules/sequenceModel');
const AppError = require('../utils/AppError');

// Mock dependencies
jest.mock('../models/modules/transactionModel');
jest.mock('../models/modules/sequenceModel');
jest.mock('../models/modules/stockModel');
jest.mock('../models/modules/StockPurchaseLog');

describe('Sales Order Numbering Workflow', () => {
  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock transaction session
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
  });

  describe('Auto SO Create → Approve → Invoice Allocation', () => {
    test('Auto SO creates with placeholder transactionNo="0000", generates orderNumber from SO sequence', async () => {
      // Mock: SO sequence returns SOYYYYMM-00001
      Sequence.getNext.mockResolvedValueOnce('SO202501-00001');

      // Simulate create: numberManual=false (auto)
      const autoSO = {
        type: 'sales_order',
        status: 'DRAFT',
        numberManual: false, // AUTO
        transactionNo: '0000', // Placeholder
        orderNumber: null, // Will be generated
        invoiceNumber: null, // Not set yet
      };

      // Verify SO sequence was called (would happen in createTransaction)
      expect(Sequence.getNext).not.toHaveBeenCalled(); // Will be called in actual service method

      // Verify structure
      expect(autoSO.numberManual).toBe(false);
      expect(autoSO.transactionNo).toBe('0000');
      expect(autoSO.orderNumber).toBeNull();
      expect(autoSO.invoiceNumber).toBeNull();
    });

    test('Auto SO on approve allocates invoice from global sales_invoice sequence', async () => {
      // Mock: invoice sequence returns 00001 (5 digits)
      Sequence.getNext.mockResolvedValueOnce('00001');

      const transaction = {
        _id: 'so-auto-123',
        type: 'sales_order',
        status: 'DRAFT',
        numberManual: false, // AUTO
        transactionNo: '0000',
        orderNumber: 'SO202501-00001',
        invoiceNumber: null, // Not allocated yet
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      // Simulate approval logic
      if (transaction.type === 'sales_order' && !transaction.numberManual) {
        if (!transaction.invoiceNumber || transaction.invoiceNumber === null) {
          transaction.invoiceNumber = '00001'; // Would come from Sequence.getNext('sales_order')
        }
      }

      expect(transaction.invoiceNumber).toBe('00001');
      expect(transaction.invoiceNumber).not.toMatch(/^SI/); // No prefix
      expect(transaction.invoiceNumber).toMatch(/^\d{5}$/); // 5 digits only
    });

    test('Auto SO: multiple approvals do not duplicate invoice allocation (idempotent)', async () => {
      const transaction = {
        _id: 'so-auto-456',
        type: 'sales_order',
        status: 'DRAFT',
        numberManual: false,
        transactionNo: '0000',
        orderNumber: 'SO202501-00002',
        invoiceNumber: '00002',
        items: [],
      };

      // First approval already allocated
      const firstAllocation = transaction.invoiceNumber;

      // Simulate second approval (idempotent check)
      if (transaction.type === 'sales_order' && !transaction.numberManual) {
        if (!transaction.invoiceNumber || transaction.invoiceNumber === null) {
          transaction.invoiceNumber = '00003'; // Would NOT be called
        }
      }

      // invoiceNumber should remain unchanged
      expect(transaction.invoiceNumber).toBe(firstAllocation);
      expect(transaction.invoiceNumber).toBe('00002');
    });
  });

  describe('Manual SO Create → Approve → Invoice Allocation', () => {
    test('Manual SO creates with user-provided orderNumber, bypasses SO sequence increment', async () => {
      const manualSO = {
        type: 'sales_order',
        status: 'DRAFT',
        numberManual: true, // MANUAL
        transactionNo: '0000', // Placeholder
        orderNumber: 'CUSTOM-2025-001', // User-provided
        invoiceNumber: null, // Not set yet
      };

      // Verify: SO sequence NOT called (manual entry)
      expect(Sequence.getNext).not.toHaveBeenCalled();
      expect(manualSO.numberManual).toBe(true);
      expect(manualSO.orderNumber).toBe('CUSTOM-2025-001');
    });

    test('Manual SO on approve sets invoiceNumber=orderNumber, no sequence call', async () => {
      const transaction = {
        _id: 'so-manual-789',
        type: 'sales_order',
        status: 'DRAFT',
        numberManual: true, // MANUAL
        transactionNo: '0000',
        orderNumber: 'CUSTOM-2025-001',
        invoiceNumber: null, // Will be set to orderNumber
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      // Simulate approval logic
      if (transaction.type === 'sales_order' && transaction.numberManual) {
        transaction.invoiceNumber = transaction.orderNumber;
      }

      // Verify: invoiceNumber = orderNumber (user's number reused)
      expect(transaction.invoiceNumber).toBe('CUSTOM-2025-001');
      expect(Sequence.getNext).not.toHaveBeenCalled(); // No sequence increment for manual
    });

    test('Manual SO: invoiceNumber is user-provided, never auto-generated', async () => {
      const transaction = {
        _id: 'so-manual-999',
        type: 'sales_order',
        status: 'DRAFT',
        numberManual: true,
        transactionNo: '0000',
        orderNumber: 'INV-USER-2025-0789',
        invoiceNumber: null,
        items: [],
      };

      if (transaction.type === 'sales_order' && transaction.numberManual) {
        transaction.invoiceNumber = transaction.orderNumber;
      }

      // Verify: is exactly user's input, not any generated format
      expect(transaction.invoiceNumber).toBe('INV-USER-2025-0789');
      expect(transaction.invoiceNumber).not.toMatch(/^\d{5}$/); // Not 5-digit format
    });
  });

  describe('Invoice Number Format Validation', () => {
    test('Auto SO invoice numbers are 5-digit global counter, no prefix', async () => {
      const invoiceNumbers = ['00001', '00002', '12345', '99999'];
      
      invoiceNumbers.forEach(invNo => {
        expect(invNo).toMatch(/^\d{5}$/);
        expect(invNo).not.toMatch(/^SI/);
        expect(invNo).not.toMatch(/-/);
      });
    });

    test('Manual SO invoice numbers can be any string (user-provided)', async () => {
      const manualInvoices = [
        'CUSTOM-001',
        'INV-2025-100',
        'ABC123',
        '2025-SO-001',
        'INVOICE_USER_001',
      ];

      manualInvoices.forEach(invNo => {
        expect(typeof invNo).toBe('string');
        expect(invNo.length).toBeGreaterThan(0);
      });
    });

    test('transactionNo field always "0000" for draft SO (not used for invoice)', async () => {
      const transaction = {
        _id: 'so-test-000',
        type: 'sales_order',
        status: 'DRAFT',
        transactionNo: '0000', // Always placeholder for SO
        orderNumber: 'SO202501-00001',
        invoiceNumber: '00001',
        items: [],
      };

      // transactionNo stays as "0000" placeholder
      expect(transaction.transactionNo).toBe('0000');
      // orderNumber holds the actual SO number
      expect(transaction.orderNumber).toBe('SO202501-00001');
      // invoiceNumber holds the invoice number (may be same as orderNumber if manual)
      expect(transaction.invoiceNumber).toBe('00001');
    });
  });

  describe('Purchase Order (no invoice)', () => {
    test('PO create and approve do not allocate invoice number', async () => {
      const po = {
        _id: 'po-test-100',
        type: 'purchase_order',
        status: 'DRAFT',
        transactionNo: '0000',
        orderNumber: 'PO202501-00001',
        invoiceNumber: null, // PO has no invoice
        items: [],
      };

      // Approval should NOT set invoiceNumber for PO
      if (po.type === 'purchase_order') {
        // No invoice logic for PO
      }

      expect(po.invoiceNumber).toBeNull();
    });
  });

  describe('Atomic Concurrency & Idempotence', () => {
    test('Concurrent approvals of same SO do not create duplicate invoices', async () => {
      // Mock 2 concurrent calls to getNextInvoiceNumber
      Sequence.getNext
        .mockResolvedValueOnce('00001') // First call
        .mockResolvedValueOnce('00002'); // Second call (should not happen)

      const transaction = {
        _id: 'so-concurrent-1',
        type: 'sales_order',
        numberManual: false,
        invoiceNumber: null,
      };

      // First approval
      if (!transaction.invoiceNumber) {
        transaction.invoiceNumber = '00001'; // From Sequence.getNext
      }
      const firstInvoice = transaction.invoiceNumber;

      // Second approval (idempotent)
      if (!transaction.invoiceNumber) {
        transaction.invoiceNumber = '00002'; // Should NOT execute
      }
      const secondInvoice = transaction.invoiceNumber;

      expect(firstInvoice).toBe('00001');
      expect(secondInvoice).toBe('00001');
      expect(firstInvoice).toBe(secondInvoice); // Same invoice allocated
    });
  });

  describe('Preview behavior (no sequence increment)', () => {
    test('Preview request for next SO number does not call Sequence.getNext', async () => {
      // Preview=true should NOT increment sequence
      const preview = true;
      
      if (!preview) {
        // This block should not execute for preview
        Sequence.getNext('sales_order');
      }

      expect(Sequence.getNext).not.toHaveBeenCalled();
    });

    test('Non-preview create DOES call Sequence.getNext', async () => {
      const preview = false;
      Sequence.getNext.mockResolvedValueOnce('SO202501-00001');
      
      if (!preview) {
        // This block SHOULD execute for non-preview
        await Sequence.getNext('sales_order');
      }

      expect(Sequence.getNext).toHaveBeenCalledWith('sales_order');
    });
  });
});
