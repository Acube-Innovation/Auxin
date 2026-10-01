const mongoose = require("mongoose");
const createEventSchema = require('./CreateEvent');

const clientSchema = new mongoose.Schema({
  // 1. Company & Contact Details
  companyName: { type: String, required: true },
  clientType: { type: String }, // Shipper / Consignee / Broker / Agent / Other
  leadType: { type: String }, // Client / Lead 
  address: { type: String },
  country: { type: String },
  taxId: { type: String }, // GST / VAT
  website: { type: String },
  primaryContactName: { type: String },
  designation: { type: String },
  phone: { type: String },
  mobile: { type: String },
  email: { type: String },
  socialLinks: { type: String },
  profilePicture: {
    type: String, // This will store the URL or file path
    default: ""
  },

  // 2. Customer Classification
  industryType: { type: String },
  cargoType: { type: String },
  decisionMaker: { type: String }, // Yes / No
  relationshipStatus: { type: String }, // Prospect / Active / Dormant / Lost
  accountManager: { type: String },

  // 3. Business / Commercial Data
  typicalCargoes: { type: String },
  averageShipmentSize: { type: String },
  shipmentFrequency: { type: String },
  tradingRoutes: { type: String },
  contractType: { type: String }, // COA / Spot / Tender / Long-term
  historicalVolume: { type: String },
  competitors: { type: String },

  // 4. Project Logistics Specific
  projectName: { type: String },
  projectTimelineStart: { type: Date },
  projectTimelineEnd: { type: Date },
  epcContractor: { type: String },
  specialRequirements: { type: String },
  riskNotes: { type: String },

  // 5. Interactions & Opportunities
  leadSource: { type: String },
  currentStatus: { type: String }, // Lead / Quoted / Negotiation / Won / Lost
  opportunityValue: { type: Number },
  followUpDate: { type: Date },
  notes: { type: String },

  // Follow-up pipeline status for reporting
  followupStatus: {
    type: String,
    enum: [
      "Contacted",
      "Needs Analysis",
      "Demo Scheduled",
      "Proposal Sent",
      "Completed",
      "Pending",
      "Progress",
      "Won",
      "Lost"
    ],
    default: "Pending"
  },

  // Category (new dropdown)
  category: { type: String, default: "" },

  // 6. Operational Links
  preferredLoadPorts: { type: String },
  preferredDischargePorts: { type: String },
  demurrageTerms: { type: String },
  preferredAgents: { type: String },
  incoterms: { type: String }, // FOB / CIF / DAP

  // Add ownership fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  events: [createEventSchema]
}, { timestamps: true });

module.exports = mongoose.model("Client", clientSchema);
