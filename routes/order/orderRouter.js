const express = require('express');
const router = express.Router();
const TransactionController = require('../../controllers/orderPurchase/transactionController');

// POST /api/v1/order -> create transaction (order)
router.post('/', TransactionController.createTransaction);

module.exports = router;
