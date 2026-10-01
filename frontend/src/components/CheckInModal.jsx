import React, { useState, useEffect } from 'react';
import clientService from '../services/ClientService';
import employeeService from '../services/EmployeeService';
import checkInService from '../services/CheckInService';
import Select from 'react-select';

function CheckInModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    clientId: '',
    eventType: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    location: '',
    latitude: null,
    longitude: null,
    teamMembers: [],
    notes: '',
    imageProof: null
  });

  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eventTypes = [
    { value: 'client_meeting', label: 'Client Meeting' },
    { value: 'site_visit', label: 'Site Visit' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (isOpen) {
      loadClients();
      loadEmployees();
      getCurrentLocation();
    }
  }, [isOpen]);

  const loadClients = async () => {
    try {
      const response = await clientService.getClients();
      setClients(response.clients || response || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await employeeService.getEmployees();
      setEmployees(response.employees || response || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Format coordinates like in the design: 10°02'09.4"N 76°25'21.4"E
          // Use \u00B0 for degree symbol to avoid encoding issues
          const latDeg = Math.floor(Math.abs(latitude));
          const latMin = Math.floor((Math.abs(latitude) - latDeg) * 60);
          const latSec = ((Math.abs(latitude) - latDeg - latMin/60) * 3600).toFixed(1);
          const latDir = latitude >= 0 ? 'N' : 'S';
          
          const lngDeg = Math.floor(Math.abs(longitude));
          const lngMin = Math.floor((Math.abs(longitude) - lngDeg) * 60);
          const lngSec = ((Math.abs(longitude) - lngDeg - lngMin/60) * 3600).toFixed(1);
          const lngDir = longitude >= 0 ? 'E' : 'W';
          
          const formattedLocation = `${latDeg}\u00B0${latMin.toString().padStart(2, '0')}'${latSec}"${latDir} ${lngDeg}\u00B0${lngMin.toString().padStart(2, '0')}'${lngSec}"${lngDir}`;
          
          setFormData(prev => ({
            ...prev,
            latitude,
            longitude,
            location: formattedLocation
          }));
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('Unable to get your location. Please enable GPS permissions.');
          setIsLoadingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      setIsLoadingLocation(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB');
        return;
      }
      setFormData(prev => ({
        ...prev,
        imageProof: file
      }));
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    const [y, m, d] = dateString.split("-");
    if (!y || !m || !d) return dateString;
    return `${d}/${m}/${y}`;
  };

  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return "";
    const [hours, minutes] = timeString.split(':');
    const hour12 = ((parseInt(hours) % 12) || 12);
    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.clientId) {
      setError('Please select a client/lead');
      return;
    }
    if (!formData.eventType) {
      setError('Please select an event type');
      return;
    }
    if (!formData.date) {
      setError('Please select a date');
      return;
    }
    if (!formData.time) {
      setError('Please select a time');
      return;
    }
    if (!formData.location) {
      setError('Please add your location');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const checkInData = {
        ...formData,
        timestamp: new Date(`${formData.date}T${formData.time}`)
      };

      const result = await checkInService.createCheckIn(checkInData, formData.imageProof);
      
      if (onSubmit) {
        onSubmit(result);
      }
      
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating check-in:', error);
      setError(error.message || 'Failed to log check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      eventType: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      location: '',
      latitude: null,
      longitude: null,
      teamMembers: [],
      notes: '',
      imageProof: null
    });
    setError('');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
      resetForm();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-event-modal-backdrop" onClick={handleBackdropClick}>
      <div className="create-event-modal">
        <div className="modal-event-content">
          <div className="modal-event-header">
            <h2 className="modal-title">Check In</h2>
            <p className="modal-subtitle">
              Please make sure to allow GPS permissions for your browser.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '8px',
              fontSize: '14px',
              marginBottom: '16px',
              border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}

          <div className="form-fields">
            {/* Client/Lead Dropdown */}
            <div className="input-field">
              <label className="field-label">Client/Lead Name *</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={formData.clientId}
                  onChange={(e) => handleInputChange('clientId', e.target.value)}
                >
                  <option value="">Select Client/Lead</option>
                  {clients.map(client => (
                    <option key={client._id} value={client._id}>
                      {client.companyName}
                    </option>
                  ))}
                </select>
                <div className="select-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="#717680" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Event Type Dropdown */}
            <div className="input-field">
              <label className="field-label">Event Type *</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={formData.eventType}
                  onChange={(e) => handleInputChange('eventType', e.target.value)}
                >
                  <option value="">Select type</option>
                  {eventTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <div className="select-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="#717680" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Date Field */}
            <div className="input-field">
              <label className="field-label">Select a Date *</label>
              <div className="date-wrapper">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  color: 'rgba(183, 183, 183, 1)',
                  fontSize: '16px'
                }}>
                  <span>{formatDateForDisplay(formData.date) || '10/07/2025'}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12.67 2H11.33V1.33C11.33 1.15 11.18 1 11 1S10.67 1.15 10.67 1.33V2H5.33V1.33C5.33 1.15 5.18 1 5 1S4.67 1.15 4.67 1.33V2H3.33C2.6 2 2 2.6 2 3.33V12.67C2 13.4 2.6 14 3.33 14H12.67C13.4 14 14 13.4 14 12.67V3.33C14 2.6 13.4 2 12.67 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            {/* Time Field */}
            <div className="input-field">
              <label className="field-label">Select a Time *</label>
              <div className="time-wrapper">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  color: 'rgba(183, 183, 183, 1)',
                  fontSize: '16px'
                }}>
                  <span>{formatTimeForDisplay(formData.time) || '11:23 AM'}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 4V8L10.5 10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleInputChange('time', e.target.value)}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            {/* Location Field */}
            <div className="input-field">
              <label className="field-label">Add your location *</label>
              <div className="input-wrapper">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%'
                }}>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder={isLoadingLocation ? "Getting location..." : "Enter location"}
                    disabled={isLoadingLocation}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: '16px',
                      width: '100%',
                      color: '#000',
                      backgroundColor: 'transparent'
                    }}
                  />
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isLoadingLocation}
                    title="Refresh Location"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      marginLeft: '8px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1V3M8 13V15M3 8H1M15 8H13M4.22 4.22L2.81 2.81M13.19 2.81L11.78 4.22M4.22 11.78L2.81 13.19M13.19 13.19L11.78 11.78" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Team Member Field */}
            <div className="input-field">
              <label className="field-label">Add a Team Member</label>
              <Select
                isMulti
                options={employees.map((emp) => ({
                  value: emp._id,
                  label: `${emp.employeeName}` || emp.employeeName
                }))}
                value={employees
                  .filter((emp) => formData.teamMembers.includes(emp._id))
                  .map((emp) => ({ 
                    value: emp._id, 
                    label: `${emp.employeeName}` || emp.employeeName
                  }))}
                onChange={(selectedOptions) => {
                  const values = selectedOptions ? selectedOptions.map((o) => o.value) : [];
                  handleInputChange("teamMembers", values);
                }}
                placeholder={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M16.67 17.5V15.83C16.67 14.95 16.32 14.1 15.71 13.49C15.1 12.88 14.25 12.53 13.37 12.53H6.67C5.79 12.53 4.94 12.88 4.33 13.49C3.72 14.1 3.37 14.95 3.37 15.83V17.5M13.37 6.17C13.37 8.01 11.84 9.54 10 9.54C8.16 9.54 6.63 8.01 6.63 6.17C6.63 4.33 8.16 2.8 10 2.8C11.84 2.8 13.37 4.33 13.37 6.17Z" stroke="#717680" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Select team member</span>
                  </div>
                }
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: '48px',
                    borderRadius: '8px',
                    borderColor: '#D5D7DA',
                    boxShadow: '0 1px 2px 0 rgba(10, 13, 18, 0.05)',
                    fontSize: '16px',
                    padding: '2px 6px',
                    backgroundColor: '#FFF',
                    // maxWidth: '450px'
                  }),
                  placeholder: (provided) => ({
                    ...provided,
                    color: '#717680',
                    display: 'flex',
                    alignItems: 'center'
                  }),
                  multiValue: (provided) => ({
                    ...provided,
                    backgroundColor: '#e5e7eb',
                    borderRadius: '6px'
                  }),
                  multiValueLabel: (provided) => ({
                    ...provided,
                    color: '#374151',
                    fontSize: '14px'
                  }),
                  dropdownIndicator: (provided) => ({
                    ...provided,
                    color: '#717680'
                  })
                }}
              />
            </div>

            {/* Notes Field */}
            <div className="input-field">
              <label className="field-label">Add notes</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Eg. Client Meeting"
                  style={{
                    color: formData.notes ? '#000' : '#717680',
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>

            {/* File Upload */}
            <div style={{
              borderRadius: '8px',
              border: '1px solid #E9EAEB',
              backgroundColor: '#FFF',
              padding: '16px 24px',
              // marginTop: '16px',
              width: '100%',
              maxWidth: '450px'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M35 25V31.67C35 32.55 34.65 33.4 34.04 34.01C33.43 34.62 32.58 34.97 31.7 34.97H8.3C7.42 34.97 6.57 34.62 5.96 34.01C5.35 33.4 5 32.55 5 31.67V25M28.33 13.33L20 5L11.67 13.33M20 5V25" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                
                <div style={{ textAlign: 'center' }}>
                  <label 
                    htmlFor="imageUpload" 
                    style={{
                      color: '#007AFF',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textDecoration: 'none',
                     
                    }}
                  >
                    Upload an image proof
                  </label>
                  <input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  
                  <p style={{
                    color: '#535862',
                    fontSize: '12px',
                    margin: '4px 0 0 0',
                    fontWeight: '400'
                  }}>
                    Upload supports all images (max. 10mb)
                  </p>
                  
                  {formData.imageProof && (
                    <p style={{
                      color: '#007AFF',
                      fontSize: '12px',
                      margin: '8px 0 0 0',
                      fontWeight: '500'
                    }}>
                      Selected: {formData.imageProof.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button 
            className="event-cancel-button" 
            onClick={() => { onClose(); resetForm(); }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="event-attach-button" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Check In'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckInModal;
