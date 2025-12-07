const mongoose = require("mongoose");
const Vendor = require("../../models/modules/vendorModel");
const AppError = require("../../utils/AppError");
const Sequence = require("../../models/modules/sequenceModel");
const logger = require("../../utils/logger");

// Helper to get the next sequence number without saving it
const getNextSequenceNumber = async (year, type, session) => {
  try {
    let sequence = await Sequence.findOne({ year, type }).session(session);

    if (!sequence) {
      const [newSequence] = await Sequence.create(
        [{ year, type, usedNumbers: [], deletedNumbers: [] }],
        { session }
      );
      sequence = newSequence;
    }

    if (!sequence) {
      throw new AppError("Failed to initialize sequence document", 500);
    }

    const usedNumbers = Array.isArray(sequence.usedNumbers)
      ? sequence.usedNumbers
      : [];
    const deletedNumbers = Array.isArray(sequence.deletedNumbers)
      ? sequence.deletedNumbers
      : [];

    if (deletedNumbers.length > 0) {
      return Math.min(...deletedNumbers);
    }

    if (usedNumbers.length > 0) {
      return Math.max(...usedNumbers) + 1;
    }

    // Fallback: derive next number from existing vendors if arrays are empty
    const prefix = `VEND${year}`;
    const existing = await Vendor.find({ vendorId: new RegExp(`^${prefix}\\d{3}$`) })
      .select('vendorId')
      .lean()
      .session(session);
    if (existing && existing.length > 0) {
      const maxSuffix = existing
        .map(v => parseInt(v.vendorId.slice(prefix.length), 10))
        .filter(n => !isNaN(n))
        .reduce((a, b) => Math.max(a, b), 0);
      return maxSuffix + 1;
    }

    return 1;
  } catch (error) {
    throw new AppError(
      `Sequence number generation failed: ${error.message}`,
      500
    );
  }
};

// Commit sequence number to usedNumbers after successful vendor creation
const commitSequenceNumber = async (year, type, sequenceNumber, session) => {
  try {
    await Sequence.findOneAndUpdate(
      { year, type },
      {
        $pull: { deletedNumbers: sequenceNumber },
        $addToSet: { usedNumbers: sequenceNumber },
      },
      { session }
    );
  } catch (error) {
    throw new AppError(
      `Failed to commit sequence number: ${error.message}`,
      500
    );
  }
};

// Release a sequence number to deletedNumbers on deletion
const releaseSequenceNumber = async (vendorId, session) => {
  try {
    const year = vendorId.slice(4, 8); // Extract year from VENDYYYYNNN
    const sequenceNumber = parseInt(vendorId.slice(8), 10); // Extract number
    await Sequence.findOneAndUpdate(
      { year, type: "vendor" },
      {
        $pull: { usedNumbers: sequenceNumber },
        $addToSet: { deletedNumbers: sequenceNumber },
      },
      { session }
    );
  } catch (error) {
    throw new AppError(
      `Failed to release sequence number: ${error.message}`,
      500
    );
  }
};

exports.createVendor = async (data) => {
  const {
    vendorName,
    contactPerson,
    email,
    phone,
    address,
    paymentTerms,
    status,
    trnNO,
  } = data;

  // Validate paymentTerms early to avoid sequence allocation
  const validPaymentTerms = [
    "30 days",
    "Net 30",
    "45 days",
    "Net 60",
    "60 days",
    "COD"
  ];
  if (paymentTerms && !validPaymentTerms.includes(paymentTerms)) {
    throw new AppError(
      `Invalid paymentTerms. Must be one of: ${validPaymentTerms.join(", ")}`,
      400
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const currentYear = new Date().getFullYear().toString();
    const sequenceNumber = await getNextSequenceNumber(
      currentYear,
      "vendor",
      session
    );
    const formattedNumber = sequenceNumber.toString().padStart(3, "0"); // Ensure 3 digits
    const newVendorId = `VEND${currentYear}${formattedNumber}`;

    logger.info("Vendor creation: sequence allocated", {
      year: currentYear,
      sequenceNumber,
      vendorId: newVendorId,
    });

    const trimmedPhone = phone
      ? phone.toString().trim().replace(/\s+/g, "")
      : null;
    const trimmedContactPerson = contactPerson
      ? contactPerson.toString().trim().replace(/\s+/g, "")
      : null;

    logger.debug("Vendor creation: payload prepared", {
      vendorId: newVendorId,
      vendorName,
      contactPerson: trimmedContactPerson,
      email,
      phone: trimmedPhone,
      paymentTerms: paymentTerms || "30 days",
      trnNO,
      status,
    });

    const [vendor] = await Vendor.create(
      [
        {
          vendorId: newVendorId,
          vendorName,
          contactPerson: trimmedContactPerson,
          email,
          phone: trimmedPhone,
          address,
          paymentTerms: paymentTerms || "30 days", // Use default if not provided
          status,
          trnNO,
        },
      ],
      { session }
    );

    await commitSequenceNumber(currentYear, "vendor", sequenceNumber, session);
    await session.commitTransaction();

    logger.info("Vendor creation: success", {
      vendorId: vendor.vendorId,
      _id: vendor._id,
      status: vendor.status,
    });
    return vendor;
  } catch (error) {
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortErr) {
      logger.warn("Vendor creation: abort failed or not needed", { message: abortErr.message });
    }
    logger.error("Vendor creation: failed", { message: error.message, stack: error.stack });
    throw error;
  } finally {
    session.endSession();
  }
};

exports.getAllVendors = async (filters) => {
  const query = {};
  if (filters.search) {
    query.$or = [
      { vendorId: new RegExp(filters.search, "i") },
      { vendorName: new RegExp(filters.search, "i") },
      { contactPerson: new RegExp(filters.search, "i") },
      { email: new RegExp(filters.search, "i") },
    ];
  }
  if (filters.status) query.status = filters.status;
  if (filters.paymentTerms) query.paymentTerms = filters.paymentTerms;

  return Vendor.find(query).sort({ createdAt: -1 });
};

exports.getVendorById = async (id) => {
  const vendor = await Vendor.findById(id);
  if (!vendor) throw new AppError("Vendor not found", 404);
  return vendor;
};

exports.updateVendor = async (id, data) => {
  const validPaymentTerms = [
    "30 days",
    "Net 30",
    "45 days",
    "Net 60",
    "60 days",
    "COD",
  ];
  if (data.paymentTerms && !validPaymentTerms.includes(data.paymentTerms)) {
    throw new AppError(
      `Invalid paymentTerms. Must be one of: ${validPaymentTerms.join(", ")}`,
      400
    );
  }

  const vendor = await Vendor.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!vendor) throw new AppError("Vendor not found", 404);
  return vendor;
};

exports.deleteVendor = async (id) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const vendor = await Vendor.findByIdAndDelete(id, { session });
    if (!vendor) throw new AppError("Vendor not found", 404);

    await releaseSequenceNumber(vendor.vendorId, session);
    await session.commitTransaction();
  } catch (error) {
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortErr) {
      logger.warn("Vendor deletion: abort failed or not needed", { message: abortErr.message });
    }
    throw error;
  } finally {
    session.endSession();
  }
};
