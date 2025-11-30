const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const LedgerController = require("../controllers/ledgerController");

const router = express.Router();

router.use(authenticateToken);

router.get("/parties", LedgerController.getAllParties);

// SEPARATE PAGES
router.get("/debit-accounts", LedgerController.getDebitAccounts);   // Vendors only
router.get("/credit-accounts", LedgerController.getCreditAccounts); // Customers only

// Full ledger
router.get("/ledger/vendor/:id", LedgerController.getPartyLedger);
router.get("/ledger/customer/:id", LedgerController.getPartyLedger);
module.exports = router;