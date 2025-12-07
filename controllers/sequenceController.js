const AppError = require('../utils/AppError');
const Sequence = require('../models/modules/sequenceModel');

// Preview next sequence without incrementing the persistent counter
exports.preview = async (req, res, next) => {
  try {
    const { type, date } = req.query;
    if (!type) throw new AppError('Missing query parameter: type', 400);

    // Accept short codes (PO, SO, SI) or full names
    const mapping = {
      PO: { seqType: 'purchase_order', prefix: 'PO' },
      SO: { seqType: 'sales_order', prefix: 'SO' },
      SI: { seqType: 'sales_invoice', prefix: '' },
      PI: { seqType: 'purchase_invoice', prefix: '' },
      purchase_order: { seqType: 'purchase_order', prefix: 'PO' },
      sales_order: { seqType: 'sales_order', prefix: 'SO' },
      sales_invoice: { seqType: 'sales_invoice', prefix: '' },
      purchase_invoice: { seqType: 'purchase_invoice', prefix: '' },
    };

    const key = String(type).toUpperCase();
    const map = mapping[key] || mapping[type];
    if (!map) throw new AppError(`Unsupported sequence type: ${type}`, 400);

    // Parse date if provided (expect YYYYMM), otherwise use current date
    const now = new Date();
    let year = now.getFullYear();
    let month = String(now.getMonth() + 1).padStart(2, '0');
    if (date) {
      const s = String(date);
      if (s.length === 6) {
        year = parseInt(s.slice(0, 4), 10);
        month = s.slice(4, 6);
      } else if (s.length === 4) {
        year = parseInt(s, 10);
      } else {
        throw new AppError('Invalid date format. Use YYYYMM or YYYY', 400);
      }
    }

    // For yearly partitioning, Sequence uses year string (e.g., '2025')
    const yearStr = String(year);

    // Sales invoices are global (no year partition used in Sequence.getNext usage)
    if (map.seqType === 'sales_invoice') {
      const seqDoc = await Sequence.findOne({ type: map.seqType, year: null });
      const current = (seqDoc && typeof seqDoc.current === 'number') ? seqDoc.current : 0;
      const next = String(current + 1).padStart(5, '0');
      return res.json({ success: true, data: { next } });
    }

    // For purchase_order / sales_order, prefix with YYYYMM-
    const yyyymm = `${yearStr}${month}`;
    const prefix = map.prefix ? `${map.prefix}${yyyymm}-` : '';

    const seqDoc = await Sequence.findOne({ type: map.seqType, year: yearStr });
    const current = (seqDoc && typeof seqDoc.current === 'number') ? seqDoc.current : 0;
    const nextNum = current + 1;
    const padded = String(nextNum).padStart(5, '0');
    const next = `${prefix}${padded}`;

    return res.json({ success: true, data: { next } });
  } catch (err) {
    return next(err);
  }
};
