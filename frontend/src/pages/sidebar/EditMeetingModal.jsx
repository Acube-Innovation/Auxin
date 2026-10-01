import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../../components/sales-and-leads/CreateEventModal.css";
import DatePickerModal from "../../components/DatePickerModal";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import MeetingService from "../../services/MeetingService";
import employeeService from "../../services/EmployeeService";
import clientService from "../../services/ClientService";
import Select from "react-select";

/*
 Props:
  - isOpen (bool)
  - onClose (fn)
  - meeting (object)  // meeting to edit (may be calendar event shape)
  - onEventUpdated (fn) // called after successful update
*/
function EditMeetingModal({ isOpen, onClose, meeting = null, onEventUpdated }) {
  const [formData, setFormData] = useState({
    title: "",
    type: "meeting",
    date: "",
    time: "09:00",
    clientId: "",
    assignedTeamMembers: [],
    notes: "",
    link: "",
    color: "#FF9500",
    reminders: [1, 15]
  });
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const emps = await employeeService.getEmployees();
        setEmployees(Array.isArray(emps) ? emps : (emps.employees || []));
      } catch (e) { setEmployees([]); }
      try {
        const cls = await clientService.getClients();
        setClients(Array.isArray(cls) ? cls : (cls.clients || []));
      } catch (e) { setClients([]); }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!meeting) {
      setFormData({
        title: "",
        type: "meeting",
        date: "",
        time: "09:00",
        clientId: "",
        assignedTeamMembers: [],
        notes: "",
        link: "",
        color: "#FF9500",
        reminders: [1, 15]
      });
      setError("");
      return;
    }

    // Map multiple shapes: calendar event (start Date), meeting.meta.meeting, or meeting.date/time
    const src = meeting.meta?.meeting || meeting.meta?.event || meeting;
    let dateObj = null;
    if (meeting.start) dateObj = (meeting.start instanceof Date) ? meeting.start : new Date(meeting.start);
    else if (src?.date) dateObj = (src.date instanceof Date) ? src.date : new Date(src.date);
    else if (meeting.date) dateObj = new Date(meeting.date);

    const ymd = dateObj ? dateObj.toISOString().split('T')[0] : (src?.date ? (new Date(src.date)).toISOString().split('T')[0] : "");
    // Determine time in HH:MM
    let timeVal = "09:00";
    if (src?.time) {
      const parts = String(src.time).split(':');
      timeVal = `${String(parts[0] || '09').padStart(2,'0')}:${String((parts[1] || '00')).padStart(2,'0')}`;
    } else if (meeting.time) {
      const parts = String(meeting.time).split(':');
      timeVal = `${String(parts[0] || '09').padStart(2,'0')}:${String((parts[1] || '00')).padStart(2,'0')}`;
    } else if (dateObj) {
      timeVal = `${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;
    }

    setFormData({
      title: src?.title || src?.eventName || meeting.title || "",
      type: src?.type || src?.eventType || meeting.type || "meeting",
      date: ymd,
      time: timeVal,
      clientId: src?.clientId || meeting.clientId || "",
      assignedTeamMembers: src?.assignedTeamMembers || meeting.assignedTeamMembers || [],
      notes: src?.notes || meeting.notes || "",
      link: src?.link || meeting.link || "",
      color: src?.color || meeting.color || "#FF9500",
      reminders: src?.reminders || meeting.reminders || [1, 15]
    });
    setError("");
  }, [meeting, isOpen]);

  if (!isOpen) return null;

  const handleChange = (k, v) => { setFormData(prev => ({ ...prev, [k]: v })); setError(""); };
  const handleDateSelect = (d) => {
    if (!d) return;
    const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
    handleChange('date', `${y}-${m}-${day}`);
    setIsDatePickerOpen(false);
  };

  const handleSubmit = async () => {
    if (!meeting || !(meeting._id || meeting.id || meeting.eventId)) { setError("Invalid meeting to update"); return; }
    if (!formData.title || !formData.date) { setError("Title and date required"); return; }
    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        type: formData.type,
        // send ISO date or date string backend accepts
        date: (formData.date && formData.time) ? new Date(`${formData.date}T${formData.time}:00`).toISOString() : formData.date,
        time: formData.time,
        clientId: formData.clientId || null,
        assignedTeamMembers: formData.assignedTeamMembers || [],
        notes: formData.notes,
        link: formData.link,
        color: formData.color,
        reminders: formData.reminders || []
      };
      const id = meeting._id || meeting.id || meeting.eventId;
      const updated = await MeetingService.updateMeeting(id, payload);
      onEventUpdated && onEventUpdated(updated);
      onClose && onClose();
    } catch (err) {
      console.error("EditMeetingModal error:", err);
      const msg = err?.message || (err?.response?.message) || "Failed to update meeting";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map(c => ({ value: c._id, label: c.companyName }));
  const employeeOptions = employees.map(e => ({ value: e._id, label: e.employeeName }));

  const modal = (
    <div className="create-event-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="create-event-modal" role="dialog" aria-modal="true">
        <div className="modal-event-content">
          <div className="modal-eventheader">
            <h2 className="modal-title">Edit Meeting</h2>
            <p className="modal-subtitle">Modify meeting details and save.</p>
          </div>

          {error && <div style={{ color: '#b91c1c', background: '#fff1f0', padding: 8, borderRadius: 6 }}>{error}</div>}

          <div className="form-fields">
            <div className="input-field">
              <label className="field-label">Event Name *</label>
              <div className="input-wrapper">
                <input type="text" className="form-input" value={formData.title} onChange={(e) => handleChange('title', e.target.value)} />
              </div>
            </div>

            {/* Event Type - was missing earlier */}
            <div className="input-field">
              <label className="field-label">Event Type</label>
              <div className="select-wrapper">
                <select className="form-select" value={formData.type} onChange={(e) => handleChange('type', e.target.value)}>
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
                <input type="text" className="form-input has-icon" value={formData.date ? formData.date.split('-').reverse().join('/') : ''} readOnly />
                <div className="input-icon" onClick={() => setIsDatePickerOpen(true)}>
                  <img src={calendarIcon} alt="Calendar" width="16" height="16" />
                </div>
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Select a Time</label>
              <div className="time-wrapper">
                <input type="time" className="form-input has-icon" value={formData.time} onChange={(e) => handleChange('time', e.target.value)} />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Assign Team Members</label>
              <Select isMulti options={employeeOptions}
                value={employeeOptions.filter(o => formData.assignedTeamMembers.map(String).includes(String(o.value)))}
                onChange={(sel) => handleChange('assignedTeamMembers', sel ? sel.map(s => s.value) : [])}
              />
            </div>

            <div className="input-field">
              <label className="field-label">Notes</label>
              <div className="input-wrapper">
                <input type="text" className="form-input" value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Link</label>
              <div className="input-wrapper">
                <input type="url" className="form-input" value={formData.link} onChange={(e) => handleChange('link', e.target.value)} />
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
                        handleChange('reminders', newReminders);
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
                    onClick={() => handleChange('color', color)}
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
                    <input
                      type="radio"
                      name="eventColor"
                      value={color}
                      checked={formData.color === color}
                      onChange={() => handleChange('color', color)}
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
            <button className="event-cancel-button" onClick={() => onClose && onClose()} disabled={saving}>Cancel</button>
            <button className="event-attach-button" onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </div>

        <DatePickerModal isOpen={isDatePickerOpen} onClose={() => setIsDatePickerOpen(false)} onSelectDate={handleDateSelect} selectedDate={formData.date ? new Date(formData.date) : null} />
      </div>
    </div>
  );

  return typeof document !== "undefined" ? ReactDOM.createPortal(modal, document.body) : null;
}

export default EditMeetingModal;
