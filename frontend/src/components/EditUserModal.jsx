import React, { useState, useEffect } from "react";
import styles from "./AddUserModal.module.css";
import EmployeeService from "../services/EmployeeService";

const EditUserModal = ({ isOpen, onClose, onSubmit, userToEdit }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "", // Optional for edit
    emailId: "",
    phoneNumber: "",
    role: "sales_executive",
    employeeId: "",
  });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && userToEdit) {
      setFormData({
        username: userToEdit.username || "",
        password: "", // Start blank
        emailId: userToEdit.emailId || "",
        phoneNumber: userToEdit.phoneNumber || "",
        role: userToEdit.role || "sales_executive",
        employeeId: userToEdit.employeeId || "",
      });
      fetchEmployees();
    }
  }, [isOpen, userToEdit]);

  const fetchEmployees = async () => {
    try {
      const data = await EmployeeService.getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.username.trim()) {
        throw new Error("Username is required");
      }
      if (formData.password && formData.password.length < 6) {
         throw new Error("Password must be at least 6 characters long");
      }
      if (formData.emailId && !/\S+@\S+\.\S+/.test(formData.emailId)) {
        throw new Error("Please enter a valid email address");
      }

      // We pass the entire formData. If password is empty string, the backend should ignore it or handle it.
      // But usually we'd want to remove it if it's empty so we don't send "" as password.
      // However, the backend logic I wrote expects "password" in body. 
      // Checking backend again: if (password && password.trim() !== '') ...
      // So sending empty string is fine, backend ignores it.

      await onSubmit(userToEdit._id, formData);

      onClose();
    } catch (err) {
      setError(err.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Edit User</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={loading}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="employeeId">Select Employee (Optional)</label>
            <select
              id="employeeId"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="">-- Select Employee --</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.employeeName} ({emp.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">New Password (Optional)</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Leave blank to keep same"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="emailId">Email ID</label>
            <input
              type="email"
              id="emailId"
              name="emailId"
              value={formData.emailId}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="role">Role *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
              disabled={loading}
            >
              <option value="">-- Select Role --</option>
              <option value="managing_director">Managing Director</option>
              <option value="director">Director</option>
              <option value="accounts_manager">Accounts Manager</option>
              <option value="chartering_manager">Chartering Manager</option>
              <option value="business_development_manager">
                Business Development Manager - Projects & Break Bulk
              </option>
              <option value="office_assistance">Office Assistance</option>
              <option value="executive_post_fixture">
                Executive Post-Fixture
              </option>
              <option value="operations_pricing_manager">
                Operations Manager
              </option>
              <option value="operations_executive">Operations Executive</option>
              <option value="operations_pricing_manager">
                Pricing Manager
              </option>
               <option value="operations_pricing_manager">
                Pricing Executive
              </option>
              <option value="sales_executive">Sales Executive</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={styles.submitButton}
            >
              {loading ? "Updating..." : "Update User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
