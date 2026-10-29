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

// ---------------------------------------------------------------- quick add from the New Voyage form
// Anyone who can create voyages may add a missing client, vessel or port while filling in the form.
// The same name (any letter case) returns the existing record instead of a duplicate.
const Vessel = require('../../models/ops/Vessel');
const Port = require('../../models/ops/Port');
const access = require('../../services/ops/accessScope');
const { sendError, httpError } = require('./helpers');

const sameName = (s) => ({ $regex: `^\\s*${escapeRegex(String(s).trim())}\\s*$`, $options: 'i' });
const required = (v, label) => { const t = String(v || '').trim(); if (!t) throw httpError(400, `${label} is required`); return t; };
const canQuickAdd = (req) => { if (!access.canCreate(req.user)) throw httpError(403, 'You cannot add records from the voyage form'); };

// POST /api/ops/lookups/clients { companyName, clientType }
router.post('/clients', async (req, res) => {
  try {
    canQuickAdd(req);
    const companyName = required(req.body.companyName, 'Name');
    const clientType = required(req.body.clientType, 'Client type');
    const existing = await Client.findOne({ companyName: sameName(companyName), clientType }).select('companyName clientType').lean();
    if (existing) return res.json(existing);
    const client = await Client.create({ companyName, clientType, createdBy: req.user._id, assignedTo: req.user._id });
    res.status(201).json({ _id: client._id, companyName: client.companyName, clientType: client.clientType });
  } catch (err) { sendError(res, err, 'Error adding client'); }
});

// POST /api/ops/lookups/vessels { name }
router.post('/vessels', async (req, res) => {
  try {
    canQuickAdd(req);
    const name = required(req.body.name, 'Vessel name');
    const existing = await Vessel.findOne({ name: sameName(name) });
    if (existing) {
      if (!existing.isActive) throw httpError(400, `${existing.name} exists but is inactive. Ask Admin to make it active in Ops Masters → Vessels.`);
      return res.json(existing);
    }
    const vessel = await Vessel.create({ name, isActive: true, createdBy: req.user._id, updatedBy: req.user._id });
    res.status(201).json(vessel);
  } catch (err) { sendError(res, err, 'Error adding vessel'); }
});

// POST /api/ops/lookups/ports { name, country, timeZone }
router.post('/ports', async (req, res) => {
  try {
    canQuickAdd(req);
    const name = required(req.body.name, 'Port name');
    const country = required(req.body.country, 'Country');
    const timeZone = required(req.body.timeZone, 'Time zone');
    const existing = await Port.findOne({ name: sameName(name), country: sameName(country) });
    if (existing) {
      if (!existing.isActive) throw httpError(400, `${existing.name} exists but is inactive. Ask Admin to make it active in Ops Masters → Ports.`);
      return res.json(existing);
    }
    const port = await Port.create({ name, country, timeZone, isActive: true, createdBy: req.user._id, updatedBy: req.user._id });
    res.status(201).json(port);
  } catch (err) { sendError(res, err, 'Error adding port'); }
});

module.exports = router;
