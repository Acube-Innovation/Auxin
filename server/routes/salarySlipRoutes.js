const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const SalarySlip = require('../models/SalarySlip');
const User = require('../models/User');
const Employee = require('../models/Employee');
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');

// One-time cleanup to remove stale database indexes that cause import failures
SalarySlip.on('index', (err) => {
    if (err) console.error('SalarySlip Index Error:', err);
});

// Helper to remove the stale legacy index if it exists in the user's DB
const cleanupLegacyIndex = async () => {
    try {
        const collection = mongoose.connection.db.collection('salaryslips');
        const indexes = await collection.indexes();
        if (indexes.some(idx => idx.name === 'employeeId_1_month_1_year_1')) {
            await collection.dropIndex('employeeId_1_month_1_year_1');
            console.log('Successfully dropped stale legacy index: employeeId_1_month_1_year_1');
        }
    } catch (e) {
        // Index might not exist or connection not ready yet, which is fine
    }
};

// Monitor connection to perform cleanup
mongoose.connection.on('open', cleanupLegacyIndex);

// Enhanced helper to get user data from request
function getUserDataFromReq(req) {
    const defaultData = { userId: null, emailId: null };
    if (!req) return defaultData;

    try {
        const authHeader = req.headers && req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token === 'null' || token === 'undefined') {
                console.log('getUserDataFromReq - Token is null or undefined');
                return defaultData;
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.id) {
                return {
                    userId: String(decoded.id),
                    emailId: decoded.emailId ? String(decoded.emailId).toLowerCase() : ""
                };
            }
        } else {
            console.log('getUserDataFromReq - No valid Authorization header found');
        }
    } catch (e) {
        console.log('getUserDataFromReq - Token verification failed:', e.message);
    }

    const body = req.body || {};
    const query = req.query || {};
    const userId = body.userId || query.userId || null;
    const emailId = body.emailId || query.emailId || null;

    return {
        userId: userId ? String(userId) : null,
        emailId: emailId ? String(emailId).toLowerCase() : null
    };
}

// Middleware to check admin/hod role after authMiddleware sets req.user
const requireAdminRole = (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized - User not found' });
    }
    const role = String(user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'hod') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => cb(null, `salary-import-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Manual Create
router.post('/create', authMiddleware, requireAdminRole, async (req, res) => {
    try {
        const slipData = { ...req.body, uploadedBy: req.user._id };
        if (!slipData.emailId) return res.status(400).json({ message: 'Email ID is required' });

        const slip = await SalarySlip.findOneAndUpdate(
            { emailId: slipData.emailId.trim().toLowerCase(), month: slipData.month, year: slipData.year },
            { ...slipData, emailId: slipData.emailId.trim().toLowerCase() },
            { upsert: true, new: true }
        );
        res.status(201).json(slip);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Admin: Bulk Import Salary Slips
router.post('/import', authMiddleware, requireAdminRole, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 0, defval: '' });

        const monthValue = String(req.body.month || '').trim();
        const yearValue = String(req.body.year || '').trim();

        if (!monthValue || !yearValue) return res.status(400).json({ message: 'Month and Year are required' });

        const results = [];
        const errors = [];

        // Exact match mapping based on user error logs
        const fieldMappings = {
            employeeName: ['Employee Name', 'Name', 'FullName', 'EmployeeName'],
            emailId: ['Employee Email ID', 'Email ID', 'Email', 'User Email', 'EmailId', 'Mail', 'id'],
            designation: ['Designation', 'Project Manager', 'Designation Name', 'DesignationName'],
            dateOfJoining: ['Date of Joining', 'Joining Date', 'DateOfJoining', 'JoiningDate', 'DOJ'],
            basicPay: ['Earnings.Basic Pay (₹)', 'Basic Pay (₹)', 'Basic Pay', 'Basic Salary', 'BasicPay', 'Basic'],
            hra: ['Earnings.HRA (₹)', 'HRA (₹)', 'HRA', 'House Rent Allowance', 'HRA Amount'],
            conveyanceAllowance: ['Earnings.Convy. Allowance (₹)', 'Earnings.Conveyance Allowance (₹)', 'Conveyance Allowance (₹)', 'Conveyance Allowance', 'Conveyance', 'Convy Allowance'],
            otherAllowance: ['Earnings.Other Allowance (₹)', 'Earnings.Other Allowance', 'Other Allowance (₹)', 'Other Allowance', 'OtherAllowance'],
            advance: ['Deductions.Advance (₹)', 'Deductions.Advance', 'Advance (₹)', 'Advance'],
            leave: ['Deduction.Leave (₹)', 'Deduction.Leave', 'Leave (₹)', 'Leave'],
            staffLoan: ['Deduction.Staff Loan (₹)', 'Deduction.Staff Loan', 'Staff Loan (₹)', 'Staff Loan', 'StaffLoan'],
            profTax: ['Deduction.Prof. Tax (₹)', 'Deduction.Prof. Tax', 'Prof. Tax (₹)', 'Prof. Tax', 'ProfTax', 'Professional Tax'],
            incomeTaxTDS: ['Deduction.TDS (₹)', 'Deduction.TDS', 'TDS (₹)', 'TDS', 'Income Tax/TDS', 'Income Tax', 'IncomeTaxTDS'],
            deductionsPFTax: ['Deductions (₹)', 'Deductions', 'Deduction', 'PF / Tax', 'PF', 'Tax', 'PF/Tax'],
            netSalary: ['Net Salary (₹)', 'Net Salary', 'Total Salary', 'Total Payable', 'NetSalary']
        };

        const parseNum = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            const cleaned = String(val).replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        };

        for (const row of data) {
            try {
                if (!row) continue;
                const rowKeys = Object.keys(row);

                const getRowVal = (possibleKeys) => {
                    const foundKey = rowKeys.find(k => {
                        const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
                        return possibleKeys.some(pk => {
                            const cleanPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return cleanK === cleanPk || cleanK.includes(cleanPk);
                        });
                    });
                    return foundKey ? row[foundKey] : undefined;
                };

                const rawEmail = getRowVal(fieldMappings.emailId);
                if (!rawEmail && !getRowVal(fieldMappings.employeeName)) continue;
                if (!rawEmail) {
                    errors.push({ row, error: "Email ID not found in row" });
                    continue;
                }

                const basicPay = parseNum(getRowVal(fieldMappings.basicPay));
                const hra = parseNum(getRowVal(fieldMappings.hra));
                const conveyanceAllowance = parseNum(getRowVal(fieldMappings.conveyanceAllowance));
                const otherAllowance = parseNum(getRowVal(fieldMappings.otherAllowance));
                const advance = parseNum(getRowVal(fieldMappings.advance));
                const leave = parseNum(getRowVal(fieldMappings.leave));
                const staffLoan = parseNum(getRowVal(fieldMappings.staffLoan));
                const profTax = parseNum(getRowVal(fieldMappings.profTax));
                const incomeTaxTDS = parseNum(getRowVal(fieldMappings.incomeTaxTDS));

                // Auto-calculate derived fields (same as manual create)
                const grossSalary = basicPay + hra + conveyanceAllowance + otherAllowance;
                const totalDeduction = advance + leave + staffLoan + profTax + incomeTaxTDS;
                const netSalary = grossSalary - totalDeduction;

                const rawDateOfJoining = getRowVal(fieldMappings.dateOfJoining);
                let dateOfJoining = String(rawDateOfJoining || '').trim();
                // Convert Excel serial date number to date string
                if (rawDateOfJoining && typeof rawDateOfJoining === 'number' && !isNaN(rawDateOfJoining)) {
                    const excelEpoch = new Date(1899, 11, 30);
                    const parsedDate = new Date(excelEpoch.getTime() + rawDateOfJoining * 86400000);
                    if (!isNaN(parsedDate.getTime())) {
                        const y = parsedDate.getFullYear();
                        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
                        const d = String(parsedDate.getDate()).padStart(2, '0');
                        dateOfJoining = `${y}-${m}-${d}`;
                    }
                }

                const slipData = {
                    employeeName: String(getRowVal(fieldMappings.employeeName) || 'Unknown').trim(),
                    emailId: String(rawEmail).trim().toLowerCase(),
                    designation: String(getRowVal(fieldMappings.designation) || 'N/A').trim(),
                    dateOfJoining,
                    month: monthValue,
                    year: yearValue,
                    basicPay,
                    hra,
                    conveyanceAllowance,
                    otherAllowance,
                    grossSalary,
                    advance,
                    leave,
                    staffLoan,
                    profTax,
                    incomeTaxTDS,
                    totalDeduction,
                    // Legacy field for backward compatibility
                    deductionsPFTax: totalDeduction,
                    netSalary,
                    uploadedBy: req.user._id
                };

                // Clear any legacy keys that might trigger stale unique indexes
                await SalarySlip.findOneAndUpdate(
                    { emailId: slipData.emailId, month: { $regex: new RegExp(`^${slipData.month}$`, 'i') }, year: slipData.year },
                    { $set: slipData, $unset: { employeeId: "" } }, // Unset legacy key to avoid null collisions
                    { upsert: true, new: true, runValidators: true }
                );

                results.push(slipData.emailId);
            } catch (err) {
                errors.push({ row, error: err.message });
            }
        }

        res.json({
            message: `Successfully processed ${results.length} salary slips.`,
            count: results.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Helper: enrich slips with profile photo by emailId (case-insensitive)
// Uses Employee.profilePhoto first, then User.profilePicture (Settings profile) as fallback
async function enrichSlipsWithProfilePhoto(slips) {
    if (!slips || slips.length === 0) return slips;
    const emails = [...new Set(slips.map((s) => String(s.emailId || '').trim().toLowerCase()).filter(Boolean))];
    if (emails.length === 0) return slips.map((s) => ({ ...s.toObject(), profilePhoto: '' }));
    const employees = await Employee.aggregate([
        { $match: { $expr: { $in: [{ $toLower: { $ifNull: ["$emailId", ""] } }, emails] } } },
        { $project: { emailId: 1, profilePhoto: 1 } }
    ]);
    const photoByEmail = {};
    employees.forEach((e) => {
        const key = String(e.emailId || '').trim().toLowerCase();
        photoByEmail[key] = e.profilePhoto || '';
    });
    const missingEmails = emails.filter((e) => !photoByEmail[e]);
    if (missingEmails.length > 0) {
        const users = await User.aggregate([
            { $match: { $expr: { $in: [{ $toLower: { $ifNull: ["$emailId", ""] } }, missingEmails] } } },
            { $project: { emailId: 1, profilePicture: 1 } }
        ]);
        users.forEach((u) => {
            const key = String(u.emailId || '').trim().toLowerCase();
            if (u.profilePicture) photoByEmail[key] = u.profilePicture;
        });
    }
    return slips.map((s) => {
        const o = s.toObject();
        o.profilePhoto = photoByEmail[String(s.emailId || '').trim().toLowerCase()] || '';
        return o;
    });
}

// Admin: Get all
router.get('/all', authMiddleware, requireAdminRole, async (req, res) => {
    try {
        const { month, year } = req.query;
        const filter = {};
        if (month && month !== 'All' && month !== '') filter.month = { $regex: new RegExp(`^${String(month).trim()}$`, 'i') };
        if (year && year !== 'All' && year !== '') filter.year = String(year).trim();
        const slips = await SalarySlip.find(filter).sort({ createdAt: -1 });
        const enriched = await enrichSlipsWithProfilePhoto(slips);
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Employee: Get mine
router.get('/my-slips', async (req, res) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || (!userData.userId && !userData.emailId)) return res.status(401).json({ message: 'Unauthorized' });
        let userEmail = userData.emailId;
        if (!userEmail && userData.userId) {
            const user = await User.findById(userData.userId);
            if (user) userEmail = user.emailId;
        }
        if (!userEmail) return res.status(400).json({ message: 'No linked email found' });

        const slips = await SalarySlip.find({ emailId: String(userEmail).trim().toLowerCase() }).sort({ year: -1, month: -1 });
        const enriched = await enrichSlipsWithProfilePhoto(slips);
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Bulk Delete
router.post('/bulk-delete', authMiddleware, requireAdminRole, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No IDs provided' });
        }

        await SalarySlip.deleteMany({ _id: { $in: ids } });
        res.json({ message: `Successfully deleted ${ids.length} salary slips` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update salary slip
router.put('/:id', authMiddleware, requireAdminRole, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        // Normalize email if provided
        if (updateData.emailId) {
            updateData.emailId = String(updateData.emailId).trim().toLowerCase();
        }

        const updatedSlip = await SalarySlip.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedSlip) {
            return res.status(404).json({ message: 'Salary slip not found' });
        }

        res.json(updatedSlip);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete
router.delete('/:id', authMiddleware, requireAdminRole, async (req, res) => {
    try {
        await SalarySlip.findByIdAndDelete(req.params.id);
        res.json({ message: 'Salary slip deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
