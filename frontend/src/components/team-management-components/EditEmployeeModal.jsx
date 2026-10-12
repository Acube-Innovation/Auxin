import React, { useState, useEffect } from "react";
import "./AddEmployeeModal.css"; // Using the same CSS file
import ProgressSteps from "../ProgressSteps";
import InputField from "../InputField";
import ProfilePhotoUpload from "../ProfilePhotoUpload";
import editIcon from "../../assets/dashboard/pencil-line-blue.svg";
import employeeService from "../../services/EmployeeService";
import ClientService from "../../services/ClientService";
import roleService from "../../services/RoleService";
import departmentService from "../../services/DepartmentService";
import Dropdown from "../DropDown";
import Select from "react-select";
import ToastContainer from "../Toast";

// Options for dropdowns
  const activeOptions = [
    { value: "", label: "-Select-" },
    { value: "Active", label: "Active" },
    { value: "InActive", label: "InActive" },
  ];

// Original default departments — always shown in the dropdown,
// even when the API has no custom additions yet.
const DEFAULT_DEPARTMENTS = [
  "Bulk Sales",
  "Bulk Operations",
  "Project Sales",
  "Project Operations",
  "HR",
  "Finance",
  "IT",
  "Logistics",
  "Customer Service",
];

const buildDefaultDepartmentOptions = () => [
  { value: "", label: "-Select-" },
  ...DEFAULT_DEPARTMENTS.map((name) => ({ value: name, label: name })),
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
  const [roleOptions, setRoleOptions] = useState([
    { value: "", label: "-Select-" },
  ]);
  const [departmentOptions, setDepartmentOptions] = useState(
    buildDefaultDepartmentOptions()
  );

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

  // Populate form when opening; load roles from API then normalize fields
  useEffect(() => {
    if (!employee || !isOpen) return;
    let cancelled = false;

    const findMatchingRole = (value, options) => {
      if (!value) return "";
      const valStr = value.toString().toLowerCase();
      const match = options.find(
        (opt) =>
          opt.value &&
          (opt.value.toLowerCase() === valStr ||
            opt.label.toLowerCase() === valStr)
      );
      return match ? match.value : value;
    };

    const findMatchingDepartment = (value, options) => {
      if (!value) return "";
      const valStr = value.toString().toLowerCase();
      const match = options.find(
        (opt) =>
          opt.value.toLowerCase() === valStr ||
          opt.label.toLowerCase() === valStr
      );
      return match ? match.value : value;
    };

    (async () => {
      let roleOpts = [{ value: "", label: "-Select-" }];
      let deptOpts = buildDefaultDepartmentOptions();

      try {
        const [roles, departments] = await Promise.all([
          roleService.getRoles().catch((err) => {
            console.error("Failed to load roles:", err);
            return [];
          }),
          departmentService.getDepartments().catch((err) => {
            console.error("Failed to load departments:", err);
            return [];
          }),
        ]);
        if (cancelled) return;

        roleOpts = [
          { value: "", label: "-Select-" },
          ...roles.map((r) => ({
            value: r.name,
            label: r.name,
            id: String(r._id),
          })),
        ];

        // Always start from the original default list, then append any
        // additional (custom) departments returned by the API. Defaults stay.
        const base = buildDefaultDepartmentOptions();
        const seen = new Set(
          base.map((o) => (o.value || "").toLowerCase()).filter(Boolean)
        );
        const extras = departments
          .filter((d) => {
            const key = String(d.name || "").trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((d) => ({
            value: d.name,
            label: d.name,
            ...(d.isDefault ? {} : { id: String(d._id) }),
          }));
        deptOpts = [...base, ...extras];

        setRoleOptions(roleOpts);
        setDepartmentOptions(deptOpts);
      } catch (err) {
        console.error("Failed to load role/department options:", err);
        if (cancelled) return;
      }

      const normalizedRole = findMatchingRole(employee.role, roleOpts);
      const normalizedDepartment = findMatchingDepartment(
        employee.department,
        deptOpts
      );

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

      if (employee.profilePhotoUrl) {
        setCurrentProfileImageUrl(employee.profilePhotoUrl);
      }

      setCurrentStep(1);
      setProfileImage(null);
      setValidationErrors({});
    })();

    return () => {
      cancelled = true;
    };
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
      setRoleOptions([{ value: "", label: "-Select-" }]);
      setDepartmentOptions(buildDefaultDepartmentOptions());
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

  const handleAddCustomRole = async (name) => {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) return;
    try {
      const created = await roleService.createRole(trimmed);
      const id = created._id != null ? String(created._id) : "";
      setRoleOptions((prev) => {
        const exists = prev.some(
          (o) =>
            o.value &&
            o.value.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            value: created.name,
            label: created.name,
            ...(id ? { id } : {}),
          },
        ];
      });
      handleInputChange("role", created.name);
    } catch (err) {
      addToast(err.message || "Failed to save role", "error");
      throw err;
    }
  };

  const handleDeleteRole = async (roleId) => {
    const target = roleOptions.find((o) => o.id === roleId);
    const removedValue = target?.value;
    try {
      await roleService.deleteRole(roleId);
      setRoleOptions((prev) => prev.filter((o) => o.id !== roleId));
      if (removedValue && formData.role === removedValue) {
        handleInputChange("role", "");
      }
    } catch (err) {
      addToast(err.message || "Failed to delete role", "error");
    }
  };

  const handleAddCustomDepartment = async (name) => {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) return;
    try {
      const created = await departmentService.createDepartment(trimmed);
      const id = created._id != null ? String(created._id) : "";
      setDepartmentOptions((prev) => {
        const exists = prev.some(
          (o) =>
            o.value &&
            o.value.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            value: created.name,
            label: created.name,
            ...(id ? { id } : {}),
          },
        ];
      });
      handleInputChange("department", created.name);
    } catch (err) {
      addToast(err.message || "Failed to save department", "error");
      throw err;
    }
  };

  const handleDeleteDepartment = async (departmentId) => {
    const target = departmentOptions.find((o) => o.id === departmentId);
    const removedValue = target?.value;
    try {
      await departmentService.deleteDepartment(departmentId);
      setDepartmentOptions((prev) => prev.filter((o) => o.id !== departmentId));
      if (removedValue && formData.department === removedValue) {
        handleInputChange("department", "");
      }
    } catch (err) {
      addToast(err.message || "Failed to delete department", "error");
    }
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
                allowAddOption
                onAddOption={handleAddCustomRole}
                allowDeleteOption
                onDeleteOption={handleDeleteRole}
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
                allowAddOption
                onAddOption={handleAddCustomDepartment}
                addOptionLabel="Add new department"
                allowDeleteOption
                onDeleteOption={handleDeleteDepartment}
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
