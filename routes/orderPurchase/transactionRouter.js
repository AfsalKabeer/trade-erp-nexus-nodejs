const express = require("express");
const { authenticateToken } = require("../../middleware/authMiddleware");
const TransactionController = require("../../controllers/orderPurchase/transactionController");

const router = express.Router();

router.use(authenticateToken);

// Get next number (must be before :id to avoid matching as ID)
router.get("/next-number", TransactionController.getNextNumber);

router.post("/transactions", TransactionController.createTransaction);
router.get("/transactions", TransactionController.getAllTransactions);
router.get("/transactions/:id", TransactionController.getTransactionById);
router.put("/transactions/:id", TransactionController.updateTransaction);
router.delete("/transactions/:id", TransactionController.deleteTransaction);
router.patch(
  "/transactions/:id/process",
  TransactionController.processTransaction
);


module.exports = router;