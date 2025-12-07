const express = require('express');
const router = express.Router();
const SequenceController = require('../../controllers/sequenceController');

// GET /preview?type=PO&date=YYYYMM
router.get('/preview', SequenceController.preview);

module.exports = router;
