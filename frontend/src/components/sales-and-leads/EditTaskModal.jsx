import React, { useEffect, useState } from "react";
import "./CreateEventModal.css";
import DatePickerModal from "../DatePickerModal";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import { updateTask } from "../../services/TaskService";
import employeeService from "../../services/EmployeeService";
import clientService from "../../services/ClientService";
import Select from "react-select";

function EditTaskModal({ isOpen, onClose, clientId, task, onTaskUpdated }) {
  const [formData, setFormData] = useState({
    eventName: "",
    project: "",
    priority: "",
    date: "",
    assignedTeamMembers: [],
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);

  // Load employees
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await employeeService.getEmployees();
        setEmployees(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load employees", e);
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await clientService.getClients();
        setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load clients", e);
        setClients([]);
      }
    };
    loadClients();
  }, []);

  // Populate form with task data when modal opens or task changes
  useEffect(() => {
    if (task) {
      // Format date
      let formattedDate = "";
      if (task.date) {
        const date = new Date(task.date);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        formattedDate = `${y}-${m}-${d}`;
      }

      // Convert assignedEmployees to string array
      let assignedMembers = [];
      if (Array.isArray(task.assignedEmployees)) {
        assignedMembers = task.assignedEmployees.map((emp) => {
          // Handle both ObjectId strings and employee objects
          if (typeof emp === "string") {
            return emp;
          } else if (emp && emp._id) {
            return emp._id.toString();
          }
          return emp;
        });
      }

      setFormData({
        eventName: task.title || "",
        project: task.project || "",
        priority: task.priority || "Medium",
        date: formattedDate,
        assignedTeamMembers: assignedMembers,
      });
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.eventName || !formData.date) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      // Parse yyyy-mm-dd as local date to avoid timezone shifting
      let eventDate = null;
      if (formData.date) {
        const [y, m, d] = formData.date.split("-").map((v) => parseInt(v, 10));
        eventDate = new Date(y, (m || 1) - 1, d || 1);
      }

      const taskData = {
        title: formData.eventName,
        project: formData.project,
        priority: formData.priority || "Medium",
        date: eventDate,
        assignedEmployees: formData.assignedTeamMembers,
        status: task.status || "todo", // Keep existing status
      };

      console.log("Updating task with data:", taskData);
      const updatedTask = await updateTask(clientId, task._id, taskData);
      console.log("Task updated successfully:", updatedTask);

      if (onTaskUpdated) {
        onTaskUpdated(updatedTask);
      }

      onClose();
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateIconClick = () => {
    setIsDatePickerOpen(true);
  };

  const handleDatePickerClose = () => {
    setIsDatePickerOpen(false);
  };

  const handleDateSelect = (selectedDate) => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    const formattedLocal = `${y}-${m}-${d}`;
    handleInputChange("date", formattedLocal);
    setIsDatePickerOpen(false);
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    const [y, m, d] = dateString.split("-");
    if (!y || !m || !d) return dateString;
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="create-event-modal-backdrop" onClick={handleBackdropClick}>
      <div className="create-event-modal">
        <div className="modal-event-content">
          <div className="modal-eventheader">
            <h2 className="modal-title">Edit Task</h2>
            <p className="modal-subtitle">
              Update your task priority, people, and date.
            </p>
          </div>

          <div className="form-fields">
            <div className="input-field">
              <label className="field-label">Task Name *</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Eg. Client Meeting"
                  value={formData.eventName}
                  onChange={(e) =>
                    handleInputChange("eventName", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Select Project *</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={formData.project}
                  onChange={(e) => handleInputChange("project", e.target.value)}
                >
                  <option value="">Select Project</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.companyName}
                    </option>
                  ))}
                </select>
                <div className="select-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="#98A1B0"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Task Priority *</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={formData.priority}
                  onChange={(e) =>
                    handleInputChange("priority", e.target.value)
                  }
                >
                  <option value="">Select priority</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
                <div className="select-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="#98A1B0"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Select a date *</label>
              <div className="date-wrapper">
                <input
                  type="text"
                  className="form-input has-icon"
                  value={formatDateForDisplay(formData.date)}
                  placeholder="DD/MM/YYYY"
                  readOnly
                />
                <div className="input-icon" onClick={handleDateIconClick}>
                  <img
                    src={calendarIcon}
                    alt="Calendar"
                    width="16"
                    height="16"
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Assign Team Members</label>
              <Select
                isMulti
                options={employees.map((emp) => ({
                  value: emp._id.toString(),
                  label: emp.employeeName,
                }))}
                value={employees
                  .filter((emp) =>
                    formData.assignedTeamMembers.includes(emp._id.toString())
                  )
                  .map((emp) => ({
                    value: emp._id.toString(),
                    label: emp.employeeName,
                  }))}
                onChange={(selectedOptions) => {
                  const values = selectedOptions
                    ? selectedOptions.map((o) => o.value)
                    : [];
                  handleInputChange("assignedTeamMembers", values);
                }}
                placeholder="Select team members..."
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="event-cancel-button"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="event-attach-button"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update Task"}
          </button>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={handleDatePickerClose}
        onSelectDate={handleDateSelect}
        selectedDate={formData.date}
      />
    </div>
  );
}

export default EditTaskModal;
