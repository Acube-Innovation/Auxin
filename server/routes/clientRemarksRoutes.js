const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ClientRemark = require('../models/ClientRemark');
const Client = require('../models/Client');
const User = require('../models/User');

// Mounted at /api/client-remarks, so GET /api/client-remarks/:clientId
router.get('/:clientId', authMiddleware, async (req, res) => {
  try {
    const remarks = await ClientRemark.find({ clientId: req.params.clientId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(remarks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching remarks', error: error.message });
  }
});

// POST /api/client-remarks/:clientId
router.post('/:clientId', authMiddleware, async (req, res) => {
  try {
    const text = req.body?.text != null ? String(req.body.text).trim() : '';
    if (!text) {
      return res.status(400).json({ message: 'Remark text cannot be empty' });
    }
    const client = await Client.findById(req.params.clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    const user = await User.findById(req.user._id);
    const remark = new ClientRemark({
      clientId: req.params.clientId,
      text,
      createdBy: {
        userId: req.user._id,
        username: (user && user.username) || req.user.username || 'Unknown',
        role: (user && user.role) || req.user.role || ''
      }
    });
    await remark.save();
    res.status(201).json(remark);
  } catch (error) {
    res.status(500).json({ message: 'Error adding remark', error: error.message });
  }
});

module.exports = router;
