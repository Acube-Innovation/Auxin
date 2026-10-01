const express = require('express');
const router = express.Router();
const CheckIn = require('../models/CheckIn');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Setup multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Create a check-in
router.post('/', authMiddleware, upload.single('imageProof'), async (req, res) => {
  try {
    let data = req.body;
    if (req.body.data) {
      data = JSON.parse(req.body.data);
    }
    // Ensure req.user exists
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Unauthorized: user not found in token' });
    }
    const checkIn = new CheckIn({
      ...data,
      imageProof: req.file ? `/uploads/${req.file.filename}` : undefined,
      user: req.user._id // from authMiddleware
    });
    await checkIn.save();
    res.status(201).json(checkIn);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all check-ins
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin - if so, return all check-ins with full details
    // If not admin, only return their own check-ins
    let query = {};

    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const checkIns = await CheckIn.find(query)
      .populate('clientId', 'companyName')
      .populate('teamMembers', 'name')
      .populate('user', 'username emailId profilePicture')
      .sort({ timestamp: -1 });

    console.log(`Found ${checkIns.length} check-ins for ${req.user.role}`);
    res.json(checkIns);
  } catch (err) {
    console.error('Error fetching check-ins:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get check-in by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const checkIn = await CheckIn.findById(req.params.id).populate('clientId teamMembers user');
    if (!checkIn) return res.status(404).json({ message: 'Check-in not found' });
    res.json(checkIn);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get check-ins by user
// router.get('/user/:userId', authMiddleware, async (req, res) => {
//   try {
//     const checkIns = await CheckIn.find({ user: req.params.userId }).populate('clientId teamMembers user');
//     res.json(checkIns);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const requestedUserId = req.params.userId;
    console.log('Fetching check-ins for user:', requestedUserId);

    // Only admin can fetch other users' check-ins
    if (req.user.role !== 'admin' && String(req.user._id) !== String(requestedUserId)) {
      return res.status(403).json({ message: 'Forbidden: not allowed to view other users check-ins' });
    }

    const checkIns = await CheckIn.find({ user: requestedUserId })
      .populate('clientId teamMembers user')
      .sort({ timestamp: -1 }); // Sort by timestamp descending

    console.log(`Found ${checkIns.length} check-ins for user ${requestedUserId}`);
    res.json(checkIns);
  } catch (err) {
    console.error('Error in /user/:userId route:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get check-ins for the authenticated user (shortcut)
router.get('/user/me', authMiddleware, async (req, res) => {
  try {
    // Return this user's check-ins (admin will get their own unless using /user/:userId)
    const userId = req.user._id;
    const checkIns = await CheckIn.find({ user: userId })
      .populate('clientId teamMembers user')
      .sort({ timestamp: -1 });
    res.json(checkIns);
  } catch (err) {
    console.error('Error in /user/me route:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update check-in
router.put('/:id', authMiddleware, upload.single('imageProof'), async (req, res) => {
  try {
    let data = req.body;
    if (req.body.data) {
      data = JSON.parse(req.body.data);
    }
    const update = {
      ...data
    };
    if (req.file) {
      update.imageProof = `/uploads/${req.file.filename}`;
    }
    const checkIn = await CheckIn.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!checkIn) return res.status(404).json({ message: 'Check-in not found' });
    res.json(checkIn);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete check-in
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const checkIn = await CheckIn.findByIdAndDelete(req.params.id);
    if (!checkIn) return res.status(404).json({ message: 'Check-in not found' });
    res.json({ message: 'Check-in deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
