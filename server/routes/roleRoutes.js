const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Role = require('../models/Role');
const authMiddleware = require('../middleware/authMiddleware');

const DEFAULT_ROLE_NAMES = [
  'Managing Director',
  'Director',
  'Business Development Manager',
  'Sales Executive',
  'Operations Manager',
  'Operations Executive',
  'Pricing Manager',
  'Pricing Executive',
  'Logistics Coordinator',
  'Account Manager',
  'HR Manager',
  'IT Specialist',
  'Customer Service Representative',
];

const requireAdminOrHod = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'hod') return next();
  return res.status(403).json({ message: 'Only Admin or HOD can modify roles' });
};

/** Ensure every default role exists (idempotent; safe to run on every GET). */
async function ensureDefaultRoles() {
  for (const name of DEFAULT_ROLE_NAMES) {
    await Role.updateOne(
      { name },
      { $setOnInsert: { name } },
      { upsert: true }
    );
  }
}

// GET /api/roles — list roles (defaults are upserted so the dropdown always has the classic list)
router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureDefaultRoles();
    const roles = await Role.find().sort({ name: 1 }).lean();
    res.json({ roles });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching roles', error: error.message });
  }
});

// POST /api/roles — create role
router.post('/', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Role name is required' });
    }
    const role = new Role({ name });
    await role.save();
    res.status(201).json(role);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Role already exists' });
    }
    res.status(500).json({ message: 'Error creating role', error: error.message });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid role id' });
    }
    const role = await Role.findByIdAndDelete(id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json({ message: 'Deleted', role });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting role', error: error.message });
  }
});

module.exports = router;
