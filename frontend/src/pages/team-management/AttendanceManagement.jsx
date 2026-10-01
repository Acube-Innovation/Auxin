import React, { useEffect, useState } from "react";
import styles from "./AttendanceManagement.module.css";
import Side from "../sidebar/Sidebar";
import chevrondright from "../../assets/dashboard/chevron-right.svg";
import EmployeeService from "../../services/EmployeeService";
import AttendanceService from "../../services/AttendanceService";
import AttendanceUpdateModal from "../../components/team-management-components/AttendanceUpdateModal";

function AttendanceManagement() {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState("");

  const [updatingId, setUpdatingId] = useState(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Default report to today's date
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportData, setReportData] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [summaryType, setSummaryType] = useState("Monthly");
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryData, setSummaryData] = useState([]);

  // Pagination State
  const [empPage, setEmpPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      setEmployeeError("");
      try {
        const data = await EmployeeService.getEmployees();
        setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        setEmployeeError(err?.message || "Failed to load employees");
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
  }, []);

  const handleAttendanceChange = async (employeeId, status) => {
    setUpdatingId(employeeId);
    try {
      const resp = await EmployeeService.updateEmployeeAttendance(
        employeeId,
        status
      );
      const updated = resp?.employee || null;
      if (updated) {
        setEmployees((prev) =>
          prev.map((e) => (e._id === employeeId ? { ...e, attendance: updated.attendance } : e))
        );
        setSuccessMessage(`Attendance updated to ${updated.attendance}`);
        setTimeout(() => setSuccessMessage(""), 3000);
        
        try {
          const fresh = await EmployeeService.getEmployee(employeeId);
          if (fresh && fresh._id) {
            setEmployees((prev) =>
              prev.map((e) => (e._id === employeeId ? { ...e, attendance: fresh.attendance, updatedAt: fresh.updatedAt } : e))
            );
          }
        } catch (refreshErr) {
          console.warn('Failed to verify attendance from server:', refreshErr?.message);
        }
      }
    } catch (err) {
      alert(err?.message || "Failed to update attendance");
    } finally {
      setUpdatingId(null);
    }
  };

  const setAllAttendance = async (status) => {
    if (!Array.isArray(employees) || employees.length === 0) return;
    if (!window.confirm(`Are you sure you want to mark ALL employees as ${status}?`)) return;
    
    setBulkUpdating(true);
    try {
      for (const emp of employees) {
        try {
          // Optimistically update UI first
          setEmployees((prev) =>
            prev.map((e) => (e._id === emp._id ? { ...e, attendance: status } : e))
          );
          // Persist to server
          await EmployeeService.updateEmployeeAttendance(emp._id, status);
        } catch (inner) {
          console.warn(`Failed to update ${emp.employeeName}:`, inner?.message);
        }
      }
      try {
        const data = await EmployeeService.getEmployees();
        setEmployees(Array.isArray(data) ? data : []);
        setSuccessMessage(`All employees set to ${status}`);
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (reloadErr) {
        console.warn('Failed to reload employees after bulk update:', reloadErr?.message);
      }
    } finally {
      setBulkUpdating(false);
    }
  };

  const fetchReport = async () => {
    setReportLoading(true);
    setReportError("");
    setReportPage(1); // Reset to first page on new fetch
    try {
      if (!startDate || !endDate) {
        throw new Error("Please select start and end dates");
      }
      const data = await AttendanceService.getByRange(startDate, endDate);
      const items = Array.isArray(data) ? data : [];
      setReportData(items);
    } catch (err) {
      setReportError(err?.message || "Failed to fetch attendance report");
      setReportData([]);
    } finally {
      setReportLoading(false);
    }
  };

  // Auto-fetch today's report on mount
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  const openModal = (emp) => {
    setSelectedEmployee(emp);
    setModalOpen(true);
  };

  const handleModalSaved = async (record) => {
    setSuccessMessage(`Attendance saved for ${selectedEmployee?.employeeName}`);
    setTimeout(() => setSuccessMessage(""), 3000);
    const today = new Date().toISOString().slice(0, 10);
    const recDate = new Date(record.date).toISOString().slice(0, 10);
    if (selectedEmployee && today === recDate) {
      try {
        const fresh = await EmployeeService.getEmployee(selectedEmployee._id);
        if (fresh && fresh._id) {
          setEmployees((prev) => prev.map((e) => (e._id === selectedEmployee._id ? { ...e, attendance: fresh.attendance, updatedAt: fresh.updatedAt } : e)));
        }
      } catch {}
    }
    if (recDate >= startDate && recDate <= endDate) {
      fetchReport();
    }
  };

  const fetchSummary = async () => {
    try {
      if (summaryType === "Monthly") {
        const data = await AttendanceService.getMonthlySummary(summaryYear);
        setSummaryData(Array.isArray(data) ? data : []);
      } else {
        const data = await AttendanceService.getYearlySummary();
        setSummaryData(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setSummaryData([]);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryType, summaryYear]);

  const getMonthName = (monthNum) => {
    const date = new Date();
    date.setMonth(monthNum - 1);
    return date.toLocaleString('en-US', { month: 'long' });
  };

  const downloadCSV = () => {
    if (reportData.length === 0) return;
    
    const headers = ["Employee", "Date", "Status", "Note", "Updated By"];
    const rows = reportData.map(item => [
      item.employee?.employeeName || item.employeeName || '-',
      formatDate(item.date),
      item.status,
      item.note || '',
      item.updatedBy?.username || '-'
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination Logic
  const empStartIndex = (empPage - 1) * itemsPerPage;
  const currentEmployees = employees.slice(empStartIndex, empStartIndex + itemsPerPage);
  const empTotalPages = Math.ceil(employees.length / itemsPerPage);

  const reportStartIndex = (reportPage - 1) * itemsPerPage;
  const currentReportData = reportData.slice(reportStartIndex, reportStartIndex + itemsPerPage);
  const reportTotalPages = Math.ceil(reportData.length / itemsPerPage);

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Attendance Management</div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-home"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-active"]}>Attendance Management</div>
          </div>
        </section>

        {/* Attendance Controls */}
        <section className={styles["section"]}>
          <div className={styles["section-header"]}>
            <h3>Mark Attendance</h3>
            <div className={styles["actions"]}>
              <button
                className={`${styles["action-btn"]} ${styles["btn-onsite"]}`}
                disabled={bulkUpdating || loadingEmployees}
                onClick={() => setAllAttendance("Onsite")}
              >
                Mark All Onsite
              </button>
              <button
                className={`${styles["action-btn"]} ${styles["btn-leave"]}`}
                disabled={bulkUpdating || loadingEmployees}
                onClick={() => setAllAttendance("Leave")}
              >
                Mark All Leave
              </button>
            </div>
          </div>

          {successMessage && (
            <div className={styles["success"]}>{successMessage}</div>
          )}
          {employeeError && (
            <div className={styles["error"]}>{employeeError}</div>
          )}

          <div className={styles["table-wrapper"]}>
            <table className={styles["table"]}>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Current Status</th>
                  <th>Last Update</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingEmployees ? (
                  <tr>
                    <td colSpan="7" className={styles["center"]}>Loading employees...</td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={styles["center"]}>No employees found</td>
                  </tr>
                ) : (
                  currentEmployees.map((emp, index) => (
                    <tr key={emp._id}>
                      <td>{empStartIndex + index + 1}</td>
                      <td style={{ fontWeight: 500 }}>{emp.employeeName}</td>
                      <td>{emp.department}</td>
                      <td>{emp.role}</td>
                      <td>
                        <select
                          className={`${styles["select"]} ${emp.attendance === 'Onsite' ? styles["status-onsite"] : styles["status-leave"]}`}
                          value={emp.attendance || "Onsite"}
                          onChange={(e) =>
                            setEmployees((prev) =>
                              prev.map((x) =>
                                x._id === emp._id ? { ...x, attendance: e.target.value } : x
                              )
                            )
                          }
                        >
                          <option value="Onsite">Onsite</option>
                          <option value="Leave">Leave</option>
                      </select>
                      </td>
                      <td style={{ fontSize: '12px', color: '#666' }}>
                        {emp.updatedAt ? new Date(emp.updatedAt).toLocaleString() : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className={styles["update-btn"]}
                            disabled={updatingId === emp._id}
                            onClick={() => handleAttendanceChange(emp._id, emp.attendance || "Onsite")}
                          >
                            {updatingId === emp._id ? "Saving..." : "Save"}
                          </button>
                          <button
                            className={styles["update-btn-outline"]}
                            onClick={() => openModal(emp)}
                          >
                            History/Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls for Employees */}
          {empTotalPages > 1 && (
            <div className={styles["pagination"]}>
              <button 
                disabled={empPage === 1} 
                onClick={() => setEmpPage(p => p - 1)}
                className={styles["page-btn"]}
              >
                Previous
              </button>
              <span>Page {empPage} of {empTotalPages}</span>
              <button 
                disabled={empPage === empTotalPages} 
                onClick={() => setEmpPage(p => p + 1)}
                className={styles["page-btn"]}
              >
                Next
              </button>
            </div>
          )}
        </section>

        {/* Attendance Report */}
        <section className={styles["section"]}>
          <div className={styles["section-header"]}>
            <h3>Attendance Report</h3>
            <div className={styles["filters"]}>
              <div className={styles["date-inputs"]}>
                <label>
                  Start:
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label>
                  End:
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
              <div className={styles["filter-actions"]}>
                <button
                  className={styles["action-btn-secondary"]}
                  disabled={reportLoading}
                  onClick={() => {
                    const t = new Date().toISOString().slice(0, 10);
                    setStartDate(t);
                    setEndDate(t);
                    // We rely on the user clicking 'Get Report' or we could trigger it via effect if we wanted auto-update
                  }}
                >
                  Today
                </button>
                <button
                  className={styles["action-btn"]}
                  disabled={reportLoading}
                  onClick={fetchReport}
                >
                  {reportLoading ? "Fetching..." : "Get Report"}
                </button>
                <button
                  className={styles["action-btn-outline"]}
                  onClick={downloadCSV}
                  disabled={reportData.length === 0}
                >
                  Download CSV
                </button>
              </div>
            </div>
          </div>

          {reportError && <div className={styles["error"]}>{reportError}</div>}

          <div className={styles["summary-bar"]}>
            <span>Total Records: <strong>{reportData.length}</strong></span>
            <span>Onsite: <strong>{reportData.filter(x => x.status === 'Onsite').length}</strong></span>
            <span>Leave: <strong>{reportData.filter(x => x.status === 'Leave').length}</strong></span>
          </div>

          <div className={styles["table-wrapper"]}>
            <table className={styles["table"]}>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {reportLoading ? (
                  <tr>
                    <td colSpan="6" className={styles["center"]}>Loading report...</td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles["center"]}>No data found for this range</td>
                  </tr>
                ) : (
                  currentReportData.map((item, index) => (
                    <tr key={item._id}>
                      <td>{reportStartIndex + index + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.employee?.employeeName || item.employeeName || '-'}</td>
                      <td>{formatDate(item.date)}</td>
                      <td>
                        <span className={item.status === 'Onsite' ? styles["badge-onsite"] : styles["badge-leave"]}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.note || '-'}</td>
                      <td>{item.updatedBy?.username || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls for Report */}
          {reportTotalPages > 1 && (
            <div className={styles["pagination"]}>
              <button 
                disabled={reportPage === 1} 
                onClick={() => setReportPage(p => p - 1)}
                className={styles["page-btn"]}
              >
                Previous
              </button>
              <span>Page {reportPage} of {reportTotalPages}</span>
              <button 
                disabled={reportPage === reportTotalPages} 
                onClick={() => setReportPage(p => p + 1)}
                className={styles["page-btn"]}
              >
                Next
              </button>
            </div>
          )}
        </section>

        <section className={styles["section"]}>
          <div className={styles["section-header"]}>
            <h3>Attendance Summary</h3>
            <div className={styles["filters"]}>
              <label>
                Type:
                <select value={summaryType} onChange={(e) => setSummaryType(e.target.value)} className={styles["select-small"]}>
                  <option>Monthly</option>
                  <option>Yearly</option>
                </select>
              </label>
              {summaryType === 'Monthly' && (
                <label>
                  Year:
                  <input 
                    type="number" 
                    value={summaryYear} 
                    onChange={(e) => setSummaryYear(Number(e.target.value))} 
                    className={styles["input-small"]}
                  />
                </label>
              )}
              <button className={styles["action-btn"]} onClick={fetchSummary}>Refresh</button>
            </div>
          </div>
          <div className={styles["table-wrapper"]}>
            <table className={styles["table"]}>
              <thead>
                <tr>
                  <th>{summaryType === 'Monthly' ? 'Month' : 'Year'}</th>
                  <th>Onsite Days</th>
                  <th>Leave Days</th>
                  <th>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className={styles["center"]}>No summary data available</td>
                  </tr>
                ) : (
                  summaryData.map((row) => {
                    const onsite = (row.byStatus || []).find((x) => x.status === 'Onsite')?.count || 0;
                    const leave = (row.byStatus || []).find((x) => x.status === 'Leave')?.count || 0;
                    const total = onsite + leave;
                    const rate = total > 0 ? Math.round((onsite / total) * 100) : 0;
                    
                    let label = row._id;
                    if (summaryType === 'Monthly') {
                      label = getMonthName(row._id);
                    }

                    return (
                      <tr key={row._id}>
                        <td style={{ fontWeight: 500 }}>{label}</td>
                        <td style={{ color: '#16a34a', fontWeight: 600 }}>{onsite}</td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{leave}</td>
                        <td>
                          <div className={styles["progress-bar"]}>
                            <div className={styles["progress-fill"]} style={{ width: `${rate}%` }}></div>
                          </div>
                          <span style={{ fontSize: '12px', marginLeft: '8px' }}>{rate}%</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <AttendanceUpdateModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          employee={selectedEmployee}
          onSaved={handleModalSaved}
        />
      </main>
    </div>
  );
}

export default AttendanceManagement;
