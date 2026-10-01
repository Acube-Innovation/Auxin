import React, { useRef, useEffect } from "react";
import "./FilterDropdown.css";
import checkIcon from "../assets/dashboard/check_24px.svg";

const FilterDropdown = ({ isOpen, onClose, onFilterSelect, position }) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filterOptions = [
    {
      id: "company-name",
      label: "Company Name",
      hasIcon: true,
      isHighlighted: true,
      fontWeight: "bold"
    },
    {
      id: "assigned-to",
      label: "Assigned to",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    },
    {
      id: "categories",
      label: "Categories",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    },
    {
      id: "phone-number",
      label: "Phone Number",
      hasIcon: true,
      isHighlighted: true,
      fontWeight: "bold"
    },
    {
      id: "type",
      label: "Type",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    },
    {
      id: "added-on",
      label: "Added on",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    }
  ];

  const handleOptionClick = (option) => {
    if (onFilterSelect) {
      onFilterSelect(option);
    }
    onClose();
  };

  return (
    <div 
      className="filter-dropdown-container"
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: position?.top || 0,
        left: position?.left || 0,
        zIndex: 1000
      }}
    >
      <div className="filter-dropdown-list">
        {filterOptions.map((option, index) => (
          <React.Fragment key={option.id}>
            <div 
              className={`filter-list-item ${option.isHighlighted ? 'highlighted' : ''}`}
              onClick={() => handleOptionClick(option)}
            >
              <div className="filter-item-state-layer">
                <div className={`filter-item-background ${option.isHighlighted ? 'highlighted-bg' : 'normal-bg'}`} />
              </div>
              <div className="filter-item-content">
                <div className="filter-item-icon">
                  {option.hasIcon ? (
                    <img
                      src={checkIcon}
                      alt=""
                      className="filter-option-icon"
                    />
                  ) : (
                    <div className="filter-check-icon" />
                  )}
                </div>
                <div className="filter-item-text">
                  <div className={`filter-option-label ${option.fontWeight === 'bold' ? 'bold-text' : 'normal-text'}`}>
                    {option.label}
                  </div>
                </div>
              </div>
              {index < filterOptions.length - 1 && (
                <div className="filter-item-divider">
                  <div className={`filter-divider-line ${option.isHighlighted ? 'highlighted-divider' : 'normal-divider'}`} />
                </div>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default FilterDropdown;
