const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');

// POST /api/support/send
router.post('/send', supportController.sendSupportEmail);

module.exports = router;
