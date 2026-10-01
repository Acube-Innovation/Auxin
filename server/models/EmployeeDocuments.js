// models/Document.js
const mongoose = require("mongoose");

const employeeDocumentSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  fileName: String,
  filePath: String,
  fileType: String,
  fileSize: Number,
  type: String,
  uploadedBy: String,
  userRole: String,
  uploadedDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("EmployeeDocument", employeeDocumentSchema);
