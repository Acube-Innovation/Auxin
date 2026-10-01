import React, { useState, useEffect } from "react";
import "../../components/sales-and-leads/CreateEventModal.css"; // Reusing the same styles
import DatePickerModal from "../DatePickerModal";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import { updateEvent } from "../../services/AssignEventService";
import employeeService from "../../services/EmployeeService";
import Select from "react-select";

function EditAssignTaskModal({
  isOpen,
  onClose,
  employeeId,
  eventData,
  onEventUpdated,
}) {
  const [formData, setFormData] = useState({
    eventName: "",
    eventType: "",
    date: "",
    time: "",
    assignedTeamMembers: [],
    notes: "",
    link: "",
    color: "#FF9500",
    reminders: [1, 15, 60, 180, 1440], // Default reminders: 1m, 15m, 1h, 3h, 1d
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Load employees when component mounts
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await employeeService.getEmployees();
        // employeeService may return either an array or an object { employees: [...] }
        setEmployees(
          Array.isArray(data)
            ? data
            : data && Array.isArray(data.employees)
            ? data.employees
            : []
        );
      } catch (e) {
        console.error("Failed to load employees", e);
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

   // Populate form data when eventData changes
   // Populate form data when eventData changes - FIXED
  // Populate form data when eventData changes - FIXED
  useEffect(() => {
    if (eventData && isOpen) {
      console.log("=== INITIAL DATA POPULATION DEBUG ===");
      console.log("Raw eventData:", eventData);
      
      // Check ALL properties of eventData to find where assignedTeamMembers might be
      console.log("All eventData properties:", Object.keys(eventData));
      
      // Check if there are any properties that might contain the assigned team members
      for (let key in eventData) {
        if (key.toLowerCase().includes('team') || key.toLowerCase().includes('assign')) {
          console.log(`Found relevant property ${key}:`, eventData[key]);
        }
      }

      // Check nested objects
      if (eventData.meta) {
        console.log("meta properties:", Object.keys(eventData.meta));
        for (let key in eventData.meta) {
          if (key.toLowerCase().includes('team') || key.toLowerCase().includes('assign')) {
            console.log(`Found relevant meta property ${key}:`, eventData.meta[key]);
          }
        }
      }

      if (eventData.extendedProps) {
        console.log("extendedProps properties:", Object.keys(eventData.extendedProps));
        for (let key in eventData.extendedProps) {
          if (key.toLowerCase().includes('team') || key.toLowerCase().includes('assign')) {
            console.log(`Found relevant extendedProps property ${key}:`, eventData.extendedProps[key]);
          }
        }
      }

      // Your existing logic continues...
      const src = eventData.meta?.event || eventData.meta?.meeting || eventData.extendedProps || eventData;
      
      const dt = eventData.start || src?.date || eventData.date || null;
      let eventDate = null;
      try {
        eventDate = dt ? new Date(dt) : null;
      } catch (e) {
        eventDate = null;
      }
      const timeString = eventDate
        ? `${String(eventDate.getHours()).padStart(2, "0")}:${String(
            eventDate.getMinutes()
          ).padStart(2, "0")}`
        : src?.time || eventData.time || "09:00";
      const dateString = eventDate
        ? eventDate.toISOString().split("T")[0]
        : src?.date
        ? new Date(src.date).toISOString().split("T")[0]
        : eventData.date
        ? new Date(eventData.date).toISOString().split("T")[0]
        : "";

      // FIXED: Check all possible locations for assignedTeamMembers
      let assignedMembers = [];
      
      // Check direct properties first
      if (eventData.assignedTeamMembers && Array.isArray(eventData.assignedTeamMembers)) {
        assignedMembers = eventData.assignedTeamMembers;
      } 
      // Check in extendedProps (common in calendar events)
      else if (eventData.extendedProps?.assignedTeamMembers && Array.isArray(eventData.extendedProps.assignedTeamMembers)) {
        assignedMembers = eventData.extendedProps.assignedTeamMembers;
      }
      // Check in meta
      else if (eventData.meta?.assignedTeamMembers && Array.isArray(eventData.meta.assignedTeamMembers)) {
        assignedMembers = eventData.meta.assignedTeamMembers;
      }
      // Check in src
      else if (src?.assignedTeamMembers && Array.isArray(src.assignedTeamMembers)) {
        assignedMembers = src.assignedTeamMembers;
      }
      // Check single assignedTeamMember
      else if (eventData.assignedTeamMember) {
        assignedMembers = [eventData.assignedTeamMember];
      }
      else if (src?.assignedTeamMember) {
        assignedMembers = [src.assignedTeamMember];
      }

      // If still empty, try to fetch the actual event data from the database
      if (assignedMembers.length === 0) {
        console.log("No assignedTeamMembers found in eventData, trying to fetch from API...");
        // You might need to add a function to fetch the full event data by ID
        // const fullEventData = await getEventById(eventData.id);
        // if (fullEventData?.assignedTeamMembers) {
        //   assignedMembers = fullEventData.assignedTeamMembers;
        // }
      }

      // Normalize every id to string (handle objects with _id)
      assignedMembers = assignedMembers.filter(Boolean).map((item) => {
        if (typeof item === "string") return item;
        if (item && (item._id || item.id)) return String(item._id || item.id);
        return String(item);
      });

      console.log("Final assignedMembers:", assignedMembers);

      setFormData({
        eventName: eventData.title || src?.eventName || "",
        eventType: eventData.eventType || src?.eventType || "",
        date: dateString,
        time: timeString,
        assignedTeamMembers: assignedMembers,
        notes: eventData.notes || src?.notes || "",
        link: eventData.link || src?.link || "",
        color: eventData.color || src?.color || "#FF9500",
        reminders: src?.reminders || [1, 15, 60, 180, 1440], // Load existing reminders or default
      });
      console.log("=== END INITIAL DEBUG ===");
    }
  }, [eventData, isOpen]);

  
  // derive a Set of selected ids for stable comparisons
  const selectedIdsSet = new Set((formData.assignedTeamMembers || []).map(String));

  // Ensure any assignedTeamMembers IDs are present in the employees list.
  // Some event objects only include IDs; if the employee list didn't include those IDs
  // we try to fetch each missing employee so react-select can match options.
  useEffect(() => {
    const missing = (formData.assignedTeamMembers || []).filter(
      (id) => !employees.some((e) => String(e._id) === String(id))
    );
    if (!missing || missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const id of missing) {
        try {
          // employeeService.getEmployee may exist; if not, try getEmployees fallback (no-op)
          if (typeof employeeService.getEmployee === "function") {
            const emp = await employeeService.getEmployee(id);
            if (emp && !cancelled) {
              setEmployees((prev) => {
                if (!prev) return [emp];
                if (prev.some((p) => String(p._id) === String(emp._id))) return prev;
                return [...prev, emp];
              });
            }
          } else {
            // no per-id API available; skip and rely on server refresh elsewhere
            console.warn("employeeService.getEmployee not available, cannot fetch missing employee", id);
          }
        } catch (err) {
          console.warn("Failed to fetch employee for assignedTeamMembers:", id, err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [formData.assignedTeamMembers, employees.length]);

 
    // build employeeOptions once employees loaded - SIMPLIFIED
  const employeeOptions = employees.map((emp) => ({
    value: String(emp._id),
    label: emp.employeeName || emp.employeeId || String(emp._id),
  }));

  // Debug log to see the actual data
   // Comprehensive debug logging
  useEffect(() => {
    console.log("=== COMPREHENSIVE DEBUG ===");
    console.log("isOpen:", isOpen);
    console.log("eventData:", eventData);
    console.log("formData.assignedTeamMembers:", formData.assignedTeamMembers);
    console.log("Employees count:", employees.length);
    console.log("Employee IDs:", employees.map(e => String(e._id)));
    console.log("Employee options:", employeeOptions);
    
    if (formData.assignedTeamMembers.length > 0) {
      const filteredOptions = employeeOptions.filter(o => 
        formData.assignedTeamMembers.map(String).includes(String(o.value))
      );
      console.log("Filtered options result:", filteredOptions);
      
      // Check each assigned member
      formData.assignedTeamMembers.forEach(memberId => {
        const found = employees.find(e => String(e._id) === String(memberId));
        console.log(`Member ID ${memberId} found in employees:`, !!found, found ? found.employeeName : 'NOT FOUND');
      });
    }
    console.log("=== END DEBUG ===");
  }, [isOpen, eventData, formData.assignedTeamMembers, employees, employeeOptions]);

  // Remove all the complex selectedIdsSet and selectedEmployeeOptions logic

  
  if (!isOpen) return null;

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
    if (
      !formData.eventName ||
      !formData.eventType ||
      !formData.date ||
      !formData.time
    ) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const updatedEventData = {
        ...formData,
        employeeId,
        date: new Date(formData.date),
        time: formData.time,
        reminders: formData.reminders,
      };

      const updatedEvent = await updateEvent(
        employeeId,
        eventData.id,
        updatedEventData
      );
      console.log("Event updated:", updatedEvent);

      if (onEventUpdated) {
        onEventUpdated(updatedEvent);
      }

      onClose();
    } catch (error) {
      console.error("Error updating event:", error);
      alert("Failed to update event. Please try again.");
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
    // Format as local yyyy-mm-dd (no timezone shift)
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    const formattedLocal = `${y}-${m}-${d}`;
    handleInputChange("date", formattedLocal);
    setIsDatePickerOpen(false);
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    // Expect yyyy-mm-dd, render dd/mm/yyyy
    const [y, m, d] = dateString.split("-");
    if (!y || !m || !d) return dateString;
    return `${d}/${m}/${y}`;
  };

  const handleColorSelect = (color) => {
    handleInputChange("color", color);
  };

  return (
    <div className="create-event-modal-backdrop" onClick={handleBackdropClick}>
      <div className="create-event-modal">
        <div className="modal-event-content">
          <div className="modal-eventheader">
            <h2 className="modal-title">Edit Event</h2>
            <p className="modal-subtitle">
              Update your event details, labels and links.
            </p>
          </div>

          <div className="form-fields">
            <div className="input-field">
              <label className="field-label">Event Name *</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Eg. Employee Meeting"
                  value={formData.eventName}
                  onChange={(e) =>
                    handleInputChange("eventName", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Event Type *</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={formData.eventType}
                  onChange={(e) =>
                    handleInputChange("eventType", e.target.value)
                  }
                >
                  <option value="">Select type</option>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="presentation">Presentation</option>
                  <option value="workshop">Workshop</option>
                  <option value="other">Other</option>
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
              <label className="field-label">Select a Time *</label>
              <div className="time-wrapper">
                <input
                  type="time"
                  className="form-input has-icon"
                  value={formData.time}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                />
              </div>
            </div>
           


            <div className="input-field">
              <label className="field-label">Assign Team Members</label>
              <Select
                isMulti
                options={employeeOptions}
                value={employeeOptions.filter(o => 
                  (formData.assignedTeamMembers || []).map(String).includes(String(o.value))
                )}
                onChange={(selectedOptions) => {
                  const values = selectedOptions
                    ? selectedOptions.map((o) => String(o.value))
                    : [];
                  console.log("Selected team members changed:", values);
                  handleInputChange("assignedTeamMembers", values);
                }}
                placeholder="Select team members..."
                className="form-select"
                classNamePrefix="select"
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: "48px",
                    borderRadius: "4px",
                    borderColor: "#ccc",
                    boxShadow: "none",
                    padding: "2px 8px",
                  }),
                  multiValue: (provided) => ({
                    ...provided,
                    backgroundColor: "#e5e5e5",
                    color: "#333",
                  }),
                  multiValueLabel: (provided) => ({
                    ...provided,
                    color: "#333",
                  }),
                  placeholder: (provided) => ({
                    ...provided,
                    color: "#888",
                  }),
                }}
              />
            </div>

            

            <div className="input-field">
              <label className="field-label">Add notes</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  placeholder="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Attach Link</label>
              <div className="input-wrapper">
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://www.example.com"
                  value={formData.link}
                  onChange={(e) => handleInputChange("link", e.target.value)}
                />
              </div>
            </div>

            {/* <div className="color-selector">
              <label className="field-label">Event Color</label>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                {["#FF9500", "#007AFF", "#34C759", "#30B0C7"].map((color) => (
                  <div
                    key={color}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: color,
                      border:
                        formData.color === color
                          ? "2px solid #000"
                          : "2px solid transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => handleColorSelect(color)}
                  />
                ))}
              </div>
            </div> */}

            <div className="color-selector">
              <label className="field-label"></label>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                {["#FF9500", "#007AFF", "#34C759", "#30B0C7"].map((color) => (
                  <label
                    key={color}
                    style={{
                      display: "inline-block",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      border: `3px solid ${
                        formData.color === color ? "#000" : color
                      }`,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <input
                      type="radio"
                      name="eventColor"
                      value={color}
                      style={{ display: "none" }}
                      checked={formData.color === color} // pre-selects saved color
                      onChange={() => handleColorSelect(color)}
                    />
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor:
                          formData.color === color ? color : "transparent",
                        transition: "0.2s",
                      }}
                    />
                  </label>
                ))}
              </div>
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
            {isLoading ? "Updating..." : "Update Event"}
          </button>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={handleDatePickerClose}
        onSelectDate={handleDateSelect}
        selectedDate={formData.date ? new Date(formData.date) : null}
      />
    </div>
  );
}

export default EditAssignTaskModal;
