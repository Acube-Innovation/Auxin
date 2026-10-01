import React, { useState, useEffect } from "react";
import styles from "./Reports.module.css";
import Side from "./sidebar/Sidebar";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";



import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";
import clientService from "../services/ClientService";
import employeeService from "../services/EmployeeService";
import config from "../config/config";
import NotificationBell from "../components/NotificationBell";

function Reports() {
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [reportType, setReportType] = useState("");
  const [format, setFormat] = useState("");
  
  // Filters
  const [leadType, setLeadType] = useState("All");
  const [followupStatus, setFollowupStatus] = useState("All");
  const [employeeStatus, setEmployeeStatus] = useState("All");
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dropdown states
  const [isReportTypeDropdownOpen, setIsReportTypeDropdownOpen] = useState(false);
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [isLeadTypeDropdownOpen, setIsLeadTypeDropdownOpen] = useState(false);
  const [isFollowupStatusDropdownOpen, setIsFollowupStatusDropdownOpen] = useState(false);
  const [isEmployeeStatusDropdownOpen, setIsEmployeeStatusDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
  }, []);

  const reportTypes = ["Sales Report", "Employee Report"];
  const formats = ["Excel", "CSV"]; // Focused on Excel as requested

  // Options from AddClientModal
  const leadTypeOptions = ["All", "Lead", "Client"];
  const followupStatusOptions = [
    "All", "Completed", "Contacted", "Demo Scheduled", "Lost", 
    "Needs Analysis", "Pending", "Progress", "Proposal Sent", "Won"
  ];
  
  // Options from AddEmployeeModal
  const employeeStatusOptions = ["All", "Active", "InActive"];

  // Full options for Excel "Legend" or reference
  const clientDropdownOptions = {
    clientType: ["Agent", "Barge Operator", "Barge Owners", "Broker", "CHA", "Consignee", "Freigt Forwarder", "Other", "Ship Owners", "Shipper", "Transporter"],
    leadType: ["Client", "Lead"],
    leadSource: ["Advertisement", "Cold Call", "Conference", "Employee Referral", "Exhibitor", "Exhibition As Visitor", "External Referral", "SOCIAL MEDIA"],
    leadStatus: ["Attempted To Contact", "Contact In Future", "Contacted", "Junk Lead", "Lost Lead", "Negotiation", "New", "Qualified", "Quoted", "Won"],
    industryType: ["Bulk trading company", "Cement manufacturing companies", "Cryogenic tank manufacturers", "Dredging companies", "Drydocks", "Fiber pipe manufacturing company", "Freight forwarders", "Gypsum traders", "Heavy engineering", "Heavy transport companies in abroad", "Heavy transport companies in india", "Hydro power", "Industrial air filter companies", "Industrial boiler", "Industrial gases tank / cylinders", "Jack up rig owners", "Limestone traders", "Mining companies", "Navy", "Nuclear power", "Offshore companies", "Offshore windmill companies", "Oil and gas companies", "Pick up trucks", "Port infrastructure companies", "Railway wagon manufacturers", "Shipbuilding", "Shipyards", "Silica sand manufacturers", "Steel traders", "Straddle carrier manufacturer", "Thermal power", "Transformer manufacturers", "Windmill companies"],
    category: ["Breakbulk", "Bulk", "Project"],
    decisionMaker: ["No", "Yes"],
    relationshipStatus: ["Active", "Dormant", "Lost", "Prospect"],
    contractType: ["COA", "Long-term", "Spot", "Tender"],
    currentStatus: ["Contacted", "Lead", "Lost", "Negotiation", "Quoted", "Won"],
    followupStatus: ["Completed", "Contacted", "Demo Scheduled", "Lost", "Needs Analysis", "Pending", "Progress", "Proposal Sent", "Won"],
    incoterms: ["FOB", "CIF", "DAP"]
  };

  const employeeDropdownOptions = {
    attendance: ["Active", "InActive"],
    department: ["Operations", "Sales", "Marketing", "HR", "Finance", "IT", "Logistics", "Customer Service"],
    role: ["Operations Manager", "Sales Executive", "Logistics Coordinator", "Account Manager", "HR Manager", "Finance Analyst", "IT Specialist", "Customer Service Representative"]
  };

  const handleCancel = () => {
    setReportType("");
    setFormat("");
    setLeadType("All");
    setFollowupStatus("All");
    setEmployeeStatus("All");
    setStartDate("");
    setEndDate("");
    setError("");
  };

  const handleGenerateReport = async () => {
    if (!reportType) {
      alert("Please select a report type.");
      return;
    }
    if (!format) {
      alert("Please select a format.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (reportType === "Sales Report") {
        await generateSalesReport();
      } else if (reportType === "Employee Report") {
        await generateEmployeeReport();
      }
    } catch (err) {
      console.error("Report generation failed:", err);
      setError("Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateSalesReport = async () => {
    // Fetch all clients/leads
    let data = await clientService.getClients();
    let clients = Array.isArray(data) ? data : (data.clients || data.data || []);

    // Apply Filters
    if (leadType !== "All") {
      clients = clients.filter(c => c.leadType === leadType);
    }
    if (followupStatus !== "All") {
      clients = clients.filter(c => c.followupStatus === followupStatus);
    }
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      clients = clients.filter(c => {
        const date = new Date(c.createdAt); // Assuming filtering by creation date or followUpDate? Usually creation for general report
        return date >= start && date <= end;
      });
    }

    if (clients.length === 0) {
      alert("No data found for the selected filters.");
      return;
    }

    // Prepare Data for Excel
    // Include ALL columns from AddClientModal
    const exportData = clients.map(c => ({
      "Company Name": c.companyName || "",
      "Client Type": c.clientType || "",
      "Lead Type": c.leadType || "",
      "Address": c.address || "",
      "Country": c.country || "",
      "Tax ID": c.taxId || "",
      "Website": c.website || "",
      "Primary Contact": c.primaryContactName || "",
      "Designation": c.designation || "",
      "Phone": c.phone || "",
      "Mobile": c.mobile || "",
      "Email": c.email || "",
      "Social Links": c.socialLinks || "",
      "Industry Type": c.industryType || "",
      "Cargo Type": c.cargoType || "",
      "Decision Maker": c.decisionMaker || "",
      "Relationship Status": c.relationshipStatus || "",
      "Account Manager": c.accountManager || "",
      "Typical Cargoes": c.typicalCargoes || "",
      "Avg Shipment Size": c.averageShipmentSize || "",
      "Shipment Freq": c.shipmentFrequency || "",
      "Trading Routes": c.tradingRoutes || "",
      "Contract Type": c.contractType || "",
      "Historical Volume": c.historicalVolume || "",
      "Competitors": c.competitors || "",
      "Project Name": c.projectName || "",
      "Project Start": c.projectTimelineStart ? new Date(c.projectTimelineStart).toLocaleDateString() : "",
      "Project End": c.projectTimelineEnd ? new Date(c.projectTimelineEnd).toLocaleDateString() : "",
      "EPC Contractor": c.epcContractor || "",
      "Special Reqs": c.specialRequirements || "",
      "Risk Notes": c.riskNotes || "",
      "Lead Source": c.leadSource || "",
      "Current Status": c.currentStatus || "",
      "Opportunity Value": c.opportunityValue || "",
      "Follow-up Date": c.followUpDate ? new Date(c.followUpDate).toLocaleDateString() : "",
      "Notes": c.notes || "",
      "Follow-up Status": c.followupStatus || "",
      "Pref Load Ports": c.preferredLoadPorts || "",
      "Pref Discharge Ports": c.preferredDischargePorts || "",
      "Demurrage Terms": c.demurrageTerms || "",
      "Pref Agents": c.preferredAgents || "",
      "Incoterms": c.incoterms || "",
      "Category": c.category || "",
      "Created At": c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""
    }));

    exportToExcel(exportData, "Sales_Report", clientDropdownOptions);
  };

  const generateEmployeeReport = async () => {
    // Fetch all employees
    let data = await employeeService.getEmployees();
    let employees = Array.isArray(data) ? data : (data.employees || data.data || []);

    // Apply Filters
    if (employeeStatus !== "All") {
      employees = employees.filter(e => e.attendance === employeeStatus);
    }
    // Date filter for employees? Usually joining date (createdAt)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      employees = employees.filter(e => {
        const date = new Date(e.createdAt);
        return date >= start && date <= end;
      });
    }

    if (employees.length === 0) {
      alert("No data found for the selected filters.");
      return;
    }

    // Prepare Data for Excel
    const exportData = employees.map(e => ({
      "Employee ID": e.employeeId || "",
      "Name": e.employeeName || "",
      "Mobile": e.mobile || "",
      "Email": e.emailId || "",
      "Role": e.role || "",
      "Designation": e.designation || "",
      "Department": e.department || "",
      "Status": e.attendance || "",
      "Assigned Projects": Array.isArray(e.assignedProjects) ? e.assignedProjects.length : 0,
      "Created At": e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ""
    }));

    exportToExcel(exportData, "Employee_Report", employeeDropdownOptions);
  };

  const exportToExcel = (data, fileName, dropdownOptions) => {
    const wb = XLSX.utils.book_new();
    
    // 1. Main Data Sheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Map headers to dropdown options keys (kept for reference or future use, but comments removed)
    /* 
    const headerOptionMap = {
      "Client Type": "clientType",
      ...
    };
    */

    // Comments removed as per user request to prevent overlaying data
    // The AutoFilter below provides the interactive dropdowns instead.

    // Enable AutoFilter for the header row
    if (ws['!ref']) {
      ws['!autofilter'] = { ref: ws['!ref'] };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Report Data");

    // 2. Legend Sheet (to show dropdown options)
    if (dropdownOptions) {
      const legendRows = [];
      Object.keys(dropdownOptions).forEach(key => {
        legendRows.push({ "Field": key.toUpperCase(), "Options": "" }); // Header for section
        dropdownOptions[key].forEach(opt => {
          legendRows.push({ "Field": "", "Options": opt });
        });
        legendRows.push({ "Field": "", "Options": "" }); // Spacer
      });
      const wsLegend = XLSX.utils.json_to_sheet(legendRows);
      XLSX.utils.book_append_sheet(wb, wsLegend, "Dropdown Options");
    }

    // Generate file
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(dataBlob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Generate a Report</div>
            <div className={styles["dashboard-profile"]}>
              <NotificationBell />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>{userRole?.toUpperCase()}</div>
                  </div>
                </div>
                {/* <img src={chevrondown} alt="" /> */}
              </div>
            </div>
          </div>
        </header>

        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Reports</div>
          </div>
        </section>

        <section className={styles["main-content"]}>
          <div className={styles["report-container"]}>
            <div className={styles["report-header"]}>
              <div className={styles["report-title"]}>Generate Reports</div>
              <div className={styles["report-actions"]}>
                <button className={styles["cancel-button"]} onClick={handleCancel}>Cancel</button>
                <button className={styles["generate-button"]} onClick={handleGenerateReport} disabled={loading}>
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </div>

          <div className={styles["report-form"]}>
            <div className={styles["form-section"]}>
              
              {/* Report Type Selection */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Select Type of Report</div>
                <div className={styles["form-field"]}>
                  <div className={styles["dropdown-field"]} onClick={() => setIsReportTypeDropdownOpen(!isReportTypeDropdownOpen)}>
                    <span className={reportType ? styles["field-text"] : styles["field-placeholder"]}>
                      {reportType || "Select type"}
                    </span>
                    <svg className={styles["dropdown-icon"]} width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6L8 10L12 6" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {isReportTypeDropdownOpen && (
                      <div className={styles["dropdown-menu"]}>
                        {reportTypes.map((type) => (
                          <div key={type} className={styles["dropdown-item"]} onClick={() => {
                            setReportType(type);
                            setIsReportTypeDropdownOpen(false);
                            // Reset filters when type changes
                            setLeadType("All");
                            setFollowupStatus("All");
                            setEmployeeStatus("All");
                          }}>
                            {type}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles["divider-line"]}></div>

              {/* Conditional Filters for Sales Report */}
              {reportType === "Sales Report" && (
                <>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Lead Type</div>
                    <div className={styles["form-field"]}>
                      <div className={styles["dropdown-field"]} onClick={() => setIsLeadTypeDropdownOpen(!isLeadTypeDropdownOpen)}>
                        <span className={styles["field-text"]}>{leadType}</span>
                        <svg className={styles["dropdown-icon"]} width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 6L8 10L12 6" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {isLeadTypeDropdownOpen && (
                          <div className={styles["dropdown-menu"]}>
                            {leadTypeOptions.map((opt) => (
                              <div key={opt} className={styles["dropdown-item"]} onClick={() => {
                                setLeadType(opt);
                                setIsLeadTypeDropdownOpen(false);
                              }}>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles["divider-line"]}></div>

                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Follow-up Status</div>
                    <div className={styles["form-field"]}>
                      <div className={styles["dropdown-field"]} onClick={() => setIsFollowupStatusDropdownOpen(!isFollowupStatusDropdownOpen)}>
                        <span className={styles["field-text"]}>{followupStatus}</span>
                        <svg className={styles["dropdown-icon"]} width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 6L8 10L12 6" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {isFollowupStatusDropdownOpen && (
                          <div className={styles["dropdown-menu"]}>
                            {followupStatusOptions.map((opt) => (
                              <div key={opt} className={styles["dropdown-item"]} onClick={() => {
                                setFollowupStatus(opt);
                                setIsFollowupStatusDropdownOpen(false);
                              }}>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>
                </>
              )}

              {/* Conditional Filters for Employee Report */}
              {reportType === "Employee Report" && (
                <>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Status</div>
                    <div className={styles["form-field"]}>
                      <div className={styles["dropdown-field"]} onClick={() => setIsEmployeeStatusDropdownOpen(!isEmployeeStatusDropdownOpen)}>
                        <span className={styles["field-text"]}>{employeeStatus}</span>
                        <svg className={styles["dropdown-icon"]} width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 6L8 10L12 6" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {isEmployeeStatusDropdownOpen && (
                          <div className={styles["dropdown-menu"]}>
                            {employeeStatusOptions.map((opt) => (
                              <div key={opt} className={styles["dropdown-item"]} onClick={() => {
                                setEmployeeStatus(opt);
                                setIsEmployeeStatusDropdownOpen(false);
                              }}>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>
                </>
              )}

              {/* Date Range */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Choose a date range</div>
                <div className={styles["form-field"]} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    className={styles["date-field"]} 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                  />
                  <input 
                    className={styles["date-field"]} 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                  />
                </div>
              </div>

              <div className={styles["divider-line"]}></div>

              {/* Format Selection */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Select Format</div>
                <div className={styles["form-field"]}>
                  <div className={styles["dropdown-field"]} onClick={() => setIsFormatDropdownOpen(!isFormatDropdownOpen)}>
                    <span className={format ? styles["field-text"] : styles["field-placeholder"]}>
                      {format || "Select a format"}
                    </span>
                    <svg className={styles["dropdown-icon"]} width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6L8 10L12 6" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {isFormatDropdownOpen && (
                      <div className={styles["dropdown-menu"]}>
                        {formats.map((fmt) => (
                          <div key={fmt} className={styles["dropdown-item"]} onClick={() => {
                            setFormat(fmt);
                            setIsFormatDropdownOpen(false);
                          }}>
                            {fmt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {error && <div className={styles["error-message"]} style={{color: 'red', marginTop: '10px'}}>{error}</div>}

            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Reports;
