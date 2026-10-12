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
  allowAddOption = false,
  onAddOption,
  addOptionLabel = "Add new role",
  allowDeleteOption = false,
  onDeleteOption,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [isAddInputVisible, setIsAddInputVisible] = useState(false);
  const [newRoleDraft, setNewRoleDraft] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const addRoleInputRef = useRef(null);

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

  useEffect(() => {
    if (!isOpen) {
      setIsAddInputVisible(false);
      setNewRoleDraft("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isAddInputVisible && addRoleInputRef.current) {
      addRoleInputRef.current.focus();
    }
  }, [isOpen, isAddInputVisible]);

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

  const submitNewRole = async () => {
    const trimmed = newRoleDraft.trim();
    if (!trimmed) return;
    try {
      await Promise.resolve(onAddOption(trimmed));
      setIsOpen(false);
      setSearchTerm("");
      setIsAddInputVisible(false);
      setNewRoleDraft("");
    } catch {
      /* parent may reject on API error; keep menu open */
    }
  };

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

      {allowAddOption && typeof onAddOption === "function" && (
        isAddInputVisible ? (
          <div
            className={styles.addOptionInputBlock}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.addOptionInputRow}>
              <input
                ref={addRoleInputRef}
                type="text"
                className={styles.addOptionInput}
                placeholder="Type new role name..."
                value={newRoleDraft}
                onChange={(e) => setNewRoleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitNewRole();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setIsAddInputVisible(false);
                    setNewRoleDraft("");
                  }
                }}
              />
              <button
                type="button"
                className={styles.addOptionSubmit}
                onClick={(e) => {
                  e.stopPropagation();
                  void submitNewRole();
                }}
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <div
            className={styles.addOptionRow}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddInputVisible(true);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsAddInputVisible(true);
              }
            }}
          >
            <span className={styles.addOptionIcon} aria-hidden>
              +
            </span>
            <span>{addOptionLabel}</span>
          </div>
        )
      )}

      {/* Options List */}
      <div className={styles.optionsList}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) =>
            allowDeleteOption &&
            typeof onDeleteOption === "function" &&
            option.id ? (
              <div
                key={option.id || index}
                className={`${styles.optionRow} ${
                  option.value === value ? styles.optionRowSelected : ""
                }`}
              >
                <div
                  className={styles.optionMain}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
                <button
                  type="button"
                  className={styles.optionDeleteBtn}
                  aria-label="Delete role"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteOption(option.id);
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                key={option.id || `${option.value}-${index}`}
                className={`${styles.option} ${
                  option.value === value ? styles.optionSelected : ""
                }`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </div>
            )
          )
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