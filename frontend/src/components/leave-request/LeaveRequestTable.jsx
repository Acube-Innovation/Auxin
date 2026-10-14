import React, { useState, useEffect, useRef } from "react";
import styles from "./LeaveRequestTable.module.css";
import plus from "../../assets/dashboard/plus.svg";
import leaveRequestService from "../../services/LeaveRequestService";
import employeeService from "../../services/EmployeeService";
import DeleteModal from "../delete-modal/DeleteModal";
import AddLeaveRequestModal from "./AddLeaveRequestModal";
import EditLeaveRequestModal from "./EditLeaveRequestModal";
import { useToast } from "../../context/ToastContext";
import { OFFICE_HOLIDAYS_2026, OFFICIAL_HOLIDAYS_2026 } from "../../utils/leaveHolidays";

const EditIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

const DeleteIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const CheckIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const XIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

function LeaveRequestTable({ onUpdate }) {
    const { showToast } = useToast();
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("All");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [userRole, setUserRole] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [employees, setEmployees] = useState([]);
    const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
    // HOD: the department whose requests are shown (undefined until loaded, null when the login has none)
    const [hodDepartment, setHodDepartment] = useState(undefined);
    const itemsPerPage = 10;
    const ANNUAL_LEAVE_ENTITLEMENT = 21;

    const isHOD = userRole === "hod";
    const isAdminRole = userRole === "admin";
    const isAdminOrHOD = isAdminRole || isHOD;

    const fetchLeaveRequests = async () => {
        setIsLoading(true);
        try {
            const data = await leaveRequestService.getLeaveRequests();
            setLeaveRequests(data);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Error fetching leave requests:", error);
            showToast("Failed to fetch leave requests.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEmployees = async () => {
        setIsEmployeesLoading(true);
        try {
            const data = await employeeService.getEmployees();
            setEmployees(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching employees:", error);
        } finally {
            setIsEmployeesLoading(false);
        }
    };

    useEffect(() => {
        const role = localStorage.getItem("role") || "";
        setUserRole(role);
        fetchLeaveRequests();
        if (role === "admin" || role === "hod") {
            fetchEmployees();
        }
        if (role === "hod") {
            leaveRequestService.getLeaveScope()
                .then(scope => setHodDepartment(scope.department || null))
                .catch(error => console.error("Error fetching leave scope:", error));
        }
    }, []);

    const handleEdit = (request) => {
        setSelectedRequest(request);
        setIsEditModalOpen(true);
    };

    const handleDelete = (request) => {
        setSelectedRequest(request);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            await leaveRequestService.deleteLeaveRequest(selectedRequest._id);
            showToast("Leave request deleted successfully.", "success");
            fetchLeaveRequests();
            setIsDeleteModalOpen(false);
        } catch (error) {
            showToast("Failed to delete leave request.", "error");
        }
    };

    const handleApprove = async (request) => {
        try {
            await leaveRequestService.approveLeaveRequest(request._id, "Approved");
            showToast("Leave request approved successfully.", "success");
            fetchLeaveRequests();
        } catch (error) {
            console.error("Error approving leave request:", error);
            const errorMessage = error.response?.data?.message || "Failed to approve leave request.";
            showToast(errorMessage, "error");
        }
    };

    const handleReject = async (request) => {
        try {
            await leaveRequestService.approveLeaveRequest(request._id, "Rejected");
            showToast("Leave request rejected successfully.", "success");
            fetchLeaveRequests();
        } catch (error) {
            console.error("Error rejecting leave request:", error);
            const errorMessage = error.response?.data?.message || "Failed to reject leave request.";
            showToast(errorMessage, "error");
        }
    };

    const filteredRequests = leaveRequests.filter(req => {
        if (activeFilter === "Holidays") return false;
        if (activeFilter === "Leave Chart") return false;
        if (activeFilter === "All") return true;
        if (activeFilter === "History") return req.status === "Approved" || req.status === "Rejected";
        if (activeFilter === "HOD Approved") return req.status === "HOD Approved";
        return req.status === activeFilter;
    });

    // Determine which requests can be approved based on role
    // Both HOD and Admin can independently approve/reject leave requests
    const canApprove = (request) => {
        // HOD: Pending requests of their department (the list holds only those), never their own
        if (isHOD && request.status === "Pending") return (request.employee?._id || request.employee) !== localStorage.getItem("userId");
        if (isAdminRole && (request.status === "Pending" || request.status === "HOD Approved")) return true;
        return false;
    };



    // Pagination calculations
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

    // Pagination for Leave Chart tab (computed below once chart rows are built)
    const isLeaveChart = activeFilter === "Leave Chart";

    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter]);

    // Handle page change (used by legacy pagination)
    // eslint-disable-next-line no-unused-vars
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Generate page numbers to display (used by legacy pagination)
    // eslint-disable-next-line no-unused-vars
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    const officialHolidaySet = new Set(OFFICIAL_HOLIDAYS_2026);

    // Calculate working days only (excluding weekends and public holidays)
    const calculateDays = (start, end) => {
        let workingDays = 0;
        const startDate = new Date(start);
        const endDate = new Date(end);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const day = currentDate.getDay();
            const dateStr = currentDate.toISOString().split('T')[0];
            // Count only if not weekend (Sat=6, Sun=0) and not a holiday
            if (day !== 0 && day !== 6 && !officialHolidaySet.has(dateStr)) {
                workingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return workingDays;
    };

    const [editingRowId, setEditingRowId] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [isSavingOverride, setIsSavingOverride] = useState(false);
    const editingOriginals = useRef({ totalTaken: 0, balance: 0 });

    const startEditing = (row) => {
        setEditingRowId(row._id);
        editingOriginals.current = { totalTaken: row.totalTaken, balance: row.balance };
        setEditValues({
            sickLeave: row.sickLeave,
            privilegeLeave: row.privilegeLeave,
            casualLeave: row.casualLeave,
            otherLeave: row.otherLeave,
            totalTaken: row.totalTaken,
            balance: row.balance,
        });
    };

    const cancelEditing = () => {
        setEditingRowId(null);
        setEditValues({});
    };

    const handleEditValueChange = (field, value) => {
        const num = value === '' ? '' : Number(value);
        setEditValues(prev => {
            const updated = { ...prev, [field]: num };

            // If editing a leave type, auto-calculate total and balance
            if (['sickLeave', 'privilegeLeave', 'casualLeave', 'otherLeave'].includes(field)) {
                const sick = Number(updated.sickLeave) || 0;
                const privilege = Number(updated.privilegeLeave) || 0;
                const casual = Number(updated.casualLeave) || 0;
                const other = Number(updated.otherLeave) || 0;

                const newTotal = sick + privilege + casual + other;
                const delta = newTotal - editingOriginals.current.totalTaken;

                updated.totalTaken = newTotal;
                updated.balance = Math.max(0, editingOriginals.current.balance - delta);
            }

            return updated;
        });
    };

    const saveOverride = async (employeeId) => {
        setIsSavingOverride(true);
        try {
            const payload = {};
            ['sickLeave', 'privilegeLeave', 'casualLeave', 'otherLeave', 'totalTaken', 'balance'].forEach(f => {
                if (editValues[f] !== '') payload[f] = editValues[f];
            });
            await employeeService.updateLeaveOverride(employeeId, payload);
            showToast('Leave data saved successfully.', 'success');
            setEditingRowId(null);
            setEditValues({});
            // Refresh employees to get updated leaveOverride
            fetchEmployees();
        } catch (err) {
            showToast('Failed to save leave data.', 'error');
            console.error('Error in saveOverride:', err);
        } finally {
            setIsSavingOverride(false);
        }
    };

    // Build dynamic Employee Leave Management Chart data
    const buildLeaveChartRows = () => {
        const approvedRequests = leaveRequests.filter(r => r.status === "Approved");

        const sumDaysFor = (predicate) => approvedRequests
            .filter(predicate)
            .reduce((sum, r) => sum + calculateDays(r.startDate, r.endDate), 0);

        const sameDepartment = (emp) => (emp.department || "").trim().toLowerCase() === (hodDepartment || "").trim().toLowerCase();
        return employees.filter(emp => !isHOD || (hodDepartment && sameDepartment(emp))).map(emp => {
            const empName = (emp.employeeName || "").trim().toLowerCase();
            const empEmail = (emp.emailId || "").trim().toLowerCase();

            const matches = (req) => {
                const reqEmail = (req.employee?.emailId || "").trim().toLowerCase();
                const reqName = (req.employeeName || req.employee?.username || "").trim().toLowerCase();
                if (empEmail && reqEmail && empEmail === reqEmail) return true;
                if (empName && reqName && empName === reqName) return true;
                return false;
            };

            const calcSick = sumDaysFor(r => matches(r) && r.leaveType === "Sick Leave");
            const calcPrivilege = sumDaysFor(r => matches(r) && r.leaveType === "Privilege Leave");
            const calcCasual = sumDaysFor(r => matches(r) && r.leaveType === "Casual Leave");
            const calcOther = sumDaysFor(r => matches(r) && !["Sick Leave", "Privilege Leave", "Casual Leave"].includes(r.leaveType));
            const calcTotal = calcSick + calcPrivilege + calcCasual + calcOther;
            const calcBalance = Math.max(0, ANNUAL_LEAVE_ENTITLEMENT - calcTotal);

            // Use admin override values if set, otherwise use auto-calculated
            const ov = emp.leaveOverride || {};
            const sickLeave = ov.sickLeave !== null && ov.sickLeave !== undefined ? ov.sickLeave : calcSick;
            const privilegeLeave = ov.privilegeLeave !== null && ov.privilegeLeave !== undefined ? ov.privilegeLeave : calcPrivilege;
            const casualLeave = ov.casualLeave !== null && ov.casualLeave !== undefined ? ov.casualLeave : calcCasual;
            const otherLeave = ov.otherLeave !== null && ov.otherLeave !== undefined ? ov.otherLeave : calcOther;
            const totalTaken = ov.totalTaken !== null && ov.totalTaken !== undefined ? ov.totalTaken : calcTotal;
            const balance = ov.balance !== null && ov.balance !== undefined ? ov.balance : calcBalance;
            const hasOverride = Object.values(ov).some(v => v !== null && v !== undefined && typeof v !== 'string');

            return {
                _id: emp._id,
                code: emp.employeeId || "—",
                name: emp.employeeName || "—",
                sickLeave, privilegeLeave, casualLeave, otherLeave, totalTaken, balance,
                hasOverride,
            };
        });
    };

    // Compute chart data + chart pagination
    const leaveChartRows = isLeaveChart ? buildLeaveChartRows() : [];
    const chartTotalPages = Math.max(1, Math.ceil(leaveChartRows.length / itemsPerPage));
    const chartStartIndex = (currentPage - 1) * itemsPerPage;
    const chartEndIndex = chartStartIndex + itemsPerPage;
    const paginatedChartRows = leaveChartRows.slice(chartStartIndex, chartEndIndex);

    // Unified pagination values depending on active tab
    const effectiveTotalPages = isLeaveChart ? chartTotalPages : totalPages;
    const effectiveStartIndex = isLeaveChart ? chartStartIndex : startIndex;
    const effectiveEndIndex = isLeaveChart ? chartEndIndex : endIndex;
    const effectiveTotalCount = isLeaveChart ? leaveChartRows.length : filteredRequests.length;

    const getEffectivePageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        const total = effectiveTotalPages;

        if (total <= maxVisiblePages) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push('...');
                pages.push(total);
            } else if (currentPage >= total - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = total - 3; i <= total; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(total);
            }
        }
        return pages;
    };

    const handleEffectivePageChange = (page) => {
        if (page >= 1 && page <= effectiveTotalPages) {
            setCurrentPage(page);
        }
    };

    if (isLoading) return <div className={styles.loading}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Leave Management</h2>
                    {isHOD && hodDepartment !== undefined && (
                        hodDepartment ? (
                            <div className={styles.scopeNote}>Showing requests from the <strong>{hodDepartment}</strong> department</div>
                        ) : (
                            <div className={`${styles.scopeNote} ${styles.scopeWarning}`}>
                                Your login is not linked to an employee with a department, so no requests are shown. Ask Admin to link it in User Management.
                            </div>
                        )
                    )}
                </div>
                <div className={styles.actions}>
                    {!isAdminOrHOD && (
                        <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
                            <span>Request Leave</span>
                            <img src={plus} alt="" />
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.controls}>
                <div className={styles.segmentedControl}>
                    {(isAdminRole
                        ? ["All", "Pending", "HOD Approved", "Approved", "Rejected", "History", "Holidays", "Leave Chart"]
                        : isHOD
                            ? ["All", "Pending", "HOD Approved", "Approved", "Rejected", "History", "Holidays", "Leave Chart"]
                            : ["All", "Pending", "HOD Approved", "Approved", "Rejected", "History", "Holidays"]
                    ).map(filter => (
                        <button
                            key={filter}
                            className={`${styles.filterButton} ${activeFilter === filter ? styles.active : ""}`}
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filter === "HOD Approved" ? "HOD Approved" : filter}
                        </button>
                    ))}
                </div>
            </div>

            {activeFilter === "Holidays" ? (
                <div className={styles.tableWrapper}>
                    <div className={styles.holidaysHeading}>Office Holidays in 2026</div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>S.No.</th>
                                <th>Date</th>
                                <th>Day</th>
                                <th>Holiday</th>
                            </tr>
                        </thead>
                        <tbody>
                            {OFFICE_HOLIDAYS_2026.map((row, index) => {
                                const d = new Date(`${row.date}T12:00:00`);
                                const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
                                const dateDisplay = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                                return (
                                    <tr key={row.date}>
                                        <td>{index + 1}</td>
                                        <td>{dateDisplay}</td>
                                        <td>{dayName}</td>
                                        <td>{row.name}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : activeFilter === "Leave Chart" ? (
                <div className={styles.tableWrapper}>
                    <div className={styles.holidaysHeading}>Employee Leave Management Chart</div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Employee Code</th>
                                <th>Name of Employee</th>
                                <th>Sick Leave</th>
                                <th>Privilege Leave</th>
                                <th>Casual Leave</th>
                                <th>Other Leave (Specify)</th>
                                <th>Total Leaves Taken</th>
                                <th>Balance Leaves</th>
                                {isAdminOrHOD && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {isEmployeesLoading ? (
                                <tr>
                                    <td colSpan={isAdminOrHOD ? "9" : "8"} className={styles.noData}>Loading...</td>
                                </tr>
                            ) : leaveChartRows.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdminOrHOD ? "9" : "8"} className={styles.noData}>No employees found.</td>
                                </tr>
                            ) : (
                                paginatedChartRows.map(row => {
                                    const isEditing = isAdminOrHOD && editingRowId === row._id;
                                    const editableFields = [
                                        { key: 'sickLeave', label: 'Sick Leave' },
                                        { key: 'privilegeLeave', label: 'Privilege Leave' },
                                        { key: 'casualLeave', label: 'Casual Leave' },
                                        { key: 'otherLeave', label: 'Other Leave' },
                                        { key: 'totalTaken', label: 'Total Taken' },
                                        { key: 'balance', label: 'Balance' },
                                    ];
                                    return (
                                        <tr key={row._id} className={row.hasOverride ? styles.overrideRow : ''}>
                                            <td>{row.code}</td>
                                            <td>
                                                <div className={styles.employeeName}>
                                                    {row.name}
                                                    {row.hasOverride && (
                                                        <span className={styles.overrideDot} title="Values manually edited by Admin">✏</span>
                                                    )}
                                                </div>
                                            </td>
                                            {editableFields.map(({ key }) => (
                                                <td key={key}>
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className={styles.leaveEditInput}
                                                            value={editValues[key] === '' ? '' : editValues[key]}
                                                            onChange={e => handleEditValueChange(key, e.target.value)}
                                                        />
                                                    ) : (
                                                        row[key] > 0 || key === 'balance' ? row[key] : ''
                                                    )}
                                                </td>
                                            ))}
                                            {isAdminOrHOD && (
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        {isEditing ? (
                                                            <>
                                                                <button
                                                                    className={`${styles.iconButton} ${styles.approveButton}`}
                                                                    onClick={() => saveOverride(row._id)}
                                                                    disabled={isSavingOverride}
                                                                    title="Save"
                                                                >
                                                                    <CheckIcon />
                                                                </button>
                                                                <button
                                                                    className={`${styles.iconButton} ${styles.rejectButton}`}
                                                                    onClick={cancelEditing}
                                                                    title="Cancel"
                                                                >
                                                                    <XIcon />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                className={styles.iconButton}
                                                                onClick={() => startEditing(row)}
                                                                title="Edit leave values"
                                                            >
                                                                <EditIcon />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Company</th>
                            <th>Type</th>
                            {activeFilter === "History" ? (
                                <>
                                    <th>Reason</th>
                                    <th>Days</th>
                                    <th>Dates</th>
                                    <th>Status</th>
                                </>
                            ) : (
                                <>
                                    <th>Duration</th>
                                    <th>Status</th>
                                </>
                            )}
                            <th>Applied On</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRequests.map(req => (
                            <tr key={req._id}>
                                <td>
                                    <div className={styles.employeeInfo}>
                                        <div className={styles.employeeName}>
                                            {req.employee?.username || req.employeeName || 'Unknown'}
                                        </div>
                                    </div>
                                </td>

                                <td>{req.company || 'N/A'}</td>

                                <td>{req.leaveType}</td>
                                {activeFilter === "History" ? (
                                    <>
                                        <td>{req.reason}</td>
                                        <td>{calculateDays(req.startDate, req.endDate)} Days</td>
                                        <td>
                                            {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <span className={`${styles.statusChip} ${styles[req.status.toLowerCase().replace(' ', '_')]}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td>
                                            {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <span className={`${styles.statusChip} ${styles[req.status.toLowerCase().replace(' ', '_')]}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                    </>
                                )}
                                <td>{new Date(req.appliedOn).toLocaleDateString()}</td>
                                <td>
                                    <div className={styles.rowActions}>
                                        {isAdminRole ? (
                                            // Admin view: Approve/Reject (when applicable) + Edit + Delete on every row
                                            <>
                                                {canApprove(req) && (
                                                    <>
                                                        <button
                                                            className={`${styles.iconButton} ${styles.approveButton}`}
                                                            onClick={() => handleApprove(req)}
                                                            title="Approve"
                                                        >
                                                            <CheckIcon />
                                                        </button>
                                                        <button
                                                            className={`${styles.iconButton} ${styles.rejectButton}`}
                                                            onClick={() => handleReject(req)}
                                                            title="Reject"
                                                        >
                                                            <XIcon />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    className={styles.iconButton}
                                                    onClick={() => handleEdit(req)}
                                                    title="Edit"
                                                >
                                                    <EditIcon />
                                                </button>
                                                <button
                                                    className={styles.iconButton}
                                                    onClick={() => handleDelete(req)}
                                                    title="Delete"
                                                >
                                                    <DeleteIcon />
                                                </button>
                                            </>
                                        ) : isHOD ? (
                                            // HOD view: Approve/Reject on Pending requests (approval is now final)
                                            canApprove(req) ? (
                                                <>
                                                    <button
                                                        className={`${styles.iconButton} ${styles.approveButton}`}
                                                        onClick={() => handleApprove(req)}
                                                        title="Approve"
                                                    >
                                                        <CheckIcon />
                                                    </button>
                                                    <button
                                                        className={`${styles.iconButton} ${styles.rejectButton}`}
                                                        onClick={() => handleReject(req)}
                                                        title="Reject"
                                                    >
                                                        <XIcon />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className={styles.noAction}>—</span>
                                            )
                                        ) : (
                                            // Employee view: Show Edit/Delete buttons only for Pending requests
                                            req.status === "Pending" ? (
                                                <>
                                                    <button className={styles.iconButton} onClick={() => handleEdit(req)} title="Edit">
                                                        <EditIcon />
                                                    </button>
                                                    <button className={styles.iconButton} onClick={() => handleDelete(req)} title="Delete">
                                                        <DeleteIcon />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className={styles.noAction}>—</span>
                                            )
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredRequests.length === 0 && (
                            <tr>
                                <td colSpan="7" className={styles.noData}>No leave requests found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            )}

            {/* Pagination Controls */}
            {activeFilter !== "Holidays" && effectiveTotalPages > 1 && (
                <div className={styles.pagination}>
                    <div className={styles.paginationInfo}>
                        Showing {effectiveStartIndex + 1} to {Math.min(effectiveEndIndex, effectiveTotalCount)} of {effectiveTotalCount} entries
                    </div>
                    <div className={styles.paginationControls}>
                        <button
                            className={styles.pageButton}
                            onClick={() => handleEffectivePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>
                        {getEffectivePageNumbers().map((page, index) => (
                            <button
                                key={index}
                                className={`${styles.pageButton} ${page === currentPage ? styles.activePage : ''} ${page === '...' ? styles.ellipsis : ''}`}
                                onClick={() => page !== '...' && handleEffectivePageChange(page)}
                                disabled={page === '...'}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            className={styles.pageButton}
                            onClick={() => handleEffectivePageChange(currentPage + 1)}
                            disabled={currentPage === effectiveTotalPages}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            <AddLeaveRequestModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={fetchLeaveRequests}
            />

            <EditLeaveRequestModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                leaveRequest={selectedRequest}
                onSubmit={fetchLeaveRequests}
            />

            <DeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Leave Management"
                description="Are you sure you want to delete this leave record? This action cannot be undone."
            />
        </div>
    );
}

export default LeaveRequestTable;

