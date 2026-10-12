const express = require('express');
const router = express.Router();
const Client = require('../../models/Client');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/ops/lookups/clients?type=Agent,Broker&search=gulf
// Minimal client list for operations pickers (charterers, owners, brokers, agents, suppliers).
// Unlike GET /api/clients it is not scoped to the clients a sales executive owns.
router.get('/clients', async (req, res) => {
  try {
    const filter = {};
    const types = String(req.query.type || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length > 0) {
      filter.clientType = { $in: types };
    }
    const search = String(req.query.search || '').trim();
    if (search) {
      filter.companyName = { $regex: escapeRegex(search), $options: 'i' };
    }

    const clients = await Client.find(filter)
      .select('companyName clientType primaryContactName email phone mobile country')
      .sort({ companyName: 1 })
      .limit(500)
      .lean();
    res.json(clients);
  } catch (err) {
    console.error('GET /api/ops/lookups/clients error:', err);
    res.status(500).json({ message: 'Error fetching clients', error: err.message });
  }
});

module.exports = router;
