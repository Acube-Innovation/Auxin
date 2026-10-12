import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import clientService from "../../services/ClientService";
import { getApiBaseUrl } from "../../config/config";
import "./ImportCsvModal.css";

/** Normalize Excel/CSV header text so "Company Name" (NBSP) matches "company name" */
function normalizeHeaderKey(h) {
  return String(h ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Build row objects from matrix; header row is at headerRowIndex (0-based) */
function buildItemsFromMatrix(matrix, headerRowIndex) {
  if (
    !matrix ||
    matrix.length <= headerRowIndex + 1 ||
    !Array.isArray(matrix[headerRowIndex])
  ) {
    return [];
  }
  const headerRow = matrix[headerRowIndex].map((h) => normalizeHeaderKey(h));
  const items = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const rowArr = matrix[r] || [];
    const row = {};
    headerRow.forEach((h, i) => {
      if (!h) return;
      const cell = rowArr[i];
      row[h] =
        cell != null && cell !== "" ? String(cell).trim() : "";
    });
    const hasAny = Object.values(row).some((v) => v && String(v).trim());
    if (hasAny) items.push(row);
  }
  return items;
}

/** Find sheet + header row that contains Company Name and Email (handles NBSP, extra title rows) */
function findMatrixAndHeaderRow(wb) {
  const sheetOpts = {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  };
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const m = XLSX.utils.sheet_to_json(sheet, sheetOpts);
    if (!m || m.length < 2 || !Array.isArray(m[0])) continue;
    const maxScan = Math.min(30, m.length - 1);
    for (let hi = 0; hi < maxScan; hi++) {
      const row = m[hi];
      if (!Array.isArray(row)) continue;
      const cells = row.map((c) => normalizeHeaderKey(c)).filter(Boolean);
      if (cells.includes("company name") && cells.includes("email")) {
        return { matrix: m, headerRowIndex: hi, sheetName };
      }
    }
  }
  return null;
}

/** Plain-text CSV fallback when SheetJS yields too few rows (encoding / delimiter issues) */
function parseCsvTextFallback(text) {
  const parseLine = (line) => {
    const parts = line.match(/([^",]+|"[^"]*")+/g) || [];
    return parts.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  };
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map((h) => normalizeHeaderKey(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      row[h] = cols[idx] ?? "";
    });
    if (Object.values(row).some((v) => v && String(v).trim())) rows.push(row);
  }
  return rows;
}

/** Parse CSV / Excel (.xlsx, .xls) into row objects with lowercase header keys */
async function parseImportFile(file) {
  const name = (file.name || "").toLowerCase();
  const buf = await file.arrayBuffer();

  let wb = null;

  try {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  } catch (e) {
    if (name.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buf);
      const items = parseCsvTextFallback(text);
      if (items.length) return { items, error: null };
    }
    return {
      items: [],
      error:
        "Could not read this file. Try saving as .xlsx or export CSV (UTF-8) from Excel.",
    };
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return { items: [], error: "No sheets found in this file." };
  }

  const found = findMatrixAndHeaderRow(wb);
  if (!found) {
    if (name.endsWith(".csv")) {
      try {
        const text = new TextDecoder("utf-8").decode(buf);
        const items = parseCsvTextFallback(text);
        if (items.length) return { items, error: null };
      } catch (_) {
        /* ignore */
      }
    }
    return {
      items: [],
      error:
        "Could not find columns Company Name and Email. Use Download Template, or put those headers on one row (any sheet). Add at least one data row below.",
    };
  }

  const items = buildItemsFromMatrix(found.matrix, found.headerRowIndex);
  if (items.length === 0) {
    return {
      items: [],
      error:
        "Header row was found but all following rows are empty. Fill in at least one full row with Company Name and Email.",
    };
  }

  return { items, error: null };
}

/**
 * Find 2+ duplicate occurrences in file rows (email/phone/mobile).
 * Returns both duplicate row indices and row-level messages.
 */
function getFileDuplicateInfo(rows, mapRowToPayload) {
  const seenEmails = new Set();
  const seenPhones = new Set();
  const duplicateIndices = new Set();
  const duplicateErrors = [];
  rows.forEach((row, index) => {
    const payload = mapRowToPayload(row);
    const email = (payload.email || "").toLowerCase().trim();
    const phone = (payload.phone || "").trim();
    const mobile = (payload.mobile || "").trim();
    let duplicateReason = "";
    if (email) {
      if (seenEmails.has(email)) {
        duplicateIndices.add(index);
        duplicateReason = `Duplicate email "${email}" found in import file`;
      } else {
        seenEmails.add(email);
      }
    }
    const phoneToCheck = phone || mobile;
    if (phoneToCheck && !duplicateReason) {
      if (seenPhones.has(phoneToCheck)) {
        duplicateIndices.add(index);
        duplicateReason = `Duplicate phone number "${phoneToCheck}" found in import file`;
      } else {
        seenPhones.add(phoneToCheck);
      }
    }
    if (duplicateReason) {
      duplicateErrors.push({
        row: index + 2,
        reason: duplicateReason,
        rowData: payload,
      });
    }
  });
  return { duplicateIndices, duplicateErrors };
}

function ImportCsvModal({ isOpen, onClose, onComplete }) {
  const [fileName, setFileName] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successCount, setSuccessCount] = useState(0);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [pendingImportRows, setPendingImportRows] = useState(null);
  const [duplicatePreviewErrors, setDuplicatePreviewErrors] = useState([]);

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
    setDuplicatePreviewErrors([]);
    setIsReady(false);
    setPreviewRows([]);
    
    try {
      const { items, error } = await parseImportFile(file);
      if (error) {
        setErrors([error]);
        setRowCount(0);
        return;
      }

      const headers = Object.keys(items[0] || {});
      if (items.length === 0) {
        setErrors([
          "No data rows found. Use the Download Template and ensure the first row lists column names (Company Name, Email, …).",
        ]);
        setRowCount(0);
        return;
      }

      const missing = requiredColumns.filter(
        (req) => !headers.includes(req.toLowerCase())
      );
      if (missing.length > 0) {
        setErrors([
          `Missing required columns: ${missing.join(", ")}. First row must include: Company Name, Email.`,
        ]);
        setRowCount(0);
        return;
      }

      setRowCount(items.length);
      setPreviewRows(items.slice(0, 5));
      setIsReady(true);
      
    } catch (err) {
      console.error("Error in handleFile:", err);
      setErrors([err.message || "Failed to read file"]);
      setRowCount(0);
    }
  };

  const mapRowToPayload = (row) => ({
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
  });

  /**
   * @param {object[]} rows
   * @param {{ skipFileDuplicates: boolean, includeDuplicateWarnings?: boolean, forceImportDuplicates?: boolean }} options
   */
  const runImport = async (rows, options) => {
    const { skipFileDuplicates, includeDuplicateWarnings, forceImportDuplicates } = options;
    setIsImporting(true);
    setErrors([]);
    setSuccessCount(0);
    const successes = [];
    const { duplicateIndices: fileDupIndices, duplicateErrors } = getFileDuplicateInfo(
      rows,
      mapRowToPayload
    );
    const errs = includeDuplicateWarnings ? [...duplicateErrors] : [];

    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const payload = mapRowToPayload(row);

        if (skipFileDuplicates && fileDupIndices.has(i)) {
          errs.push({
            row: i + 2,
            reason: "Skipped: duplicate email or phone in import file",
            rowData: payload,
          });
          continue;
        }

        const importPayload = {
          ...payload,
          disableNotifications: true,
          isBulkImport: true,
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
          const msg =
            (err && err.message) ||
            (typeof err === "string" ? err : "") ||
            "Server error saving row";
          if (msg.includes("already exists") || msg.includes("duplicate")) {
            errs.push({
              row: i + 2,
              reason: msg || "Duplicate client found in database",
              rowData: importPayload,
            });

            // In approve mode, keep duplicate-related error visible but still store
            // the row so admin can edit it later from the table.
            if (forceImportDuplicates) {
              try {
                const forcedPayload = {
                  ...importPayload,
                  allowDuplicates: true,
                };
                const forcedSaved = await clientService.createClient(forcedPayload);
                successes.push(forcedSaved);
              } catch (forcedErr) {
                const forcedMsg =
                  (forcedErr && forcedErr.message) ||
                  (typeof forcedErr === "string" ? forcedErr : "") ||
                  "Failed to store duplicate row";
                errs.push({
                  row: i + 2,
                  reason: forcedMsg,
                  rowData: importPayload,
                });
              }
            }
          } else {
            errs.push({
              row: i + 2,
              reason: msg,
              rowData: importPayload,
            });
          }
        }
      }

      setSuccessCount(successes.length);
      setErrors(errs);
      if (onComplete) onComplete(successes, errs);
    } catch (err) {
      const msg =
        (err && err.message) ||
        (typeof err === "string" ? err : "") ||
        "Import failed";
      setErrors([{ row: null, reason: msg }]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile) {
      setErrors(["No file selected"]);
      return;
    }

    setErrors([]);
    setSuccessCount(0);

    try {
      const { items: rows, error: parseErr } = await parseImportFile(selectedFile);
      if (parseErr) {
        setErrors([{ row: null, reason: parseErr }]);
        return;
      }
      if (!rows.length) {
        setErrors([{ row: null, reason: "No data rows to import." }]);
        return;
      }

      const { duplicateErrors } = getFileDuplicateInfo(rows, mapRowToPayload);
      if (duplicateErrors.length > 0) {
        setDuplicatePreviewErrors(duplicateErrors);
        setPendingImportRows(rows);
        setShowDuplicateConfirm(true);
        return;
      }

      await runImport(rows, {
        skipFileDuplicates: false,
        includeDuplicateWarnings: false,
        forceImportDuplicates: false,
      });
    } catch (err) {
      const msg =
        (err && err.message) ||
        (typeof err === "string" ? err : "") ||
        "Import failed";
      setErrors([{ row: null, reason: msg }]);
    }
  };

  const handleDuplicateChoiceAllow = async () => {
    setShowDuplicateConfirm(false);
    const rows = pendingImportRows;
    setPendingImportRows(null);
    setDuplicatePreviewErrors([]);
    if (!rows || !rows.length) return;
    await runImport(rows, {
      skipFileDuplicates: false,
      includeDuplicateWarnings: true,
      forceImportDuplicates: true,
    });
  };

  const handleDuplicateChoiceReject = async () => {
    setShowDuplicateConfirm(false);
    const rows = pendingImportRows;
    setPendingImportRows(null);
    const dupErrors = duplicatePreviewErrors;
    setDuplicatePreviewErrors([]);
    if (!rows || !rows.length) return;
    const rejectErrors =
      dupErrors.length > 0
        ? dupErrors
        : [{ row: null, reason: "Import cancelled: duplicate values found in file." }];
    setSuccessCount(0);
    setErrors(rejectErrors);
    if (onComplete) onComplete([], rejectErrors);
  };

  const handleDuplicateConfirmCancel = () => {
    setShowDuplicateConfirm(false);
    setPendingImportRows(null);
    setDuplicatePreviewErrors([]);
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
    setShowDuplicateConfirm(false);
    setPendingImportRows(null);
    setDuplicatePreviewErrors([]);
    onClose && onClose();
  };

  const downloadTemplateOption = () => {
    const base = getApiBaseUrl();
    const fileUrl = `${base}/uploads/template/Auxin_CRM_Client_Import_Template.xlsx`;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = "Auxin_CRM_Client_Import_Template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    <>
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
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
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
              {fileName ? `${rowCount} rows found` : "CSV or Excel .xlsx / .xls (use Download Template for column names)"}
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
                        {err && typeof err === "object" && err.row
                          ? `Row ${err.row}: `
                          : ""}
                        {err && typeof err === "object"
                          ? String(err.reason || err.message || "").trim() ||
                            JSON.stringify(err)
                          : String(err)}
                        {err &&
                        typeof err === "object" &&
                        err.rowData &&
                        (err.rowData.companyName || err.rowData.email)
                          ? ` — ${err.rowData.companyName || ""} ${err.rowData.email || ""}`.trim()
                          : ""}
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
              onClick={handleStartImport}
              disabled={!isReady || isImporting}
              className="btn btn-primary"
            >
              {isImporting ? "Importing..." : "Start Import"}
            </button>
          </div>
        </div>

      </div>
    </div>

    {showDuplicateConfirm && (
      <div
        className="import-dup-confirm-backdrop"
        role="presentation"
        onClick={handleDuplicateConfirmCancel}
      >
        <div
          className="import-dup-confirm-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-dup-confirm-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 id="import-dup-confirm-title" className="import-dup-confirm-title">
            Duplicate values in file
          </h4>
          <p className="import-dup-confirm-text">
            This file contains the same email or phone on more than one row. How should
            the import run?
          </p>
          <ul className="import-dup-confirm-list">
            <li>
              <strong>Approve</strong> — import every row in order. The same email/phone
              may appear on multiple lines; later lines may be rejected by the server if
              the contact already exists.
            </li>
            <li>
              <strong>Reject</strong> — stop this import. No rows from this file will be
              imported.
            </li>
          </ul>
          {duplicatePreviewErrors.length > 0 && (
            <div className="error-list" style={{ maxHeight: 140, marginBottom: 16 }}>
              <ul>
                {duplicatePreviewErrors.slice(0, 20).map((err, idx) => (
                  <li key={`${err.row || "x"}-${idx}`}>
                    {err.row ? `Row ${err.row}: ` : ""}
                    {err.reason}
                    {err.rowData && (err.rowData.companyName || err.rowData.email)
                      ? ` — ${err.rowData.companyName || ""} ${err.rowData.email || ""}`.trim()
                      : ""}
                  </li>
                ))}
              </ul>
              {duplicatePreviewErrors.length > 20 && (
                <div className="import-modal-too-many">Showing first 20 duplicate errors...</div>
              )}
            </div>
          )}
          <div className="import-dup-confirm-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDuplicateConfirmCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-outline import-dup-btn-reject"
              onClick={handleDuplicateChoiceReject}
            >
              Reject duplicates
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDuplicateChoiceAllow}
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );

  return typeof document !== "undefined" ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}

export default ImportCsvModal;