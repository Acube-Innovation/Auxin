import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import "./AddClientModal.css";
import ProgressSteps from "../ProgressSteps";
import InputField from "../InputField";
import ProfilePhotoUpload from "../ProfilePhotoUpload";
import editIcon from "../../assets/dashboard/pencil-line-blue.svg";
import clientService from "../../services/ClientService";
import config from "../../config/config";
import Dropdown from "../DropDown";

function EditClientModal({ isOpen, onClose, onSubmit, clientData }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileImage, setProfileImage] = useState(null);
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    // 1. Company & Contact Details
    companyName: "",
    clientType: "",
    address: "",
    leadType: "",
    country: "",
    taxId: "",
    website: "",
    primaryContactName: "",
    designation: "",
    phone: "",
    mobile: "",
    email: "",
    socialLinks: "",

    // 2. Customer Classification
    industryType: "",
    cargoType: "",
    decisionMaker: "",
    relationshipStatus: "",
    accountManager: "",

    // 3. Business / Commercial Data
    typicalCargoes: "",
    averageShipmentSize: "",
    shipmentFrequency: "",
    tradingRoutes: "",
    contractType: "",
    historicalVolume: "",
    competitors: "",

    // 4. Project Logistics Specific
    projectName: "",
    projectTimelineStart: "",
    projectTimelineEnd: "",
    epcContractor: "",
    specialRequirements: "",
    riskNotes: "",

    // 5. Interactions & Opportunities
    leadSource: "",
    currentStatus: "",
    opportunityValue: "",
    followUpDate: "",
    notes: "",

    // Follow-up pipeline status
    followupStatus: "",

    // 6. Operational Links
    preferredLoadPorts: "",
    preferredDischargePorts: "",
    demurrageTerms: "",
    preferredAgents: "",
    incoterms: "",

    // Additional fields
    category: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Effect to populate form data when clientData is provided
  useEffect(() => {
    if (clientData && isOpen) {
      // Helper function to format date for input
      const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        return date.toISOString().split("T")[0];
      };

      setFormData({
        companyName: clientData.companyName || "",
        clientType: clientData.clientType || "",
        address: clientData.address || "",
        leadType: clientData.leadType || "",
        country: clientData.country || "",
        taxId: clientData.taxId || "",
        website: clientData.website || "",
        primaryContactName: clientData.primaryContactName || "",
        designation: clientData.designation || "",
        phone: clientData.phone || "",
        mobile: clientData.mobile || "",
        email: clientData.email || "",
        socialLinks: clientData.socialLinks || "",
        industryType: clientData.industryType || "",
        cargoType: clientData.cargoType || "",
        decisionMaker: clientData.decisionMaker || "",
        relationshipStatus: clientData.relationshipStatus || "",
        accountManager: clientData.accountManager || "",
        typicalCargoes: clientData.typicalCargoes || "",
        averageShipmentSize: clientData.averageShipmentSize || "",
        shipmentFrequency: clientData.shipmentFrequency || "",
        tradingRoutes: clientData.tradingRoutes || "",
        contractType: clientData.contractType || "",
        historicalVolume: clientData.historicalVolume || "",
        competitors: clientData.competitors || "",
        projectName: clientData.projectName || "",
        projectTimelineStart: formatDateForInput(
          clientData.projectTimelineStart
        ),
        projectTimelineEnd: formatDateForInput(clientData.projectTimelineEnd),
        epcContractor: clientData.epcContractor || "",
        specialRequirements: clientData.specialRequirements || "",
        riskNotes: clientData.riskNotes || "",
        leadSource: clientData.leadSource || "",
        currentStatus: clientData.currentStatus || "",
        followupStatus:
          clientData.followupStatus || clientData.followStatus || "",
        opportunityValue: clientData.opportunityValue || "",
        followUpDate: formatDateForInput(clientData.followUpDate),
        notes: clientData.notes || "",
        preferredLoadPorts: clientData.preferredLoadPorts || "",
        preferredDischargePorts: clientData.preferredDischargePorts || "",
        demurrageTerms: clientData.demurrageTerms || "",
        preferredAgents: clientData.preferredAgents || "",
        incoterms: clientData.incoterms || "",
        category: clientData.category || "",
      });
    }
  }, [clientData, isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // const handleInputChange = (field, value) => {
  //   setFormData((prev) => ({
  //     ...prev,
  //     [field]: value,
  //   }));
  // };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleStepClick = (stepId) => {
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
    }
  };

  const handleFinish = async () => {
    // Validate required fields
    if (!formData.companyName || !formData.email) {
      showToast("Company Name and Email are required fields.", "error");
      return;
    }

    if (!clientData || !clientData._id) {
      showToast("Client ID is required for updating", "error");
      return;
    }

    setIsSubmitting(true);

    // Debug logging
    console.log("Starting client update process...");
    console.log("Client ID:", clientData._id);
    console.log("Has profile image:", !!profileImage);
    console.log("Form data:", formData);

    try {
      // Check if user is authenticated
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }
      console.log("Token found:", token ? "✓" : "✗");

      // Filter out empty fields and convert date strings to Date objects
      const filteredData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== "")
      );

      // Convert date strings to Date objects for MongoDB
      if (filteredData.projectTimelineStart) {
        filteredData.projectTimelineStart = new Date(
          filteredData.projectTimelineStart
        );
      }
      if (filteredData.projectTimelineEnd) {
        filteredData.projectTimelineEnd = new Date(
          filteredData.projectTimelineEnd
        );
      }
      if (filteredData.followUpDate) {
        filteredData.followUpDate = new Date(filteredData.followUpDate);
      }

      // Convert opportunityValue to number if it exists
      if (filteredData.opportunityValue) {
        filteredData.opportunityValue = Number(filteredData.opportunityValue);
      }

      console.log("Filtered data for update:", filteredData);

      // Use updateClientWithFile if we have a profile image, otherwise use regular updateClient
      let updatedClient;

      if (profileImage) {
        console.log("Updating client with file...");
        console.log("Profile image details:", {
          name: profileImage.name,
          size: profileImage.size,
          type: profileImage.type,
        });
        updatedClient = await clientService.updateClientWithFile(
          clientData._id,
          filteredData,
          profileImage
        );
      } else {
        console.log("Updating client without file...");
        updatedClient = await clientService.updateClient(
          clientData._id,
          filteredData
        );
      }

      console.log("Client updated successfully:", updatedClient);

      // Call the onSubmit callback with the updated client data
      if (onSubmit) {
        onSubmit(updatedClient);
      }

      onClose();
      setCurrentStep(1);
      showToast("Client updated successfully!", "success");

      // Reset profile image state after successful update
      setProfileImage(null);

      // Success feedback
      console.log("✅ Client update completed successfully");
    } catch (err) {
      console.error("❌ Error updating client:", err);

      // Enhanced error handling with specific error messages
      let errorMessage = "Failed to update client. Please try again.";

      if (err.message.includes("401") || err.message.includes("Unauthorized")) {
        errorMessage = "Authentication failed. Please log in again.";
      } else if (
        err.message.includes("403") ||
        err.message.includes("Forbidden")
      ) {
        errorMessage = "You don't have permission to update this client.";
      } else if (
        err.message.includes("404") ||
        err.message.includes("Not Found")
      ) {
        errorMessage = "Client not found. It may have been deleted.";
      } else if (
        err.message.includes("400") ||
        err.message.includes("Bad Request")
      ) {
        errorMessage = "Invalid data provided. Please check your inputs.";
      } else if (
        err.message.includes("500") ||
        err.message.includes("Internal Server Error")
      ) {
        errorMessage = "Server error. Please try again later.";
      } else if (
        err.message.includes("Network Error") ||
        err.message.includes("fetch")
      ) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      showToast(errorMessage, "error");

      // Additional debug information
      console.log("Error details:", {
        message: err.message,
        stack: err.stack,
        response: err.response?.data,
        status: err.response?.status,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (file) => {
    setProfileImage(file);
  };

  const handleEditPhoto = (file) => {
    console.log("Edit photo");
  };

  const clientTypeOptions = [
    { value: "", label: "-Select-" },
    { value: "Agent", label: "Agent" },
    { value: "Barge Operator", label: "Barge Operator" },
    { value: "Barge Owners", label: "Barge Owners" },
    { value: "Broker", label: "Broker" },
    { value: "Cha", label: "CHA" },
    { value: "Consignee", label: "Consignee" },
    { value: "Freigt Forwarder", label: "Freigt Forwarder" },
    { value: "Other", label: "Other" },
    { value: "Ship Owners", label: "Ship Owners" },
    { value: "Shipper", label: "Shipper" },
    { value: "Transporter", label: "Transporter" },
  ];

  const decisionMakerOptions = [
    { value: "", label: "-Select-" },
    { value: "No", label: "No" },
    { value: "Yes", label: "Yes" },
  ];

  const relationshipStatusOptions = [
    { value: "", label: "-Select-" },
    { value: "Active", label: "Active" },
    { value: "Dormant", label: "Dormant" },
    { value: "Lost", label: "Lost" },
    { value: "Prospect", label: "Prospect" },
  ];

  const contractTypeOptions = [
    { value: "", label: "-Select-" },
    { value: "Coa", label: "COA" },
    { value: "Long-term", label: "Long-term" },
    { value: "Spot", label: "Spot" },
    { value: "Tender", label: "Tender" },
  ];

  const currentStatusOptions = [
    { value: "", label: "-Select-" },
    { value: "Contacted", label: "Contacted" },
    { value: "Lead", label: "Lead" },
    { value: "Lost", label: "Lost" },
    { value: "Negotiation", label: "Negotiation" },
    { value: "Quoted", label: "Quoted" },
    { value: "Won", label: "Won" },
  ];

  const followupStatusOptions = [
    { value: "", label: "-Select-" },
    { value: "Completed", label: "Completed" },
    { value: "Contacted", label: "Contacted" },
    { value: "Demo Scheduled", label: "Demo Scheduled" },
    { value: "Lost", label: "Lost" },
    { value: "Needs Analysis", label: "Needs Analysis" },
    { value: "Pending", label: "Pending" },
    { value: "Progress", label: "Progress" },
    { value: "Proposal Sent", label: "Proposal Sent" },
    { value: "Won", label: "Won" },
  ];

  const incotermsOptions = [
    { value: "", label: "-Select-" },
    { value: "FOB", label: "FOB" },
    { value: "CIF", label: "CIF" },
    { value: "DAP", label: "DAP" },
    // { value: "EXW", label: "EXW" },
    // { value: "FCA", label: "FCA" },
    // { value: "CPT", label: "CPT" },
    // { value: "CIP", label: "CIP" },
    // { value: "DPU", label: "DPU" },
    // { value: "DDP", label: "DDP" },
  ];

  // New dropdown option lists
  const leadSourceOptions = [
    { value: "", label: "-Select-" },
    { value: "Advertisement", label: "Advertisement" },
    { value: "Cold Call", label: "Cold Call" },
    { value: "Conference", label: "Conference" },
    { value: "Employee Referral", label: "Employee Referral" },
    { value: "Exhibitor", label: "Exhibitor" },
    { value: "Exhibition As Visitor", label: "Exhibition As Visitor" },
    { value: "External Referral", label: "External Referral" },
    { value: "Social Media", label: "SOCIAL MEDIA" },
  ];

  const leadStatusOptions = [
    { value: "", label: "-Select-" },
    { value: "Attempted To Contact", label: "Attempted to Contact" },
    { value: "Contact In Future", label: "Contact In Future" },
    { value: "Contacted", label: "Contacted" },
    { value: "Junk Lead", label: "Junk lead" },
    { value: "Lost Lead", label: "Lost Lead" },
    { value: "Negotiation", label: "Negotiation" },
    { value: "New", label: "New" },
    { value: "Qualified", label: "Qualified" },
    { value: "Quoted", label: "Quoted" },
    { value: "Won", label: "Won" },
  ];

  const industryTypeOptions = [
    { value: "", label: "-Select-" },
    { value: "Bulk trading company", label: "Bulk trading company" },
    {
      value: "Cement manufacturing companies",
      label: "Cement manufacturing companies",
    },
    {
      value: "Cryogenic tank manufacturers",
      label: "Cryogenic tank manufacturers",
    },
    { value: "Dredging companies", label: "Dredging companies" },
    { value: "Drydocks", label: "Drydocks" },
    {
      value: "Fiber pipe manufacturing company",
      label: "Fiber pipe manufacturing company",
    },
    { value: "Freight forwarders", label: "Freight forwarders" },
    { value: "Gypsum traders", label: "Gypsum traders" },
    { value: "Heavy engineering", label: "Heavy engineering" },
    {
      value: "Heavy transport companies in abroad",
      label: "Heavy transport companies in abroad",
    },
    {
      value: "Heavy transport companies in india",
      label: "Heavy transport companies in india",
    },
    { value: "Hydro power", label: "Hydro power" },
    {
      value: "Industrial air filter companies",
      label: "Industrial air filter companies",
    },
    { value: "Industrial boiler", label: "Industrial boiler" },
    {
      value: "Industrial gases tank / cylinders",
      label: "Industrial gases tank / cylinders",
    },
    { value: "Jack up rig owners", label: "Jack up rig owners" },
    { value: "Limestone traders", label: "Limestone traders" },
    { value: "Mining companies", label: "Mining companies" },
    { value: "Navy", label: "Navy" },
    { value: "Nuclear power", label: "Nuclear power" },
    { value: "Offshore companies", label: "Offshore companies" },
    {
      value: "Offshore windmill companies",
      label: "Offshore windmill companies",
    },
    { value: "Oil and gas companies", label: "Oil and gas companies" },
    { value: "Pick up trucks", label: "Pick up trucks" },
    {
      value: "Port infrastructure companies",
      label: "Port infrastructure companies",
    },
    {
      value: "Railway wagon manufacturers",
      label: "Railway wagon manufacturers",
    },
    { value: "Shipbuilding", label: "Shipbuilding" },
    { value: "Shipyards", label: "Shipyards" },
    { value: "Silica sand manufacturers", label: "Silica sand manufacturers" },
    { value: "Steel traders", label: "Steel traders" },
    {
      value: "Straddle carrier manufacturer",
      label: "Straddle carrier manufacturer",
    },
    { value: "Thermal power", label: "Thermal power" },
    { value: "Transformer manufacturers", label: "Transformer manufacturers" },
    { value: "Windmill companies", label: "Windmill companies" },
  ];

  const categoryOptions = [
    { value: "", label: "-Select-" },
    { value: "Breakbulk", label: "Breakbulk" },
    { value: "Bulk", label: "Bulk" },
    { value: "Project", label: "Project" },
  ];

  const leadTypeOptions = [
    { value: "", label: "-Select-" },
    { value: "Client", label: "Client" },
    { value: "Lead", label: "Lead" },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="add-client-content">
            <ProfilePhotoUpload
              onUpload={handlePhotoUpload}
              clientData={clientData}
            />
            <div className="form-fields-grid">
              <InputField
                label="Company Name *"
                placeholder="Company Name"
                required
                value={formData.companyName}
                onChange={(e) =>
                  handleInputChange("companyName", e.target.value)
                }
              />

              <Dropdown
                label="Lead Type"
                placeholder="Select option"
                options={leadTypeOptions}
                value={formData.leadType}
                onChange={(e) => handleInputChange("leadType", e.target.value)}
              />

              <Dropdown
                label="Client Type"
                placeholder="Select type"
                options={clientTypeOptions}
                value={formData.clientType}
                onChange={(e) => handleInputChange("clientType", e.target.value)}
              />

              <InputField
                label="Address"
                placeholder="Address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />

              <InputField
                label="Country"
                placeholder="Country"
                value={formData.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
              />

               <Dropdown
                label="Industry Type"
                placeholder="Industry Type"
                options={industryTypeOptions}
                value={formData.industryType}
                onChange={(e) =>
                  handleInputChange("industryType", e.target.value)
                }
              />


               <Dropdown
                label="Lead Source"
                placeholder="Select lead source"
                options={leadSourceOptions}
                value={formData.leadSource}
                onChange={(e) =>
                  handleInputChange("leadSource", e.target.value)
                }
              />

              <Dropdown
                label="Lead Status"
                placeholder="Select lead status"
                options={leadStatusOptions}
                value={formData.currentStatus}
                onChange={(e) =>
                  handleInputChange("currentStatus", e.target.value)
                }
              />

              <InputField
                label="Tax ID (GST/VAT)"
                placeholder="Tax ID"
                value={formData.taxId}
                onChange={(e) => handleInputChange("taxId", e.target.value)}
              />

              <InputField
                label="Website"
                placeholder="Website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
              />

              <InputField
                label="Primary Contact Name"
                placeholder="Contact Name"
                value={formData.primaryContactName}
                onChange={(e) =>
                  handleInputChange("primaryContactName", e.target.value)
                }
              />

              <InputField
                label="Designation"
                placeholder="Designation"
                value={formData.designation}
                onChange={(e) =>
                  handleInputChange("designation", e.target.value)
                }
              />

              <InputField
                label="Phone (Office)"
                placeholder="Phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
              />

              <InputField
                label="Mobile (Personal)"
                placeholder="Mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleInputChange("mobile", e.target.value)}
              />

              <InputField
                label="Email *"
                placeholder="Email"
                required
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />

            

             

              <Dropdown
                label="Category"
                placeholder="Select category"
                options={categoryOptions}
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
              />

             

              <Dropdown
                label="Decision Maker"
                placeholder="Select option"
                options={decisionMakerOptions}
                value={formData.decisionMaker}
                onChange={(e) =>
                  handleInputChange("decisionMaker", e.target.value)
                }
              />

              <Dropdown
                label="Relationship Status"
                placeholder="Select status"
                options={relationshipStatusOptions}
                value={formData.relationshipStatus}
                onChange={(e) =>
                  handleInputChange("relationshipStatus", e.target.value)
                }
              />

                <InputField
                label="Social Links"
                placeholder="Social media profiles"
                value={formData.socialLinks}
                onChange={(e) =>
                  handleInputChange("socialLinks", e.target.value)
                }
              />

              <InputField
                label="Account Manager"
                placeholder="Account Manager"
                value={formData.accountManager}
                onChange={(e) =>
                  handleInputChange("accountManager", e.target.value)
                }
              />

              {/* <InputField
                label="Lead Source"
                placeholder="Lead Source"
                value={formData.leadSource} // Changed from accountManager
                onChange={(e) =>
                  handleInputChange("leadSource", e.target.value)
                }
              /> */}
              {/* <InputField
                label="Lead Current Status"
                placeholder="Select status"
                isDropdown
                options={currentStatusOptions}
                value={formData.currentStatus} // Changed from relationshipStatus
                onChange={(e) =>
                  handleInputChange("currentStatus", e.target.value)
                }
              /> */}
              <Dropdown
                label="Follow-up Status"
                placeholder="Select follow-up status"
                options={followupStatusOptions}
                value={formData.followupStatus}
                onChange={(e) =>
                  handleInputChange("followupStatus", e.target.value)
                }
              />
              <InputField
                label="Opportunity Value"
                placeholder="Opportunity Value"
                type="number"
                value={formData.opportunityValue} // Changed from accountManager
                onChange={(e) =>
                  handleInputChange("opportunityValue", e.target.value)
                }
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="billing-content">
            <div className="form-fields-grid">
              <InputField
                label="Typical Cargoes"
                placeholder="Typical Cargoes"
                value={formData.typicalCargoes}
                onChange={(e) =>
                  handleInputChange("typicalCargoes", e.target.value)
                }
              />

              <InputField
                label="Average Shipment Size"
                placeholder="Average Shipment Size"
                value={formData.averageShipmentSize}
                onChange={(e) =>
                  handleInputChange("averageShipmentSize", e.target.value)
                }
              />

              <InputField
                label="Shipment Frequency"
                placeholder="Shipment Frequency"
                value={formData.shipmentFrequency}
                onChange={(e) =>
                  handleInputChange("shipmentFrequency", e.target.value)
                }
              />

              <InputField
                label="Trading Routes"
                placeholder="Trading Routes"
                value={formData.tradingRoutes}
                onChange={(e) =>
                  handleInputChange("tradingRoutes", e.target.value)
                }
              />

              <Dropdown
                label="Contract Type"
                placeholder="Select contract type"
                options={contractTypeOptions}
                value={formData.contractType}
                onChange={(e) =>
                  handleInputChange("contractType", e.target.value)
                }
              />

               <Dropdown
                label="Incoterms"
                placeholder="Select incoterms"
                options={incotermsOptions}
                value={formData.incoterms}
                onChange={(e) => handleInputChange("incoterms", e.target.value)}
              />

              <InputField
                label="Historical Volume"
                placeholder="Historical Volume"
                value={formData.historicalVolume}
                onChange={(e) =>
                  handleInputChange("historicalVolume", e.target.value)
                }
              />

              <InputField
                label="Competitors"
                placeholder="Competitors"
                value={formData.competitors}
                onChange={(e) =>
                  handleInputChange("competitors", e.target.value)
                }
              />

              <InputField
                label="Project Name"
                placeholder="Project Name"
                value={formData.projectName}
                onChange={(e) =>
                  handleInputChange("projectName", e.target.value)
                }
              />

              <InputField
                label="Project Start Date"
                placeholder="Start Date"
                type="date"
                value={formData.projectTimelineStart}
                onChange={(e) =>
                  handleInputChange("projectTimelineStart", e.target.value)
                }
              />

              <InputField
                label="Project End Date"
                placeholder="End Date"
                type="date"
                value={formData.projectTimelineEnd}
                onChange={(e) =>
                  handleInputChange("projectTimelineEnd", e.target.value)
                }
              />

              <InputField
                label="EPC Contractor"
                placeholder="EPC Contractor"
                value={formData.epcContractor}
                onChange={(e) =>
                  handleInputChange("epcContractor", e.target.value)
                }
              />

              <InputField
                label="Special Requirements"
                placeholder="Special Requirements"
                textarea
                value={formData.specialRequirements}
                onChange={(e) =>
                  handleInputChange("specialRequirements", e.target.value)
                }
              />

              <InputField
                label="Risk Notes"
                placeholder="Risk Notes"
                textarea
                value={formData.riskNotes}
                onChange={(e) => handleInputChange("riskNotes", e.target.value)}
              />

              <InputField
                label="Preferred Load Ports"
                placeholder="Preferred Load Ports"
                value={formData.preferredLoadPorts}
                onChange={(e) =>
                  handleInputChange("preferredLoadPorts", e.target.value)
                }
              />

              <InputField
                label="Preferred Discharge Ports"
                placeholder="Preferred Discharge Ports"
                value={formData.preferredDischargePorts}
                onChange={(e) =>
                  handleInputChange("preferredDischargePorts", e.target.value)
                }
              />

              <InputField
                label="Demurrage Terms"
                placeholder="Demurrage Terms"
                value={formData.demurrageTerms}
                onChange={(e) =>
                  handleInputChange("demurrageTerms", e.target.value)
                }
              />

              <InputField
                label="Preferred Agents"
                placeholder="Preferred Agents"
                value={formData.preferredAgents}
                onChange={(e) =>
                  handleInputChange("preferredAgents", e.target.value)
                }
              />

             
            </div>
          </div>
        );

      case 3:
        const reviewData = [
          [
            {
              label: "Company Name",
              value: formData.companyName || "Not provided",
            },
            { label: "Client Type", value: formData.clientType || "Not provided" },
            { label: "Lead Type", value: formData.leadType || "Not provided" },
          ],
          [
            { label: "Email", value: formData.email || "Not provided" },
            { label: "Phone", value: formData.phone || "Not provided" },
            { label: "Mobile", value: formData.mobile || "Not provided" },
          ],
          [
            { label: "Country", value: formData.country || "Not provided" },
            { label: "Address", value: formData.address || "Not provided" },
            { label: "Tax ID", value: formData.taxId || "Not provided" },
          ],
          [
            {
              label: "Primary Contact",
              value: formData.primaryContactName || "Not provided",
            },
            {
              label: "Designation",
              value: formData.designation || "Not provided",
            },
            {
              label: "Industry Type",
              value: formData.industryType || "Not provided",
            },
          ],
          [
            {
              label: "Cargo Type",
              value: formData.cargoType || "Not provided",
            },
            {
              label: "Decision Maker",
              value: formData.decisionMaker || "Not provided",
            },
            {
              label: "Relationship Status",
              value: formData.relationshipStatus || "Not provided",
            },
          ],
          [
            {
              label: "Account Manager",
              value: formData.accountManager || "Not provided",
            },
            {
              label: "Contract Type",
              value: formData.contractType || "Not provided",
            },
            { label: "Incoterms", value: formData.incoterms || "Not provided" },
          ],
          [
            {
              label: "Lead Source",
              value: formData.leadSource || "Not provided",
            },
            {
              label: "Current Status",
              value: formData.currentStatus || "Not provided",
            },
            {
              label: "Opportunity Value",
              value: formData.opportunityValue
                ? `$${formData.opportunityValue}`
                : "Not provided",
            },
          ],
          [
            {
              label: "Category",
              value: formData.category || "Not provided",
            },
            {
              label: "Lead Source",
              value: formData.leadSource || "Not provided",
            },
            {
              label: "Lead Status",
              value: formData.currentStatus || "Not provided",
            },
          ],
          [{ label: "Website", value: formData.website || "Not provided" }],
        ];

        return (
          <div className="client-review-content">
            <div className="company-profile-section">
              <div className="company-info">
                {profileImage ? (
                  <img
                    src={URL.createObjectURL(profileImage)}
                    alt="Company logo"
                    className="company-logo"
                  />
                ) : clientData?.profilePicture ? (
                  <img
                    src={`${config.API_BASE_URL.replace("/api", "")}${
                      clientData.profilePicture
                    }`}
                    alt="Company logo"
                    className="company-logo"
                  />
                ) : (
                  <div className="default-company-logo">
                    {formData.companyName?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                )}
                <div className="company-name">
                  {formData.companyName || "Company Name"}
                </div>
              </div>
              <button className="edit-photo-button" onClick={handleEditPhoto}>
                <span className="edit-photo-text">Edit Photo</span>
                <img
                  src={editIcon}
                  alt="Edit icon"
                  className="edit-photo-icon"
                />
              </button>
            </div>

            <div className="client-data-section">
              {reviewData.map((row, rowIndex) => (
                <div key={rowIndex} className="data-row">
                  {row.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="data-field">
                      <div className="field-label">{field.label}</div>
                      <div className="field-value">{field.value}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "Corporate Details";
      case 2:
        return "Billing & Operational Details";
      case 3:
        return "Review Client Information";
      default:
        return "Add New Client";
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="add-client-modal">
        <div className="add-client-header">
          <h1 className="add-client-title">{getStepTitle()}</h1>
          <button className="close-button" onClick={onClose}>
            <div className="close-icon">&times;</div>
          </button>
        </div>

        <ProgressSteps
          currentStep={currentStep}
          onStepClick={handleStepClick}
          steps={["Corporate Details", "Billing Details", "Review"]}
        />



        {renderStepContent()}

        <div className="form-actions">
          {currentStep > 1 && (
            <button className="button-secondary" onClick={handlePrevious}>
              Previous
            </button>
          )}
          {currentStep < 3 ? (
            <button className="button-primary" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button
              className="button-primary"
              onClick={handleFinish}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding Client..." : "Finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditClientModal;
