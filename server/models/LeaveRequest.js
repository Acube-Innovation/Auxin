const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    employeeName: {
        type: String,
        required: true
    },
    company: {
        type: String,
        enum: ['Auxin Bulk Pvt Ltd', 'Auxin Projects Pvt Ltd', 'Auxin Shipping Pvt Ltd', 'Auxin Shipping PvtLtd'],
        required: true
    },
    leaveType: {
        type: String,
        enum: ['Sick Leave', 'Vacation', 'Personal Leave', 'Maternity/Paternity', 'Other' , 'Casual Leave' , 'Privilege Leave'],
        default: 'Personal Leave'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'HOD Approved', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    appliedOn: {
        type: Date,
        default: Date.now
    },
    // HOD approval tracking
    hodApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    hodApprovedAt: {
        type: Date,
        default: null
    },
    // HR (final) approval tracking — the HR named for the employee in Leave Approvers
    hrApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    hrApprovedAt: {
        type: Date,
        default: null
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    rejectedAt: {
        type: Date,
        default: null
    },
    // Admin approval tracking
    adminApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    adminApprovedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
