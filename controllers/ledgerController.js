// controllers/ledgerController.js

const LedgerService = require("../services/ledgerService");
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");

class LedgerController {
  static async getAllParties(req, res) {
    try {
      const parties = await LedgerService.getAllParties();
      res.json({ success: true, count: parties.length, data: parties });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getDebitAccounts(req, res) {
    try {
      const vendors = await LedgerService.getDebitAccounts();
      res.json({ success: true, count: vendors.length, data: vendors });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getCreditAccounts(req, res) {
    try {
      const customers = await LedgerService.getCreditAccounts();
      res.json({ success: true, count: customers.length, data: customers });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

static async getPartyLedger(req, res) {
  try {
    const { id } = req.params;
    let type = null;

    if (req.path.includes("/vendor/")) type = "Vendor";
    else if (req.path.includes("/customer/")) type = "Customer";
    else throw new AppError("Invalid party type in URL", 400);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid party ID", 400);
    }

    // Get filters from query string
    const { from, to, status, type: typeFilter } = req.query;

    const filters = {
      from: from || null,
      to: to || null,
      status: status || "all",
      type: typeFilter || "all",
    };

    const ledger = await LedgerService.getPartyLedger(type, id, filters);

    res.json({ success: true, data: ledger });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
}
}

module.exports = LedgerController;
