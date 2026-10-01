import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import clientService from "../../services/ClientService";
import "./ImportCsvModal.css";

function ImportCsvModal({ isOpen, onClose, onComplete }) {
  const [fileName, setFileName] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successCount, setSuccessCount] = useState(0);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  // Columns ordered by importance
  const requiredColumns = [
    "Company Name",
    "Email",
  ];

  const optionalColumns = [
    "Primary Contact Name", "Mobile", "Phone", "Designation",
    "Client Type", "Lead Type", "Relationship Status", "Current Status", "Follow-up Status", "Lead Source",
    "Address", "Country", "Industry Type", "Cargo Type", "Category",
    "Account Manager", "Decision Maker", "Contract Type", "Incoterms",
    "Typical Cargoes", "Average Shipment Size", "Shipment Frequency", "Trading Routes", "Historical Volume", "Competitors",
    "Project Name", "Project Timeline Start", "Project Timeline End", "EPC Contractor", "Special Requirements", "Risk Notes",
    "Opportunity Value", "Follow Up Date", "Notes", "Website", "Tax ID", "Social Links",
    "Preferred Load Ports", "Preferred Discharge Ports", "Demurrage Terms", "Preferred Agents"
  ];

  useEffect(() => {
    if (isOpen) {
      console.log("ImportCsvModal opened");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseCSVLine = (line) => {
    const parts = line.match(/([^",]+|"[^"]*")+/g) || [];
    return parts.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setSelectedFile(file);
    setErrors([]);
    setSuccessCount(0);
    setIsReady(false);
    setPreviewRows([]);
    
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

      if (lines.length < 2) {
        setErrors(["CSV must contain a header and at least one data row"]);
        return;
      }
      
      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

      // Validate required columns
      const missing = requiredColumns.filter(req => !headers.includes(req.toLowerCase()));
      
      if (missing.length > 0) {
        setErrors([`Missing required columns: ${missing.join(", ")}`]);
        return;
      }

      // Parse the data rows
      const items = lines.slice(1).map((line, index) => {
        const cols = parseCSVLine(line);
        const row = {};
        headers.forEach((h, i) => {
          row[h] = cols[i] ?? "";
        });
        return row;
      });
      
      setRowCount(items.length);
      setPreviewRows(items.slice(0, 5));
      setIsReady(true);
      
    } catch (err) {
      console.error("Error in handleFile:", err);
      setErrors([err.message || "Failed to read file"]);
    }
  };

  const mapRowToPayload = (row) => {
    return {
      companyName: row["company name"] || row["company"] || "",
      email: row["email"] || row["email id"] || "",
      primaryContactName: row["primary contact name"] || "",
      mobile: row["mobile"] || "",
      phone: row["phone"] || "",
      designation: row["designation"] || "",
      clientType: row["client type"] || "",
      leadType: row["lead type"] || "",
      relationshipStatus: row["relationship status"] || "",
      currentStatus: row["current status"] || "",
      followupStatus: row["follow-up status"] || row["followup status"] || "",
      leadSource: row["lead source"] || "",
      address: row["address"] || "",
      country: row["country"] || "",
      industryType: row["industry type"] || "",
      cargoType: row["cargo type"] || "",
      category: row["category"] || "",
      accountManager: row["account manager"] || "",
      decisionMaker: row["decision maker"] || "",
      contractType: row["contract type"] || "",
      incoterms: row["incoterms"] || "",
      typicalCargoes: row["typical cargoes"] || "",
      averageShipmentSize: row["average shipment size"] || "",
      shipmentFrequency: row["shipment frequency"] || "",
      tradingRoutes: row["trading routes"] || "",
      historicalVolume: row["historical volume"] || "",
      competitors: row["competitors"] || "",
      projectName: row["project name"] || "",
      projectTimelineStart: row["project timeline start"] || "",
      projectTimelineEnd: row["project timeline end"] || "",
      epcContractor: row["epc contractor"] || "",
      specialRequirements: row["special requirements"] || "",
      riskNotes: row["risk notes"] || "",
      opportunityValue: row["opportunity value"] ? parseFloat(row["opportunity value"]) : undefined,
      followUpDate: row["follow up date"] || "",
      notes: row["notes"] || "",
      website: row["website"] || "",
      taxId: row["tax id"] || row["gst"] || row["vat"] || "",
      socialLinks: row["social links"] || "",
      preferredLoadPorts: row["preferred load ports"] || "",
      preferredDischargePorts: row["preferred discharge ports"] || "",
      demurrageTerms: row["demurrage terms"] || "",
      preferredAgents: row["preferred agents"] || "",
    };
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setErrors(["No file selected"]);
      return;
    }
    
    setIsImporting(true);
    setErrors([]);
    setSuccessCount(0);
    const successes = [];
    const errs = [];

    try {
      const text = await selectedFile.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const cols = parseCSVLine(line);
        const row = {};
        headers.forEach((h, i) => {
          row[h] = cols[i] ?? "";
        });
        return row;
      });

      // Check for duplicates within the import file itself
      const seenEmails = new Set();
      const seenPhones = new Set();
      const fileDuplicateErrors = [];

      rows.forEach((row, index) => {
        const payload = mapRowToPayload(row);
        const email = payload.email?.toLowerCase().trim();
        const phone = payload.phone?.trim();
        const mobile = payload.mobile?.trim();
        
        let hasError = false;
        
        if (email) {
          if (seenEmails.has(email)) {
            fileDuplicateErrors.push({
              row: index + 2,
              reason: `Duplicate email "${email}" found in import file`,
              rowData: payload,
            });
            hasError = true;
          } else {
            seenEmails.add(email);
          }
        }

        const phoneToCheck = phone || mobile;
        if (phoneToCheck && !hasError) {
          if (seenPhones.has(phoneToCheck)) {
            fileDuplicateErrors.push({
              row: index + 2,
              reason: `Duplicate phone number "${phoneToCheck}" found in import file`,
              rowData: payload,
            });
            hasError = true;
          } else {
            seenPhones.add(phoneToCheck);
          }
        }
      });

      if (fileDuplicateErrors.length > 0) {
        errs.push(...fileDuplicateErrors);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const payload = mapRowToPayload(row);
        
        const hasFileDuplicate = fileDuplicateErrors.some(error => error.row === i + 2);
        if (hasFileDuplicate) continue;
        
        const importPayload = {
          ...payload,
          disableNotifications: true,
          isBulkImport: true
        };
        
        if (!importPayload.companyName || !importPayload.email) {
          errs.push({
            row: i + 2,
            reason: "Missing required company name or email",
            rowData: importPayload,
          });
          continue;
        }
        
        try {
          const saved = await clientService.createClient(importPayload);
          successes.push(saved);
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            errs.push({
              row: i + 2,
              reason: err.message || "Duplicate client found in database",
              rowData: importPayload,
            });
          } else {
            errs.push({
              row: i + 2,
              reason: err?.message || "Server error saving row",
              rowData: importPayload,
            });
          }
        }
      }

      setSuccessCount(successes.length);
      setErrors(errs);
      if (onComplete) onComplete(successes, errs);
      
    } catch (err) {
      setErrors([{ row: null, reason: err.message || "Import failed" }]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFileName("");
    setRowCount(0);
    setIsReady(false);
    setIsImporting(false);
    setErrors([]);
    setSuccessCount(0);
    setPreviewRows([]);
    setSelectedFile(null);
    onClose && onClose();
  };

  const downloadTemplateOption = () => {
  const fileUrl = `${process.env.REACT_APP_API_URL}/uploads/template/Auxin_CRM_Client_Import_Template.xlsx`;
  window.open(fileUrl, "_blank");
};

  const downloadTemplate = () => {
    const headers = [...requiredColumns, ...optionalColumns];
    const exampleRow = headers.map(header => {
      switch(header.toLowerCase()) {
        case 'company name': return 'ABC Global Shipping';
        case 'email': return 'contact@abcshipping.com';
        case 'primary contact name': return 'John Smith';
        case 'mobile': return '+1-555-0101';
        case 'phone': return '+1-555-0100';
        case 'designation': return 'Operations Manager';
        case 'client type': return 'Shipper';
        case 'lead type': return 'Client';
        case 'relationship status': return 'Active';
        case 'current status': return 'Quoted';
        case 'follow-up status': return 'Pending';
        case 'lead source': return 'Referral';
        case 'address': return '123 Business Ave, City';
        case 'country': return 'United States';
        case 'industry type': return 'Logistics';
        case 'cargo type': return 'Containerized';
        case 'category': return 'Premium';
        case 'account manager': return 'Sarah Johnson';
        case 'decision maker': return 'Yes';
        case 'contract type': return 'Long-term';
        case 'incoterms': return 'FOB';
        case 'opportunity value': return '75000';
        case 'website': return 'https://abcshipping.com';
        case 'tax id': return 'GST123456789';
        default: return '';
      }
    });
    
    const csv = [
      headers.map(h => `"${h}"`).join(","),
      exampleRow.map(val => `"${val}"`).join(",")
    ].join("\n");
    
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const modalContent = (
    <div className="import-modal-backdrop" aria-hidden={!isOpen}>
      <div className="import-modal-container" role="dialog" aria-modal="true">
        
        {/* Header */}
        <div className="import-modal-header">
          <h3>Import Clients / Leads</h3>
          <button onClick={handleClose} className="import-modal-close" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="import-modal-content">
          
          {/* Column Guidance */}
          <div className="column-guidance">
            <div className="guidance-section">
              <div className="guidance-title">Required Columns</div>
              <div className="guidance-tags">
                {requiredColumns.map(c => (
                  <span key={c} className="tag required">{c}</span>
                ))}
              </div>
            </div>
            <div className="guidance-section">
              <div className="guidance-title">Optional Columns</div>
              <div className="guidance-tags">
                {optionalColumns.map(c => (
                  <span key={c} className="tag optional">{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* File Upload Zone */}
          <label className={`file-upload-zone ${fileName ? 'has-file' : ''}`}>
            <input 
              type="file" 
              accept=".csv,text/csv" 
              onChange={handleFile} 
              className="file-input-hidden"
            />
            <svg className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="upload-text">
              {fileName ? `Selected: ${fileName}` : "Click to upload or drag and drop"}
            </div>
            <div className="upload-subtext">
              {fileName ? `${rowCount} rows found` : "CSV files only (max 5MB)"}
            </div>
          </label>

          {/* Preview Table */}
          {previewRows.length > 0 && (
            <div className="preview-section">
              <div className="preview-header">
                Preview (First {previewRows.length} rows)
              </div>
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {Object.keys(previewRows[0]).slice(0,6).map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => (
                      <tr key={idx}>
                        {Object.keys(r).slice(0,6).map((k) => <td key={k}>{r[k]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Summary */}
          {(errors.length > 0 || successCount > 0) && (
            <div className="error-summary">
              <div style={{fontWeight: 600, color: errors.length > 0 ? '#991b1b' : '#065f46'}}>
                Import Status: {successCount} imported, {errors.length} errors
              </div>
              {errors.length > 0 && (
                <div className="error-list">
                  <ul>
                    {errors.slice(0, 50).map((err, i) => (
                      <li key={i}>
                        {err.row ? `Row ${err.row}: ` : ""}{err.reason} {err.rowData ? ` — ${err.rowData.companyName || err.rowData.email || ''}` : ''}
                      </li>
                    ))}
                  </ul>
                  {errors.length > 50 && <div className="import-modal-too-many">Showing first 50 errors...</div>}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="import-modal-footer">
          {/* <button 
            type="button" 
            onClick={downloadTemplate} 
            className="btn btn-outline"
          >
            Download Template
          </button> */}

          <button 
              type="button" 
              onClick={downloadTemplateOption} 
              className="btn btn-outline"
              style={{ borderColor: '#10b981', color: '#059669' }}
            >
              Download Template
          </button>

          <div className="action-buttons">
            <button 
              type="button" 
              onClick={handleClose} 
              className="btn btn-secondary"
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!isReady || isImporting}
              className="btn btn-primary"
            >
              {isImporting ? "Importing..." : "Start Import"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== "undefined" ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}

export default ImportCsvModal;