const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Voyage documents (feature I2): CP, recaps, SOF, BL drafts, surveys and other files.
// Files live in server/storage/voyages/<voyageId>/documents/ and are only served through the API.
const DOCUMENT_CATEGORIES = [
  { value: 'CP', label: 'Charter party' },
  { value: 'RECAP', label: 'Recap' },
  { value: 'SOF', label: 'Statement of facts' },
  { value: 'NOR', label: 'NOR' },
  { value: 'BL', label: 'Bill of lading / draft' },
  { value: 'SURVEY', label: 'Survey / inspection' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'INVOICE', label: 'Invoice / hire statement' },
  { value: 'CORRESPONDENCE', label: 'Correspondence' },
  { value: 'OTHER', label: 'Other' },
];

const voyageDocumentSchema = new mongoose.Schema({
  voyage: { type: ObjectId, ref: 'Voyage', required: true },
  category: { type: String, enum: DOCUMENT_CATEGORIES.map((c) => c.value), default: 'OTHER' },
  title: { type: String, trim: true },
  portCall: { type: ObjectId, ref: 'PortCall', default: null },
  notes: { type: String, trim: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },           // relative to the storage folder
  fileType: { type: String },
  fileSize: { type: Number },
  uploadedBy: { type: ObjectId, ref: 'User', required: true },
  userRole: { type: String },                           // from the login, not from the form
  updatedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

voyageDocumentSchema.index({ voyage: 1, category: 1, createdAt: -1 });

const VoyageDocument = mongoose.model('VoyageDocument', voyageDocumentSchema);
VoyageDocument.CATEGORIES = DOCUMENT_CATEGORIES;
module.exports = VoyageDocument;
