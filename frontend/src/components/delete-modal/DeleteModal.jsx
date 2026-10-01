import React from "react";
import "./DeleteModal.css";
import warning from "../../assets/dashboard/alert-circle.svg";


function DeleteModal({ isOpen, onClose, onConfirm, title = "Delete this Client?", description = "Are you sure you want to delete this Client? This action cannot be undone." }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="delete-modal">
        <div className="modal-content">
          <img
            src={warning}
            alt="Warning icon"
            className="modal-icon"
          />
          <div className="modal-text-section">
            <div className="modal-title">
              {title}
            </div>
            <div className="modal-description">
              {description}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel-button" onClick={onClose}>
            <div className="cancel-button-content">
              <span className="cancel-button-text">Cancel</span>
            </div>
          </button>
          <button className="modal-delete-button" onClick={onConfirm}>
            <div className="delete-button-content">
              <span className="delete-button-text">Delete</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteModal;
