// routes/documentRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const Document = require("../models/EmployeeDocuments");

const router = express.Router();

// Configure multer for file uploads to server/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/employeedocuments")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Get all documents for a employee
router.get("/:employeeId", async (req, res) => {
  try {
    const documents = await Document.find({ employeeId: req.params.employeeId });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload document for employee
router.post("/:employeeId", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const newDoc = new Document({
      employeeId: req.params.employeeId,
      fileName: req.file.originalname,
      filePath: `/uploads/employeedocuments/${path.basename(req.file.destination) === 'uploads' ? '' : path.basename(req.file.destination) + '/'}${req.file.filename}`.replace('//','/'),
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.body.uploadedBy,
      userRole: req.body.userRole,
      type: req.body.type || "Extra",
      uploadedDate: new Date(),
    });
    await newDoc.save();
    res.json(newDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
router.delete("/:docId", async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.docId);
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
