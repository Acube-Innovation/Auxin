// Vessel Operations module (Phase 2). Mounted at /api/ops in server.js.
// Every route here requires a valid login and one of the operations roles.
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const requireRole = require('../../middleware/requireRole');
const { ALL_OPS } = require('../../services/ops/roles');

router.use(authMiddleware, requireRole(ALL_OPS));

router.use('/lookups', require('./lookups'));

module.exports = router;
