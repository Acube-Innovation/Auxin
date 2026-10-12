// Vessel Operations module (Phase 2). Mounted at /api/ops in server.js.
// Every route here requires a valid login and one of the operations roles.
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const requireRole = require('../../middleware/requireRole');
const { ALL_OPS, ADMIN } = require('../../services/ops/roles');

router.use(authMiddleware, requireRole(ALL_OPS));

router.use('/lookups', require('./lookups'));
router.use('/', require('./masters'));
router.use('/voyages', require('./voyages'));
router.use('/tasks', require('./tasks'));
router.use('/dashboard', require('./dashboard'));
router.use('/reports', require('./reports'));
router.use('/jobs', requireRole(ADMIN), require('./jobs'));

module.exports = router;
