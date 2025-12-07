const mongoose = require("mongoose");

// Generic sequence schema that can be used for customers, vendors, orders, invoices, etc.
// type: logical sequence bucket (e.g., 'customer', 'vendor', 'sales_order', 'purchase_order', 'sales_invoice', 'purchase_invoice')
// year: optional partition key when sequences reset annually
const sequenceSchema = new mongoose.Schema({
  year: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    enum: [
      "vendor",
      "customer",
      "sales_order",
      "purchase_order",
      "sales_invoice",
      "purchase_invoice",
    ],
    required: true,
  },
  prefix: {
    type: String,
    default: "",
  },
  current: {
    type: Number,
    default: 0,
  },
  padding: {
    type: Number,
    default: 4,
  },
});

// Unique index per type (+ optional year)
sequenceSchema.index({ type: 1, year: 1 }, { unique: true });

// Helper to atomically get next sequence
sequenceSchema.statics.getNext = async function (type, opts = {}) {
  const { year = null, prefix = "", padding = 4 } = opts;

  // Use a simple retry loop with exponential backoff
  const maxRetries = 10;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // First, try to find and update existing document
      let doc = await this.findOneAndUpdate(
        { type, year },
        { $inc: { current: 1 } },
        { new: true, upsert: false }
      );

      if (doc) {
        const number = String(doc.current).padStart(doc.padding || padding, "0");
        return `${doc.prefix || prefix}${number}`;
      }

      // Document doesn't exist, try to create it
      try {
        doc = await this.findOneAndUpdate(
          { type, year },
          { $inc: { current: 1 }, $setOnInsert: { prefix, padding, year } },
          { new: true, upsert: true }
        );

        if (doc) {
          const number = String(doc.current).padStart(doc.padding || padding, "0");
          return `${doc.prefix || prefix}${number}`;
        }
      } catch (upsertError) {
        if (upsertError.code === 11000) {
          // Another process created the document, retry the findOneAndUpdate
          continue;
        }
        throw upsertError;
      }

      // If we get here, wait and retry
      await new Promise(resolve => setTimeout(resolve, Math.min(100 * Math.pow(2, attempt), 2000)));
      continue;

    } catch (error) {
      lastError = error;
      if (error.code === 11000) {
        // Duplicate key error, wait and retry
        await new Promise(resolve => setTimeout(resolve, Math.min(100 * Math.pow(2, attempt), 2000)));
        continue;
      }
      // Other errors, don't retry
      break;
    }
  }

  throw new Error(`Failed to generate next sequence number after ${maxRetries} retries. Last error: ${lastError?.message}`);
};

module.exports = mongoose.model("Sequence", sequenceSchema);
