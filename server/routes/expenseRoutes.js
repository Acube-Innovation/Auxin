const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const User = require('../models/User');
const SalarySlip = require('../models/SalarySlip');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/expense-documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'expense-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only JPG, PNG, and PDF files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Helper to get user data from request
function getUserDataFromReq(req) {
    const defaultData = { userId: null, emailId: null, role: null };
    if (!req) return defaultData;

    try {
        const authHeader = req.headers && req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token === 'null' || token === 'undefined') return defaultData;

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.id) {
                return {
                    userId: String(decoded.id),
                    emailId: decoded.emailId ? String(decoded.emailId).toLowerCase() : "",
                    role: decoded.role || null
                };
            }
        }
    } catch (e) { }

    return defaultData;
}

// Middleware to verify authenticated user
const requireAuth = async (req, res, next) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || !userData.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await User.findById(userData.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (e) {
        res.status(500).json({ message: 'Authentication error' });
    }
};

// Middleware to check HOD or Admin role
const requireHODOrAdmin = async (req, res, next) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || !userData.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await User.findById(userData.userId);
        if (!user || (user.role !== 'admin' && user.role !== 'hod')) {
            return res.status(403).json({ message: 'Access denied. HOD or Admin access required.' });
        }

        req.user = user;
        next();
    } catch (e) {
        res.status(500).json({ message: 'Authentication error' });
    }
};

// Employee: Create expense request
router.post('/create', requireAuth, upload.single('document'), async (req, res) => {
    try {
        // Debug log to check if req.body is populated
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Request headers:', req.headers);

        const { expenseTitle, expenseDescription, expenseAmount, expenseDate, expenseCategory } = req.body;

        // Validate required fields
        if (!expenseTitle || !expenseDescription || !expenseAmount || !expenseDate) {
            // Clean up uploaded file if validation fails
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }
            return res.status(400).json({ 
                message: 'All fields are required',
                receivedFields: { expenseTitle, expenseDescription, expenseAmount, expenseDate },
                bodyKeys: Object.keys(req.body || {})
            });
        }

        const expenseData = {
            employeeName: req.user.username || req.user.name || 'Unknown',
            employeeEmail: req.user.emailId || req.user.email,
            designation: req.user.designation || 'N/A',
            expenseTitle,
            expenseDescription,
            expenseAmount: parseFloat(expenseAmount),
            expenseDate: new Date(expenseDate),
            expenseCategory: expenseCategory || 'Other',
            status: 'Pending',
            createdBy: req.user._id
        };

        // Add document path if file was uploaded
        if (req.file) {
            expenseData.receiptUrl = req.file.filename;
        }

        const expense = new Expense(expenseData);
        await expense.save();
        res.status(201).json({ message: 'Expense request submitted successfully', expense });
    } catch (error) {
        console.error('Error creating expense:', error);
        // Clean up uploaded file if expense creation failed
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
            });
        }
        res.status(500).json({ message: error.message });
    }
});

// Employee: Get my expenses
router.get('/my-expenses', requireAuth, async (req, res) => {
    try {
        const expenses = await Expense.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// HOD/Admin: Get all expenses (with filter options)
router.get('/all', requireHODOrAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};

        // Both HOD and Admin can see all expenses, with optional status filter
        if (status && status !== 'All' && status !== '') {
            filter.status = status;
        }

        const expenses = await Expense.find(filter)
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username emailId')
            .populate('hodApproval.approvedBy', 'username')
            .populate('hrApproval.approvedBy', 'username');

        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// HOD: Approve/Reject expense
router.put('/hod-action/:id', requireHODOrAdmin, async (req, res) => {
    try {
        if (req.user.role !== 'hod' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only HOD can perform this action' });
        }

        const { action, remarks } = req.body;
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        if (expense.status !== 'Pending') {
            return res.status(400).json({ message: 'Expense has already been processed' });
        }

        if (action === 'approve') {
            expense.status = 'HOD Approved';
            expense.hodApproval = {
                approved: true,
                approvedBy: req.user._id,
                approvedAt: new Date(),
                remarks: remarks || ''
            };
        } else if (action === 'reject') {
            expense.status = 'Rejected';
            expense.hodApproval = {
                approved: false,
                approvedBy: req.user._id,
                approvedAt: new Date(),
                remarks: remarks || ''
            };
        }

        await expense.save();
        res.json({ message: `Expense ${action}d successfully`, expense });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// HR/Admin: Final approval and add to salary
router.put('/hr-action/:id', requireHODOrAdmin, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only HR Admin can perform this action' });
        }

        const { action, remarks } = req.body;
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        if (expense.status !== 'HOD Approved') {
            return res.status(400).json({ message: 'Expense must be approved by HOD first' });
        }

        if (action === 'approve') {
            expense.status = 'Approved';
            expense.hrApproval = {
                approved: true,
                approvedBy: req.user._id,
                approvedAt: new Date(),
                remarks: remarks || ''
            };
            expense.addedToSalary = true;
        } else if (action === 'reject') {
            expense.status = 'Rejected';
            expense.hrApproval = {
                approved: false,
                approvedBy: req.user._id,
                approvedAt: new Date(),
                remarks: remarks || ''
            };
        }

        await expense.save();
        res.json({ message: `Expense ${action}d by HR successfully`, expense });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Download expense document (must be before /:id route)
router.get('/document/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Check access rights
        const isOwner = expense.createdBy.toString() === req.user._id.toString();
        const isHODOrAdmin = req.user.role === 'hod' || req.user.role === 'admin';

        if (!isOwner && !isHODOrAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (!expense.receiptUrl) {
            return res.status(404).json({ message: 'No document found for this expense' });
        }

        const filePath = path.join(uploadDir, expense.receiptUrl);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Document file not found' });
        }

        // Get file extension to set proper content type
        const fileExt = path.extname(expense.receiptUrl).toLowerCase();
        let contentType = 'application/octet-stream';
        
        switch (fileExt) {
            case '.pdf':
                contentType = 'application/pdf';
                break;
            case '.jpg':
            case '.jpeg':
                contentType = 'image/jpeg';
                break;
            case '.png':
                contentType = 'image/png';
                break;
        }

        // Set proper headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${expense.receiptUrl}"`);
        
        // Send file
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error downloading file' });
                }
            }
        });
    } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get expense by ID
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('createdBy', 'username emailId')
            .populate('hodApproval.approvedBy', 'username')
            .populate('hrApproval.approvedBy', 'username');

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Check access rights
        const isOwner = expense.createdBy._id.toString() === req.user._id.toString();
        const isHODOrAdmin = req.user.role === 'hod' || req.user.role === 'admin';

        if (!isOwner && !isHODOrAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete expense (only by owner if pending)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        const isOwner = expense.createdBy.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (isOwner && expense.status !== 'Pending') {
            return res.status(400).json({ message: 'Cannot delete processed expense' });
        }

        // Delete associated document file if exists
        if (expense.receiptUrl) {
            const filePath = path.join(uploadDir, expense.receiptUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await Expense.findByIdAndDelete(req.params.id);
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
