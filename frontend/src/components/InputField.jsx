import React from "react";
import "./InputField.css";

function InputField({
  label,
  placeholder,
  required = false,
  type = "text",
  value,
  onChange,
  isDropdown = false,
  options = [],
  hasError = false,
  disabled = false,
  name,
}) {
  return (
    <div className="input-field">
      <div className="input-label-container">
        <label className="input-label">
          {label} {required && <span style={{ color: "red", marginLeft: "4px" }}>*</span>}
        </label>
      </div>
      <div className={`input-container ${hasError ? "input-error" : ""}`}>
        {isDropdown ? (
          <div className="dropdown-field">
            <select
              className="dropdown-select"
              value={value}
              onChange={onChange}
              disabled={disabled}
              name={name}
            >
              <option value="">{placeholder}</option>
              {options.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="dropdown-icon">
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
        ) : (
          <input
            type={type}
            className="input-field-input"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            name={name}
          />
        )}
      </div>
    </div>
  );
}

export default InputField;
