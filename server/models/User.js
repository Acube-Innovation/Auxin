const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, default: "" },
  emailId: { type: String, default: "" },
  profilePicture: { type: String, default: null },
  role: {
    type: String,
    enum: [
      "managing_director",
      "director",
      "accounts_manager",
      "chartering_manager",
      "business_development_manager",
      "office_assistance",
      "executive_post_fixture",
      "operations_pricing_manager",
      "operations_executive",
      "admin",
      "sales_executive"
    ],
    default: "sales_executive",
    required: true
  },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
