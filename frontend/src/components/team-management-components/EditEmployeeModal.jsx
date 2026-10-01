import React, { useState, useEffect } from "react";
import "./AddEmployeeModal.css"; // Using the same CSS file
import ProgressSteps from "../ProgressSteps";
import InputField from "../InputField";
import ProfilePhotoUpload from "../ProfilePhotoUpload";
import editIcon from "../../assets/dashboard/pencil-line-blue.svg";
import employeeService from "../../services/EmployeeService";
import ClientService from "../../services/ClientService";
import Dropdown from "../DropDown";
import Select from "react-select";
import ToastContainer from "../Toast";

// Options for dropdowns
  const activeOptions = [
    { value: "", label: "-Select-" },
    { value: "Active", label: "Active" },
    { value: "InActive", label: "InActive" },
  ];

 const departmentOptions = [
    { value: "", label: "-Select-" },
    { value: "Bulk Sales", label: "Bulk Sales" },
    { value: "Bulk Operations", label: "Bulk Operations" },
    { value: "Project Sales", label: "Project Sales" },
    { value: "Project Operations", label: "Project Operations" },
    { value: "HR", label: "HR" },
    { value: "Finance", label: "Finance" },
    { value: "IT", label: "IT" },
    { value: "Logistics", label: "Logistics" },
    { value: "Customer Service", label: "Customer Service" },
];

  const roleOptions = [
    { value: "", label: "-Select-" },
    { value: "Managing Director", label: "Managing Director" },
    { value: "Director", label: "Director" },
    { value: "Business Development Manager", label: "Business Development Manager" },
    { value: "Sales Executive", label: "Sales Executive" },
    { value: "Operations Manager", label: "Operations Manager" },
    { value: "Operations Executive", label: "Operations Executive" },
    { value: "Pricing Manager", label: "Pricing Manager" },
    { value: "Pricing Executive", label: "Pricing Executive" },
    { value: "Logistics Coordinator", label: "Logistics Coordinator" },
    { value: "Account Manager", label: "Account Manager" },
    { value: "HR Manager", label: "HR Manager" },
    { value: "IT Specialist", label: "IT Specialist" },
    {
      value: "Customer Service Representative",
      label: "Customer Service Representative",
    },
];

function EditEmployeeModal({ isOpen, onClose, onSubmit, employee }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileImage, setProfileImage] = useState(null);
  const [currentProfileImageUrl, setCurrentProfileImageUrl] = useState(null);

  const [formData, setFormData] = useState({
    // 1. Basic Information
    employeeId: "",
    employeeName: "",
    mobile: "",
    emailId: "",

    // 2. Employment Details
    role: "",
    designation: "",
    department: "",
    employeeStatus: "Active",
    attendance: "Onsite",

    // 3. Project Assignments
    assignedProjects: [],
  });

  const [clients, setClients] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      const data = await ClientService.getClients();
      const clientList = Array.isArray(data) ? data : data.clients || [];
      setClients(clientList);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
      setClients([]);
    }
  };

  // Populate form data when employee prop changes
  useEffect(() => {
    if (employee && isOpen) {
      console.log("EditEmployeeModal - Employee Data:", employee);
      console.log("EditEmployeeModal - Role Options:", roleOptions);
      console.log("EditEmployeeModal - Department Options:", departmentOptions);

      // Helper to find matching option value
      const findMatchingValue = (value, options) => {
        if (!value) return "";
        const valStr = value.toString().toLowerCase();
        const match = options.find(
          (opt) =>
            opt.value.toLowerCase() === valStr ||
            opt.label.toLowerCase() === valStr
        );
        console.log(`findMatchingValue - Value: ${value}, Match:`, match);
        return match ? match.value : value;
      };

      const normalizedRole = findMatchingValue(employee.role, roleOptions);
      const normalizedDepartment = findMatchingValue(employee.department, departmentOptions);

      console.log("Normalized Role:", normalizedRole);
      console.log("Normalized Department:", normalizedDepartment);

      setFormData({
        employeeId: employee.employeeId || "",
        employeeName: employee.employeeName || "",
        mobile: employee.mobile || "",
        emailId: employee.emailId || "",
        role: normalizedRole,
        designation: employee.designation || "",
        department: normalizedDepartment,
        employeeStatus: employee.employeeStatus || "Active",
        attendance: employee.attendance || "Onsite",
        assignedProjects: Array.isArray(employee.assignedProjects)
          ? employee.assignedProjects.map((p) =>
              typeof p === "object" && p !== null ? p._id : p
            )
          : [],
      });

      // Set current profile image URL if exists
      if (employee.profilePhotoUrl) {
        setCurrentProfileImageUrl(employee.profilePhotoUrl);
      }

      // Reset form state
      setCurrentStep(1);
      setProfileImage(null);
      setValidationErrors({});
    }
  }, [employee, isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setProfileImage(null);
      setCurrentProfileImageUrl(null);
      setValidationErrors({});
      setFormData({
        employeeId: "",
        employeeName: "",
        mobile: "",
        emailId: "",
        role: "",
        designation: "",
        department: "",
        employeeStatus: "Active",
        attendance: "Onsite",
        assignedProjects: [],
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
      setValidationErrors({});
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field if it exists
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleProjectSelection = (selectedOptions) => {
    const selectedValues = selectedOptions
      ? selectedOptions.map((option) => option.value)
      : [];
    setFormData((prev) => ({
      ...prev,
      assignedProjects: selectedValues,
    }));
  };

  const addToast = (message, type = "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setValidationErrors({});
    }
  };

  const validateStep = (step) => {
    const errors = {};
    const missingFields = [];

    if (step === 1) {
      if (!formData.employeeId) { errors.employeeId = true; missingFields.push("Employee ID"); }
      if (!formData.employeeName) { errors.employeeName = true; missingFields.push("Employee Name"); }
      if (!formData.mobile) { errors.mobile = true; missingFields.push("Mobile Number"); }
      if (!formData.emailId) { errors.emailId = true; missingFields.push("Email ID"); }
      if (!formData.role) { errors.role = true; missingFields.push("Role"); }
    } else if (step === 2) {
      if (!formData.department) { errors.department = true; missingFields.push("Department"); }
    }

    setValidationErrors(errors);

    if (missingFields.length > 0) {
      addToast(
        `Please fill in the following required fields: ${missingFields.join(", ")}`,
        "error"
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleStepClick = (stepId) => {
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
      setValidationErrors({});
    }
  };

  const handleFinish = async () => {
    // Validate required fields
    const errors = {};
    const missingFields = [];

    if (!formData.employeeId) { errors.employeeId = true; missingFields.push("Employee ID"); }
    if (!formData.employeeName) { errors.employeeName = true; missingFields.push("Employee Name"); }
    if (!formData.mobile) { errors.mobile = true; missingFields.push("Mobile Number"); }
    if (!formData.emailId) { errors.emailId = true; missingFields.push("Email ID"); }
    if (!formData.role) { errors.role = true; missingFields.push("Role"); }
    if (!formData.department) { errors.department = true; missingFields.push("Department"); }

    if (missingFields.length > 0) {
      setValidationErrors(errors);
      addToast(
        `Please fill in the following required fields: ${missingFields.join(", ")}`,
        "error"
      );
      return;
    }

    setIsSubmitting(true);
    setValidationErrors({});

    try {
      // Filter out empty fields
      const filteredData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== "")
      );

      // assignedProjects is already an array of IDs

      const updatedEmployee = await employeeService.updateEmployeeWithFile(
        employee._id || employee.id,
        filteredData,
        profileImage
      );

      // Call the onSubmit callback with the updated employee data
      if (onSubmit) {
        onSubmit(updatedEmployee);
      }

      onClose();
    } catch (err) {
      console.error("Error updating employee:", err);

      let errorMessage =
        err.message || "Failed to create employee. Please try again.";

      // Handle duplicate email error
      if (
        err.message.includes("email") &&
        err.message.includes("already exists")
      ) {
        errorMessage =
          "An employee with this email already exists. Please use a different email.";
      } else if (
        err.message.includes("employeeId") &&
        err.message.includes("already exists")
      ) {
        errorMessage =
          "An employee with this ID already exists. Please use a different Employee ID.";
      } else if (err.message.includes("Duplicate")) {
        errorMessage =
          "Duplicate entry found. Please check the information and try again.";
      }
      
      addToast(err.message || "Failed to update employee. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };


  const handlePhotoUpload = (file) => {
    setProfileImage(file);
    setCurrentProfileImageUrl(null); // Clear current URL when new file is uploaded
  };

  const handleEditPhoto = () => {
    // Trigger file input for photo upload
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handlePhotoUpload(file);
      }
    };
    fileInput.click();
  };



  const clientOptions = clients.map((client) => ({
    value: client._id,
    label: client.clientName || client.companyName || "Unnamed Client",
  }));

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="add-client-content">
            <ProfilePhotoUpload
              onUpload={handlePhotoUpload}
              currentImageUrl={currentProfileImageUrl}
              defaultText="Update Profile Photo"
            />
            <div className="form-fields-grid">
              <InputField
                label="Employee ID"
                placeholder="EMP-001"
                required
                value={formData.employeeId}
                onChange={(e) =>
                  handleInputChange("employeeId", e.target.value)
                }
                hasError={validationErrors.employeeId}
              />

              <InputField
                label="Employee Name"
                placeholder="Full Name"
                required
                value={formData.employeeName}
                onChange={(e) =>
                  handleInputChange("employeeName", e.target.value)
                }
                hasError={validationErrors.employeeName}
              />

              <InputField
                label="Mobile Number"
                placeholder="+91 1234567890"
                required
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleInputChange("mobile", e.target.value)}
                hasError={validationErrors.mobile}
              />

              <InputField
                label="Email ID"
                placeholder="employee@company.com"
                required
                type="email"
                value={formData.emailId}
                onChange={(e) => handleInputChange("emailId", e.target.value)}
                hasError={validationErrors.emailId}
              />

              <Dropdown
                label="Role"
                placeholder="Select role"
                required
                options={roleOptions}
                value={formData.role}
                onChange={(e) => handleInputChange("role", e.target.value)}
                hasError={validationErrors.role}
              />

              <InputField
                label="Designation"
                placeholder="Designation"
                value={formData.designation}
                onChange={(e) =>
                  handleInputChange("designation", e.target.value)
                }
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="billing-content">
            <div className="form-fields-grid">
              <Dropdown
                label="Department"
                placeholder="Select department"
                required
                options={departmentOptions}
                value={formData.department}
                onChange={(e) =>
                  handleInputChange("department", e.target.value)
                }
                hasError={validationErrors.department}
              />

              <Dropdown
                label="Active Status"
                placeholder="Select status"
                options={activeOptions}
                value={formData.employeeStatus}
                onChange={(e) =>
                  handleInputChange("employeeStatus", e.target.value)
                }
              />

              <div className="input-group" style={{ width: "100%" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "500",
                    color: "#333",
                    flexDirection: "column",
                    fontSize: "14px",
                  }}
                >
                  Assigned Projects
                </label>
                <Select
                  isMulti
                  options={clientOptions}
                  value={clientOptions.filter((option) =>
                    formData.assignedProjects.includes(option.value)
                  )}
                  onChange={handleProjectSelection}
                  placeholder="Select projects..."
                  className="form-select-container"
                  classNamePrefix="select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "44px",
                      borderRadius: "8px",
                      borderColor: "#E0E0E0",
                      boxShadow: "none",
                      "&:hover": {
                        borderColor: "#BDBDBD",
                      },
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999,
                    }),
                  }}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        const selectedProjectNames = clients
          .filter((c) => formData.assignedProjects.includes(c._id))
          .map((c) => c.clientName || c.companyName)
          .join(", ");

        const employeeData = [
          [
            {
              label: "Employee ID",
              value: formData.employeeId || "Not provided",
            },
            {
              label: "Employee Name",
              value: formData.employeeName || "Not provided",
            },
          ],
          [
            { label: "Mobile", value: formData.mobile || "Not provided" },
            { label: "Email", value: formData.emailId || "Not provided" },
          ],
          [
            { label: "Role", value: formData.role || "Not provided" },
            {
              label: "Designation",
              value: formData.designation || "Not provided",
            },
          ],
          [
            {
              label: "Department",
              value: formData.department || "Not provided",
            },
            {
              label: "employeeStatus",
              value: formData.employeeStatus || "Not provided",
            },
          ],
          [
            {
              label: "Assigned Projects",
              value: selectedProjectNames || "Not assigned",
            },
          ],
        ];

        return (
          <div className="client-review-content">
            <div className="company-profile-section">
              <div className="company-info">
                {profileImage ? (
                  <img
                    src={URL.createObjectURL(profileImage)}
                    alt="Employee"
                    className="company-logo"
                  />
                ) : currentProfileImageUrl ? (
                  <img
                    src={currentProfileImageUrl}
                    alt="Employee"
                    className="company-logo"
                  />
                ) : (
                  <div className="default-company-logo">
                    {formData.employeeName?.charAt(0)?.toUpperCase() || "E"}
                  </div>
                )}
                <div className="company-name">
                  {formData.employeeName || "Employee Name"}
                </div>
                {/* <div className="employee-id">
                  {formData.employeeId || "Employee ID"}
                </div> */}
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
              {employeeData.map((row, rowIndex) => (
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
        return "Edit Basic Information";
      case 2:
        return "Edit Employment Details";
      case 3:
        return "Review Updated Information";
      default:
        return "Edit Employee";
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
          steps={["Basic Info", "Employment Details", "Review"]}
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
              {isSubmitting ? "Updating Employee..." : "Update"}
            </button>
          )}
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </div>
  );
}

export default EditEmployeeModal;
