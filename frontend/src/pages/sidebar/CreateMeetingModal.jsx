import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../../components/sales-and-leads/CreateEventModal.css";
import DatePickerModal from "../../components/DatePickerModal";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import MeetingService from "../../services/MeetingService";
import employeeService from "../../services/EmployeeService";
import clientService from "../../services/ClientService";
import Select from "react-select";
import { useToast } from "../../context/ToastContext";

/*
 Props:
  - isOpen
  - onClose
  - onEventCreated(createdMeeting)  // callback after successful create
  - initial (optional) for edit (not required now)
*/
function CreateMeetingModal({ isOpen, onClose, onEventCreated, initial = null }) {
  const { showToast } = useToast();
  const todayYMD = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    eventName: "",
    type: "",
    date: todayYMD,
    time: "09:00",
    assignedTeamMembers: [],
    notes: "",
    link: "",
    color: "#FF9500",
    clientId: "",
    reminders: [1, 15] // Default reminders: 1 min and 15 min
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const emps = await employeeService.getEmployees();
        setEmployees(Array.isArray(emps) ? emps : (emps.employees || []));
      } catch (e) {
        setEmployees([]);
      }
      try {
        const cls = await clientService.getClients();
        setClients(Array.isArray(cls) ? cls : (cls.clients || []));
      } catch (e) {
        setClients([]);
      }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (initial && isOpen) {
      // support multiple incoming shapes
      const src = initial.meta?.meeting || initial.meta?.event || initial;
      const parsedDate = src?.date ? new Date(src.date) : (initial.start ? new Date(initial.start) : null);
      const ymd = parsedDate ? parsedDate.toISOString().split("T")[0] : (initial.date ? (new Date(initial.date)).toISOString().split("T")[0] : todayYMD);
      let timeVal = "09:00";
      if (src?.time) {
        // normalize hh:mm[:ss] -> hh:mm
        timeVal = String(src.time).split(':').slice(0,2).map(p=>p.padStart(2,'0')).join(':');
      } else if (initial.start) {
        const st = new Date(initial.start);
        timeVal = `${String(st.getHours()).padStart(2,'0')}:${String(st.getMinutes()).padStart(2,'0')}`;
      } else if (initial.time) {
        timeVal = String(initial.time).split(':').slice(0,2).map(p=>p.padStart(2,'0')).join(':');
      }

      setFormData(f => ({
        ...f,
        eventName: src?.eventName || src?.title || initial.title || f.eventName,
        type: src?.eventType || src?.type || initial.type || f.type,
        date: ymd,
        time: timeVal,
        assignedTeamMembers: src?.assignedTeamMembers || initial.assignedTeamMembers || [],
        notes: src?.notes || initial.notes || f.notes,
        link: src?.link || initial.link || f.link,
        color: src?.color || initial.color || f.color,
        clientId: src?.clientId || initial.clientId || f.clientId,
        reminders: src?.reminders || initial.reminders || [1, 15]
      }));
      setError("");
    } else if (isOpen) {
      // reset for new create
      setFormData(f => ({ ...f, eventName: "", type: "", date: todayYMD, time: "09:00", assignedTeamMembers: [], notes: "", link: "", color: "#FF9500", clientId: "", reminders: [1, 15] }));
      setError("");
    }
  }, [initial, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleDateIconClick = () => setIsDatePickerOpen(true);
  const handleDatePickerClose = () => setIsDatePickerOpen(false);
  const handleDateSelect = (selectedDate) => {
    if (!selectedDate) return;
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    handleInputChange("date", `${y}-${m}-${d}`);
    setIsDatePickerOpen(false);
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    const [y, m, d] = dateString.split("-");
    if (!y || !m || !d) return dateString;
    return `${d}/${m}/${y}`;
  };

  const handleColorSelect = (color) => handleInputChange("color", color);

  const validate = () => {
    if (!formData.eventName || !formData.date || !formData.time) return "Event name, date and time are required";
    return null;
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) { 
      setError(v); 
      showToast(v, 'warning');
      return; 
    }
    setIsLoading(true);
    setError("");
    try {
      // build ISO date-time so backend parsing is deterministic
      const isoDate = formData.date && formData.time ? new Date(`${formData.date}T${formData.time}:00`).toISOString() : (formData.date || null);

      const payload = {
        title: formData.eventName,
        eventName: formData.eventName,
        type: formData.type || 'meeting',
        date: isoDate, // use ISO
        time: formData.time,
        clientId: formData.clientId || null,
        assignedTeamMembers: formData.assignedTeamMembers || [],
        notes: formData.notes,
        link: formData.link,
        color: formData.color,
        reminders: formData.reminders || []
      };

      const data = await MeetingService.createMeeting(payload);

      onEventCreated && onEventCreated(data);
      showToast("Meeting created successfully.", 'success');
      onClose && onClose();
    } catch (err) {
      console.error("CreateMeetingModal submit error:", err);
      const msg = err.message || "Failed to create event. Please try again.";
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clientOptions = clients.map(c => ({ value: c._id, label: c.companyName }));
  const employeeOptions = employees.map(e => ({ value: e._id, label: e.employeeName }));

  const modal = (
    <div className="create-event-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="create-event-modal" role="dialog" aria-modal="true">
        <div className="modal-event-content">
          <div className="modal-eventheader">
            <h2 className="modal-title">Create Event</h2>
            <p className="modal-subtitle">Select your event type, add labels and links.</p>
          </div>

          {error && <div style={{ color: '#b91c1c', background: '#fff1f0', padding: 8, borderRadius: 6 }}>{error}</div>}

          <div className="form-fields">
            <div className="input-field">
              <label className="field-label">Event Name *</label>
              <div className="input-wrapper">
                <input type="text" className="form-input" placeholder="Eg. Client Meeting" value={formData.eventName} onChange={(e) => handleInputChange("eventName", e.target.value)} />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Event Type</label>
              <div className="select-wrapper">
                <select className="form-select" value={formData.type} onChange={(e) => handleInputChange("type", e.target.value)}>
                  <option value="">Select type</option>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="presentation">Presentation</option>
                  <option value="workshop">Workshop</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Select a date *</label>
              <div className="date-wrapper">
                <input type="text" className="form-input has-icon" value={formatDateForDisplay(formData.date)} placeholder="DD/MM/YYYY" readOnly />
                <div className="input-icon" onClick={handleDateIconClick}>
                  <img src={calendarIcon} alt="Calendar" width="16" height="16" style={{ cursor: "pointer" }} />
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
                value={employeeOptions.filter(o => formData.assignedTeamMembers.map(String).includes(String(o.value)))}
                onChange={(selected) => handleInputChange('assignedTeamMembers', selected ? selected.map(s => s.value) : [])}
                placeholder="Select team members..."
                className="form-select"
                classNamePrefix="select"
              />
            </div>

            <div className="input-field">
              <label className="field-label">Add notes</label>
              <div className="input-wrapper">
                <input type="text" className="form-input" placeholder="notes" value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Attach Link</label>
              <div className="input-wrapper">
                <input type="url" className="form-input" placeholder="https://www.example.com" value={formData.link} onChange={(e) => handleInputChange("link", e.target.value)} />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Reminders</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[
                  { label: "1 min before", value: 1 },
                  { label: "15 min before", value: 15 },
                  { label: "30 min before", value: 30 },
                  { label: "1 hour before", value: 60 },
                  { label: "1 day before", value: 1440 }
                ].map((reminder) => (
                  <label key={reminder.value} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="checkbox"
                      checked={formData.reminders.includes(reminder.value)}
                      onChange={(e) => {
                        const newReminders = e.target.checked
                          ? [...formData.reminders, reminder.value]
                          : formData.reminders.filter(r => r !== reminder.value);
                        handleInputChange('reminders', newReminders);
                      }}
                    />
                    {reminder.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="color-selector">
              <div style={{ display: "flex", gap: "12px", marginTop: "8px", alignItems: "center" }}>
                {["#FF9500", "#007AFF", "#34C759", "#30B0C7"].map((color) => (
                  <label
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    role="radio"
                    aria-checked={formData.color === color}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: `2px solid ${formData.color === color ? "#000" : color}`,
                      cursor: "pointer",
                      padding: 2,
                      boxSizing: "border-box",
                    }}
                  >
                    {/* keep the native input for accessibility but don't remove it from layout using display:none */}
                    <input
                      type="radio"
                      name="eventColor"
                      value={color}
                      checked={formData.color === color}
                      onChange={() => handleColorSelect(color)}
                      style={{
                        position: "absolute",
                        opacity: 0,
                        width: "1px",
                        height: "1px",
                        overflow: "hidden",
                        clip: "rect(0 0 0 0)",
                        whiteSpace: "nowrap",
                      }}
                    />
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", backgroundColor: color }} />
                  </label>
                ))}
              </div>
            </div>

          </div>

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="event-cancel-button" onClick={() => onClose && onClose()} disabled={isLoading}>Cancel</button>
            <button className="event-attach-button" onClick={handleSubmit} disabled={isLoading}>{isLoading ? "Creating..." : "Add Event"}</button>
          </div>
        </div>

        <DatePickerModal isOpen={isDatePickerOpen} onClose={handleDatePickerClose} onSelectDate={handleDateSelect} selectedDate={formData.date ? new Date(formData.date) : null} />
      </div>
    </div>
  );

  return typeof document !== "undefined" ? ReactDOM.createPortal(modal, document.body) : null;
}

export default CreateMeetingModal;