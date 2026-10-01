// models/Document.js
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  fileName: String,
  filePath: String,
  fileType: String,
  fileSize: Number,
  type: String,
  uploadedBy: String,
  userRole: String,
  uploadedDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Document", documentSchema);
