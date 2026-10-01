import React, { useEffect, useRef } from "react";
import "./DropDownList.css";

function DropDownList({ isOpen, onClose, onOptionSelect, position = { top: 0, left: 0 } }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOptionClick = (option) => {
    onOptionSelect(option);
    onClose();
  };

  return (
    <div 
      className="dropdown-container"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000
      }}
      ref={dropdownRef}
    >
      <div className="dropdown-list">
        <div 
          className="dropdown-item"
          onClick={() => handleOptionClick('pdf')}
        >
          <div className="dropdown-item-content">
            <div className="dropdown-item-text">
              Export as PDF
            </div>
          </div>
        </div>
        
        <div 
          className="dropdown-item"
          onClick={() => handleOptionClick('csv')}
        >
          <div className="dropdown-item-content">
            <div className="dropdown-item-text">
              Export as CSV
            </div>
          </div>
        </div>
        
        <div 
          className="dropdown-item"
          onClick={() => handleOptionClick('txt')}
        >
          <div className="dropdown-item-content">
            <div className="dropdown-item-text">
              Export as TXT
            </div>
          </div>
        </div>
        
        <div 
          className="dropdown-item"
          onClick={() => handleOptionClick('print')}
        >
          <div className="dropdown-item-content">
            <div className="dropdown-item-text">
              Print Document
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DropDownList;
