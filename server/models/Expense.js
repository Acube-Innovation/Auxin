const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
    employeeName: { type: String, required: true },
    employeeEmail: { type: String, required: true },
    designation: { type: String, default: 'N/A' },
    expenseTitle: { type: String, required: true },
    expenseDescription: { type: String, required: true },
    expenseAmount: { type: Number, required: true },
    expenseDate: { type: Date, required: true },
    expenseCategory: {
        type: String,
        default: 'Other'
    },
    receiptUrl: { type: String, default: '' },
    status: {
        type: String,
        enum: ['Pending', 'HOD Approved', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    hodApproval: {
        approved: { type: Boolean, default: false },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        remarks: { type: String, default: '' }
    },
    hrApproval: {
        approved: { type: Boolean, default: false },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        remarks: { type: String, default: '' }
    },
    addedToSalary: { type: Boolean, default: false },
    salarySlipId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalarySlip' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);
