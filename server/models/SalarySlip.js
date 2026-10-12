const mongoose = require("mongoose");

const salarySlipSchema = new mongoose.Schema({
    employeeName: { type: String, required: true },
    emailId: { type: String, required: true },
    designation: { type: String, required: true },
    dateOfJoining: { type: String, default: '' },
    month: { type: String, required: true },
    year: { type: String, required: true },
    // Earnings
    basicPay: { type: Number, required: true },
    hra: { type: Number, required: true },
    conveyanceAllowance: { type: Number, default: 0 },
    otherAllowance: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    // Deductions
    advance: { type: Number, default: 0 },
    leave: { type: Number, default: 0 },
    staffLoan: { type: Number, default: 0 },
    profTax: { type: Number, default: 0 },
    incomeTaxTDS: { type: Number, default: 0 },
    totalDeduction: { type: Number, default: 0 },
    // Legacy field (keeping for backward compatibility)
    deductionsPFTax: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Ensure unique combination of employee, month, and year to prevent duplicates
salarySlipSchema.index({ emailId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("SalarySlip", salarySlipSchema);
