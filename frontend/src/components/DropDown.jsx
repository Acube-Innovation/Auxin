import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./Dropdown.module.css";

function Dropdown({
  label,
  placeholder = "Select option",
  required = false,
  value,
  onChange,
  options = [],
  hasError = false,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Check if the click is inside the portal menu
        const menu = document.getElementById(`dropdown-menu-${label || "default"}`);
        if (menu && menu.contains(event.target)) {
          return;
        }
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [label]);

  // Update position when opening
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const updatePosition = () => {
        const rect = dropdownRef.current.getBoundingClientRect();
        // Find the container element (the one with the border) to align with
        const container = dropdownRef.current.querySelector(`.${styles.container}`);
        if (container) {
            const containerRect = container.getBoundingClientRect();
            setCoords({
                top: containerRect.bottom + window.scrollY + 4, // 4px gap
                left: containerRect.left + window.scrollX,
                width: containerRect.width,
            });
        }
      };

      updatePosition();
      
      // Close on scroll or resize to avoid detachment
      const handleScrollOrResize = (e) => {
          // If scrolling inside the menu, don't close
          const menu = document.getElementById(`dropdown-menu-${label || "default"}`);
          if (e.type === 'scroll' && menu && (e.target === menu || menu.contains(e.target))) {
            return;
          }
          setIsOpen(false);
      };

      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);

      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen, label]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
    setSearchTerm("");
  };

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const dropdownMenu = (
    <div
      id={`dropdown-menu-${label || "default"}`}
      className={styles.menu}
      style={{
        position: "fixed",
        top: coords.top - window.scrollY, // Adjust for fixed positioning
        left: coords.left - window.scrollX,
        width: coords.width,
        zIndex: 9999, // Ensure it's on top
      }}
    >
      {/* Search Input */}
      <div className={styles.searchContainer}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Options List */}
      <div className={styles.optionsList}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => (
            <div
              key={index}
              className={`${styles.option} ${
                option.value === value ? styles.optionSelected : ""
              }`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </div>
          ))
        ) : (
          <div className={styles.noResults}>
            No options found
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.dropdownComponent} ref={dropdownRef}>
      {/* Label */}
      {label && (
        <div className={styles.labelContainer}>
          <label className={styles.label}>
            {label}
            {required && <span style={{ color: "red", marginLeft: "4px" }}>*</span>}
          </label>
        </div>
      )}

      {/* Dropdown Container */}
      <div
        className={`${styles.container} 
          ${isOpen ? styles.containerOpen : ""} 
          ${hasError ? styles.containerError : ""} 
          ${disabled ? styles.containerDisabled : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div
          className={`${styles.text} ${
            !selectedOption ? styles.placeholder : ""
          }`}
        >
          {displayText}
        </div>

        <div
          className={`${styles.arrow} ${isOpen ? styles.arrowUp : ""}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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

      {/* Dropdown Menu Portal */}
      {isOpen && createPortal(dropdownMenu, document.body)}
    </div>
  );
}

export default Dropdown;