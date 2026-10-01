import React, { useState, useEffect } from "react";
import AttendanceService from "../../services/AttendanceService";

function AttendanceUpdateModal({ isOpen, onClose, employee, onSaved }) {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("Onsite");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const t = new Date().toISOString().slice(0, 10);
      setDate(t);
      setStatus("Onsite");
      setNote("");
      setError("");
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      const record = await AttendanceService.setAttendance(employee._id, date, status, note);
      onSaved && onSaved(record);
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="delete-modal">
        <div className="modal-content">
          <div className="modal-text-section">
            <div className="modal-title">Update Attendance</div>
            <div className="modal-description">
              {employee?.employeeName || "Employee"}
            </div>
          </div>
        </div>
        {error && (
          <div className="modal-description" style={{ color: "#ED5E56", padding: "8px 16px" }}>{error}</div>
        )}
        <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <label>
            <div>Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <div>Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Onsite">Onsite</option>
              <option value="Leave">Leave</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <div>Note</div>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel-button" onClick={onClose} disabled={saving}>
            <div className="cancel-button-content">
              <span className="cancel-button-text">Cancel</span>
            </div>
          </button>
          <button className="modal-delete-button" onClick={save} disabled={saving}>
            <div className="delete-button-content">
              <span className="delete-button-text">Save</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttendanceUpdateModal;