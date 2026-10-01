const mongoose = require("mongoose");
const assignEventSchema = require('./AssignEvent');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true }, // unique employee code/ID
  employeeName: { type: String, required: true },

  employeeStatus: {
    type: String,
    enum: ["Active", "InActive"],
    default: "Active"
  },

   attendance: {
    type: String,
    enum: ["Onsite", "Leave"],
    default: "Onsite"
  },

  mobile: { type: String, required: true },
  emailId: { type: String, required: true, unique: true },

  profilePhoto: { type: String, default: "" }, // URL or path to photo

  role: { type: String, required: true }, // e.g., Operations Manager, Sales Executive
  designation: { type: String }, // same or different from role if needed

  department: {
    type: String,
    required: true
  },

  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client" }], // multiple projects can be assigned

  events: [assignEventSchema]

}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);
