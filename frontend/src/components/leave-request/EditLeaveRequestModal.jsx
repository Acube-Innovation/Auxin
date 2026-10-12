import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import leaveRequestService from "../../services/LeaveRequestService";
import EmployeeService from "../../services/EmployeeService";
import InputField from "../InputField";
import Dropdown from "../DropDown";
import DatePickerModal from "../DatePickerModal";
import { OFFICIAL_HOLIDAYS_2026 } from "../../utils/leaveHolidays";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import "../sales-and-leads/AddClientModal.css";

function EditLeaveRequestModal({ isOpen, onClose, onSubmit, leaveRequest }) {
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userRole, setUserRole] = useState("");
    const [employees, setEmployees] = useState([]);
    const [formData, setFormData] = useState({
        employeeId: "",
        employeeName: "",
        company: "",
        leaveType: "Personal Leave",
        startDate: "",
        endDate: "",
        reason: "",
        status: "Pending"
    });
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null); // 'start' | 'end'

    const handleDateSelect = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const value = `${y}-${m}-${d}`;
        setFormData((prev) => ({ ...prev, [datePickerField === "start" ? "startDate" : "endDate"]: value }));
        setDatePickerOpen(false);
    };

    useEffect(() => {
        setUserRole(localStorage.getItem("role") || "");
        if (isOpen && userRole === "admin") {
            fetchEmployees();
        }
    }, [isOpen, userRole]);

    useEffect(() => {
        if (leaveRequest) {
            setFormData({
                employeeId: leaveRequest.employee?._id || leaveRequest.employee || "",
                employeeName: leaveRequest.employee?.username || leaveRequest.employeeName || "",
                company: leaveRequest.company || "",
                leaveType: leaveRequest.leaveType || "Personal Leave",
                startDate: leaveRequest.startDate ? new Date(leaveRequest.startDate).toISOString().split('T')[0] : "",
                endDate: leaveRequest.endDate ? new Date(leaveRequest.endDate).toISOString().split('T')[0] : "",
                reason: leaveRequest.reason || "",
                status: leaveRequest.status || "Pending"
            });
        }
    }, [leaveRequest]);

    const fetchEmployees = async () => {
        try {
            const data = await EmployeeService.getEmployees();
            setEmployees(data);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleEmployeeChange = (e) => {
        const selectedId = e.target.value;
        const selectedEmployee = employees.find(emp => emp._id === selectedId);
        setFormData((prev) => ({
            ...prev,
            employeeId: selectedId,
            employeeName: selectedEmployee ? selectedEmployee.employeeName : ""
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const result = await leaveRequestService.updateLeaveRequest(leaveRequest._id, formData);
            showToast("Leave request updated successfully.", "success");
            onSubmit(result);
            onClose();
        } catch (error) {
            console.error("Error updating leave request:", error);
            showToast(error.response?.data?.message || "Failed to update leave request.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const leaveTypeOptions = [
        { value: "Sick Leave", label: "Sick Leave" },
        { value: "Vacation", label: "Vacation" },
        { value: "Personal Leave", label: "Personal Leave" },
        { value: "Maternity/Paternity", label: "Maternity/Paternity" },
        { value: "Other", label: "Other" },
        { value: "Casual Leave", label: "Casual Leave" },
        { value: "Privilege Leave", label: "Privilege Leave" }
    ];

    const statusOptions = [
        { value: "Pending", label: "Pending" },
        { value: "Approved", label: "Approved" },
        { value: "Rejected", label: "Rejected" }
    ];

    const companyOptions = [
        { value: "Auxin Bulk Pvt Ltd", label: "Auxin Bulk Pvt Ltd" },
        { value: "Auxin Projects Pvt Ltd", label: "Auxin Projects Pvt Ltd" },
        { value: "Auxin Shipping Pvt Ltd", label: "Auxin Shipping Pvt Ltd" }
    ];

    const employeeOptions = employees.map(emp => ({
        value: emp._id,
        label: emp.employeeName || emp.name || "Unknown"
    }));

    const isAdmin = userRole === "admin";
    const isEditable = isAdmin || leaveRequest?.status === "Pending";

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="add-client-modal" style={{ width: "40rem", height: "auto", maxHeight: "90vh" }}>
                <div className="add-client-header">
                    <h2 className="add-client-title">Edit Leave Management</h2>
                    <button className="close-button" onClick={onClose}>
                        <span className="close-icon">&times;</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="add-client-content" style={{ padding: "2rem 2.5rem", gap: "1.5rem" }}>
                        <div className="form-fields-grid">
                            {isAdmin ? (
                                <Dropdown
                                    label="Employee *"
                                    placeholder="Select employee"
                                    options={employeeOptions}
                                    value={formData.employeeId}
                                    onChange={handleEmployeeChange}
                                    disabled={!isEditable}
                                />
                            ) : (
                                <InputField
                                    label="Employee"
                                    value={formData.employeeName}
                                    disabled={true}
                                    readOnly={true}
                                />
                            )}

                            <Dropdown
                                label="Company *"
                                placeholder="Select company"
                                options={companyOptions}
                                value={formData.company}
                                onChange={(e) => handleInputChange("company", e.target.value)}
                                disabled={!isEditable}
                            />

                            <Dropdown
                                label="Leave Type *"
                                placeholder="Select leave type"
                                options={leaveTypeOptions}
                                value={formData.leaveType}
                                onChange={(e) => handleInputChange("leaveType", e.target.value)}
                                disabled={!isEditable}
                            />

                            {isEditable ? (
                                <>
                                    <div className="input-field">
                                        <div className="input-label-container">
                                            <label className="input-label">Start Date <span style={{ color: "red", marginLeft: "4px" }}>*</span></label>
                                        </div>
                                        <div className="input-container" style={{ cursor: "pointer" }} onClick={() => { setDatePickerField("start"); setDatePickerOpen(true); }}>
                                            <input type="text" className="input-field-input" readOnly value={formData.startDate || ""} placeholder="Select date" />
                                            <img src={calendarIcon} alt="" width="16" height="16" style={{ flexShrink: 0 }} />
                                        </div>
                                    </div>
                                    <div className="input-field">
                                        <div className="input-label-container">
                                            <label className="input-label">End Date <span style={{ color: "red", marginLeft: "4px" }}>*</span></label>
                                        </div>
                                        <div className="input-container" style={{ cursor: "pointer" }} onClick={() => { setDatePickerField("end"); setDatePickerOpen(true); }}>
                                            <input type="text" className="input-field-input" readOnly value={formData.endDate || ""} placeholder="Select date" />
                                            <img src={calendarIcon} alt="" width="16" height="16" style={{ flexShrink: 0 }} />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <InputField
                                        label="Start Date *"
                                        type="date"
                                        value={formData.startDate}
                                        disabled={true}
                                    />
                                    <InputField
                                        label="End Date *"
                                        type="date"
                                        value={formData.endDate}
                                        disabled={true}
                                    />
                                </>
                            )}

                            {isAdmin && (
                                <Dropdown
                                    label="Status *"
                                    placeholder="Select status"
                                    options={statusOptions}
                                    value={formData.status}
                                    onChange={(e) => handleInputChange("status", e.target.value)}
                                />
                            )}

                            <InputField
                                label="Reason *"
                                placeholder="Enter reason for leave"
                                value={formData.reason}
                                onChange={(e) => handleInputChange("reason", e.target.value)}
                                disabled={!isEditable}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="button-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Updating..." : "Update"}
                        </button>
                    </div>
                </form>
            </div>
            {isEditable && (
                <DatePickerModal
                    isOpen={datePickerOpen}
                    onClose={() => setDatePickerOpen(false)}
                    onSelectDate={handleDateSelect}
                    selectedDate={datePickerField === "start" ? formData.startDate : formData.endDate}
                    disabledDates={OFFICIAL_HOLIDAYS_2026}
                    highlightHolidayDates
                />
            )}
        </div>
    );
}

export default EditLeaveRequestModal;
