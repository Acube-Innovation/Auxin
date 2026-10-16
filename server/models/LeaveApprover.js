const mongoose = require('mongoose');

/**
 * Who approves one person's leave (User Management → Leave Approvers).
 * The person is an Employee record, or a login (User) for people without one.
 * Flow: leave applied → HOD approves ("HOD Approved") → HR approves ("Approved").
 * HOD and HR are logins of any role; they are not tied to the person's department.
 */
const leaveApproverSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    hod: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    hr: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// One row per person
leaveApproverSchema.index({ employee: 1 }, { unique: true, partialFilterExpression: { employee: { $type: 'objectId' } } });
leaveApproverSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });
leaveApproverSchema.index({ hod: 1 });
leaveApproverSchema.index({ hr: 1 });

module.exports = mongoose.model('LeaveApprover', leaveApproverSchema);
