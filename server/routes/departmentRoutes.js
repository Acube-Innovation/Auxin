const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Department = require('../models/Department');
const authMiddleware = require('../middleware/authMiddleware');

const DEFAULT_DEPARTMENT_NAMES = [
  'Bulk Sales',
  'Bulk Operations',
  'Project Sales',
  'Project Operations',
  'HR',
  'Finance',
  'IT',
  'Logistics',
  'Customer Service',
];

const requireAdminOrHod = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'hod') return next();
  return res.status(403).json({ message: 'Only Admin or HOD can modify departments' });
};

/** Ensure every default department exists (idempotent; safe to run on every GET). */
async function ensureDefaultDepartments() {
  for (const name of DEFAULT_DEPARTMENT_NAMES) {
    await Department.updateOne(
      { name },
      { $setOnInsert: { name } },
      { upsert: true }
    );
  }
}

// GET /api/departments — list departments (defaults are upserted so the dropdown always has the classic list)
router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureDefaultDepartments();
    const docs = await Department.find().sort({ name: 1 }).lean();
    const defaultSet = new Set(DEFAULT_DEPARTMENT_NAMES.map((n) => n.toLowerCase()));
    const departments = docs.map((d) => ({
      ...d,
      isDefault: defaultSet.has(String(d.name || '').toLowerCase()),
    }));
    res.json({ departments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching departments', error: error.message });
  }
});

// POST /api/departments — create department
router.post('/', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }
    const department = new Department({ name });
    await department.save();
    res.status(201).json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Department already exists' });
    }
    res.status(500).json({ message: 'Error creating department', error: error.message });
  }
});

// DELETE /api/departments/:id
router.delete('/:id', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid department id' });
    }
    const target = await Department.findById(id);
    if (!target) {
      return res.status(404).json({ message: 'Department not found' });
    }
    const defaultSet = new Set(DEFAULT_DEPARTMENT_NAMES.map((n) => n.toLowerCase()));
    if (defaultSet.has(String(target.name || '').toLowerCase())) {
      return res.status(400).json({ message: 'Default departments cannot be deleted' });
    }
    await Department.findByIdAndDelete(id);
    res.json({ message: 'Deleted', department: target });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting department', error: error.message });
  }
});

module.exports = router;
