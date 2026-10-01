import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./TeamMembersTable.module.css";
import DeleteModal from "../delete-modal/DeleteModal";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import FilterDropdown from "../FilterDropdown";
import employeeService from "../../services/EmployeeService";
import ClientService from "../../services/ClientService";
import config from "../../config/config";
import { io as ioClient } from "socket.io-client";
import { useToast } from "../../context/ToastContext";

// SVG Components (reusing from ClientsTable)
const UserPlusIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles["button-icon"]}
  >
    <path
      d="M16.5547 21V19C16.5547 17.9391 16.1333 16.9217 15.3831 16.1716C14.633 15.4214 13.6156 15 12.5547 15H6.55469C5.49382 15 4.47641 15.4214 3.72626 16.1716C2.97611 16.9217 2.55469 17.9391 2.55469 19V21M19.5547 8V14M22.5547 11H16.5547M13.5547 7C13.5547 9.20914 11.7638 11 9.55469 11C7.34555 11 5.55469 9.20914 5.55469 7C5.55469 4.79086 7.34555 3 9.55469 3C11.7638 3 13.5547 4.79086 13.5547 7Z"
      stroke="white"
      strokeOpacity="0.9"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 17 17"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles["search-icon"]}
  >
    <path
      d="M14.4063 14.5938L11.5396 11.7271M13.0729 7.92708C13.0729 10.8726 10.6851 13.2604 7.73958 13.2604C4.79406 13.2604 2.40625 10.8726 2.40625 7.92708C2.40625 4.98156 4.79406 2.59375 7.73958 2.59375C10.6851 2.59375 13.0729 4.98156 13.0729 7.92708Z"
      stroke="#98A1B0"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const FilterIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles["filter-icon"]}
  >
    <path
      d="M4 8.59375H28M9.33333 16.5938H22.6667M13.3333 24.5938H18.6667"
      stroke="#98A1B0"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const SortIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles["sort-icon"]}
  >
    <path
      d="M2.23642 11.7338L4.93675 14.4341M4.93675 14.4341L7.63708 11.7338M4.93675 14.4341V3.63281M14.3879 6.33314L11.6876 3.63281M11.6876 3.63281L8.98725 6.33314M11.6876 3.63281V14.4341"
      stroke="#808080"
      strokeOpacity="0.7"
      strokeWidth="1.01262"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const EditIcon = () => (
  <svg
    width="29"
    height="29"
    viewBox="0 0 30 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles["edit-icon"]}
  >
    <path
      d="M15.1136 6.0089H8.02525C7.48812 6.0089 6.97299 6.22227 6.59318 6.60208C6.21337 6.98189 6 7.49702 6 8.03415V22.2109C6 22.748 6.21337 23.2632 6.59318 23.643C6.97299 24.0228 7.48812 24.2361 8.02525 24.2361H22.202C22.7391 24.2361 23.2543 24.0228 23.6341 23.643C24.0139 23.2632 24.2272 22.748 24.2272 22.2109V15.1225M21.5691 5.62916C21.972 5.22632 22.5183 5 23.088 5C23.6578 5 24.2041 5.22632 24.607 5.62916C25.0098 6.03201 25.2361 6.57839 25.2361 7.1481C25.2361 7.71781 25.0098 8.26419 24.607 8.66704L15.4802 17.7948C15.2397 18.0351 14.9427 18.2109 14.6164 18.3062L11.7072 19.1568C11.62 19.1822 11.5277 19.1838 11.4397 19.1612C11.3518 19.1387 11.2715 19.093 11.2074 19.0288C11.1432 18.9646 11.0974 18.8843 11.0749 18.7964C11.0524 18.7085 11.0539 18.6161 11.0793 18.529L11.9299 15.6197C12.0256 15.2937 12.2019 14.997 12.4423 14.757L21.5691 5.62916Z"
      stroke="#8C8E90"
      strokeWidth="2.02525"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const DeleteIcon = () => (
  <svg
    width="29"
    height="29"
    viewBox="0 0 29 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles["delete-icon"]}
  >
    <path
      d="M5 8.0505H23.2272M21.202 8.0505V22.2272C21.202 23.2399 20.1894 24.2525 19.1767 24.2525H9.0505C8.03787 24.2525 7.02525 23.2399 7.02525 22.2272V8.0505M10.0631 8.0505V6.02525C10.0631 5.01262 11.0757 4 12.0884 4H16.1389C17.1515 4 18.1641 5.01262 18.1641 6.02525V8.0505M12.0884 13.1136V19.1894M16.1389 13.1136V19.1894"
      stroke="#8C8E90"
      strokeWidth="2.02525"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function TeamMembersTable() {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const filterButtonRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; 
  // Fetch employees and clients from API
  useEffect(() => {
    fetchEmployees();
    fetchClients();

    // Listen for real-time employee creations so UI updates without manual refresh
    const raw = config.API_BASE_URL || '';
    const socketUrl = raw.replace(/\/api\/?$/, '') || window.location.origin;
    const socket = ioClient(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    const onEmployeeCreated = (employee) => {
      if (!employee) return;
      setEmployees((prev) => {
        if (!prev) return [employee];
        const exists = prev.some((e) => String(e._id) === String(employee._id));
        if (exists) return prev;
        return [employee, ...prev];
      });
    };

    socket.on('employee-created', onEmployeeCreated);

    return () => {
      try { socket.off('employee-created', onEmployeeCreated); socket.disconnect(); } catch (e) {}
    };
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const employeesData = await employeeService.getEmployees();
      console.log("Fetched employees:", employeesData);
      setEmployees(employeesData || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      // Keep existing list visible; surface error inline
      setError("Failed to load employees. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await ClientService.getClients();
      const clientList = Array.isArray(data) ? data : data.clients || [];
      setClients(clientList);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = paginatedData.map(e => e._id || e.id);
      setSelectedEmployeeIds(allIds);
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const handleSelectEmployee = (id) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(eId => eId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleEdit = (employee) => {
    setEmployeeToEdit(employee);
    setIsEditEmployeeModalOpen(true);
  };

  const handleDelete = (employee) => {
    setMemberToDelete(employee);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (memberToDelete) {
        // Single delete
        await employeeService.deleteEmployee(memberToDelete._id || memberToDelete.id);
        showToast(`${memberToDelete.employeeName} has been deleted.`, 'success');
      } else if (selectedEmployeeIds.length > 0) {
        // Bulk delete
        await employeeService.bulkDeleteEmployees(selectedEmployeeIds);
        showToast(`${selectedEmployeeIds.length} employees have been deleted.`, 'success');
        setSelectedEmployeeIds([]);
      }
      
      // Refresh the employees list
      await fetchEmployees();
    } catch (err) {
      console.error("Error deleting employee(s):", err);
      const errorMsg = err.message || "Unknown error";
      setError(`Failed to delete: ${errorMsg}`);
      showToast(`Failed to delete: ${errorMsg}`, 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setMemberToDelete(null);
  };

  const handleAddEmployee = () => {
    setIsAddEmployeeModalOpen(true);
  };

  const handleAddEmployeeClose = () => {
    setIsAddEmployeeModalOpen(false);
  };

  const handleEditEmployeeClose = () => {
    setIsEditEmployeeModalOpen(false);
    setEmployeeToEdit(null);
  };

  const handleAddEmployeeSubmit = async (formData) => {
    try {
      // If the AddEmployeeModal returns the created employee, append optimistically.
      // Expectation: onSubmit may return the created employee object; if not, we still refresh.
      const created = formData?.createdEmployee || null;
      if (created) {
        setEmployees((prev) => [created, ...prev]);
      }
      // run background refresh to reconcile server state
      await fetchEmployees();

      // Show success notification
      showToast(`${formData.employeeName} has been successfully added.`, 'success');
    } catch (err) {
      console.error("Error refreshing employees after add:", err);
      // Re-fetch to ensure consistency on error
      fetchEmployees();
      showToast("Employee added, but failed to refresh list.", 'warning');
    }
  };

  const handleEditEmployeeSubmit = async (formData) => {
    try {
      // Refresh the employees list after editing
      await fetchEmployees();
      showToast("Employee details updated successfully.", 'success');
    } catch (err) {
      console.error("Error refreshing employees after edit:", err);
      showToast("Employee updated, but failed to refresh list.", 'warning');
    }
  };

  const handleFilterClick = (event) => {
    if (filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left - 200
      });
    }
    setIsFilterDropdownOpen(!isFilterDropdownOpen);
  };

  const handleFilterDropdownClose = () => {
    setIsFilterDropdownOpen(false);
  };

  const handleFilterSelect = (option) => {
    console.log("Filter selected:", option);
  };

  // Filter employees first
  const filteredData = employees.filter((member) => {
    let matchesFilter = true;
    if (activeFilter === "Active") {
      matchesFilter = member.employeeStatus !== "InActive";
    } else if (activeFilter === "Inactive") {
      matchesFilter = member.employeeStatus === "InActive";
    }

    const matchesSearch =
      (member.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.emailId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.role || "").toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Pagination: compute total pages (minimum 1 so UI behaves like ClientsTable)
  const totalPages = Math.max(1, Math.ceil((filteredData.length || 0) / itemsPerPage));

  // Reset to first page when filters/search/list length change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, employees.length]); // <-- removed filteredData.length here

  // Ensure currentPage stays within bounds and derive a safe page for slicing
  const currentPageSafe = Math.max(1, Math.min(currentPage, totalPages));
  useEffect(() => {
    if (currentPage !== currentPageSafe) setCurrentPage(currentPageSafe);
  }, [currentPageSafe]); // ensure state sync if bounds changed externally

  // If filteredData becomes empty, ensure we are on page 1
  useEffect(() => {
    if ((filteredData || []).length === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filteredData.length, currentPage]);

  const startIndex = (currentPageSafe - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Debug: show pagination & filter state in console to help diagnose UI issues
  useEffect(() => {
    // small delay so logs reflect the latest state after renders
    const id = setTimeout(() => {
      console.debug("TeamMembersTable pagination debug:", {
        activeFilter,
        searchTerm,
        employeesCount: employees.length,
        filteredCount: filteredData.length,
        itemsPerPage,
        totalPages,
        currentPage,
        currentPageSafe,
        paginatedCount: paginatedData.length,
        startIndex
      });
    }, 0);
    return () => clearTimeout(id);
  }, [activeFilter, searchTerm, employees.length, filteredData.length, currentPage, currentPageSafe]);

  // Helper to format assignedProjects for display with company names
  const getProjectsDisplay = (assignedProjects) => {
    if (!assignedProjects) {
      return { main: "No Projects", description: "Not assigned" };
    }

    if (Array.isArray(assignedProjects)) {
      if (assignedProjects.length === 0) {
        return { main: "No Projects", description: "Not assigned" };
      }
      
      // Map project IDs to company names
      const projectNames = assignedProjects
        .map(projectId => {
          // Handle both object and string IDs
          const id = typeof projectId === 'object' && projectId !== null ? projectId._id : projectId;
          const client = clients.find(c => c._id === id);
          return client ? (client.clientName || client.companyName || "Unknown") : null;
        })
        .filter(name => name !== null);
      
      if (projectNames.length === 0) {
        return { main: "No Projects", description: "Not assigned" };
      }
      
      const main = projectNames[0];
      const description =
        projectNames.length > 1
          ? `+${projectNames.length - 1} more projects`
          : "Single project assigned";
      return { main, description };
    }

    // If it's a string or other primitive, try to find the company name
    const id = typeof assignedProjects === 'object' && assignedProjects !== null ? assignedProjects._id : assignedProjects;
    const client = clients.find(c => c._id === id);
    const companyName = client ? (client.clientName || client.companyName || "Unknown") : String(assignedProjects);
    return { main: companyName, description: "Project assigned" };
  };

  // Inline top banners
  const inlineBanner = (
    <>
      {loading && employees.length > 0 && (
        <div className={styles["refresh-banner"]}>
          Refreshing employees...
        </div>
      )}
      {error && (
        <div className={styles["error-banner"]}>
          <span>{error}</span>
          <button onClick={fetchEmployees} className={styles["retry-button"]}>Retry</button>
        </div>
      )}
    </>
  );

  return (
    <div className={styles["clients-table-container"]}>
      {inlineBanner}
      <div className={styles["table-header-section"]}>
        <div className={styles["table-title-section"]}>
          <h2 className={styles["table-title"]}>Team Members</h2>
          <div className={styles["action-buttons"]}>
            {selectedEmployeeIds.length > 0 && (
              <button 
                className={`${styles["secondary-button"]} ${styles["delete-btn"]}`}
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Delete Selected ({selectedEmployeeIds.length})
              </button>
            )}
            <button className={styles["primary-button"]} onClick={handleAddEmployee}>
              Add Employee
              <UserPlusIcon />
            </button>
          </div>
        </div>
        <div className={styles["controls-section"]}>
          <div className={styles["segmented-control"]}>
            <button
              className={`${styles["toggle-button"]} ${activeFilter === "All" ? styles["active-all"] : ""}`}
              onClick={() => setActiveFilter("All")}
            >
              All
            </button>
            <button
              className={`${styles["toggle-button"]} ${activeFilter === "Active" ? styles["active"] : ""}`}
              onClick={() => setActiveFilter("Active")}
            >
              Active
            </button>
            <button
              className={`${styles["toggle-button"]} ${activeFilter === "Inactive" ? styles["active"] : ""}`}
              onClick={() => setActiveFilter("Inactive")}
            >
              Inactive
            </button>
          </div>
          <div className={styles["search-and-filter"]}>
            <div className={styles["search-container"]}>
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles["search-input"]}
              />
              <SearchIcon />
            </div>
            <button
              ref={filterButtonRef}
              className={styles["filter-button"]}
              onClick={handleFilterClick}
            >
              {/* <FilterIcon /> */}
            </button>
          </div>
        </div>
      </div>
      
                {filteredData.length === 0 ? (
        <div className={styles["empty-state"]}>
          <p>No employees found.</p>
          {searchTerm && (
            <p className={styles["empty-state-hint"]}>
              Try adjusting your search criteria.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className={styles["table-section"]}>
            <div className={styles["table-wrapper"]}>
              <div className={styles["table-columns"]}>
                {/* Checkbox Column */}
                <div className={`${styles["table-column"]} ${styles["checkbox-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}>
                      <div className={styles["header-content-center"]}>
                        <label className={styles["checkbox-label"]}>
                          <input
                            type="checkbox"
                            className={styles["hidden-checkbox"]}
                            onChange={handleSelectAll}
                            checked={paginatedData.length > 0 && selectedEmployeeIds.length === paginatedData.length}
                          />
                          <span className={styles["custom-checkbox"]}></span>
                        </label>
                      </div>
                    </div>
                  </div>
                  {paginatedData.map((member) => (
                    <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["checkbox-cell"]}`}>
                      <label className={styles["checkbox-label"]}>
                        <input
                          type="checkbox"
                          className={styles["hidden-checkbox"]}
                          checked={selectedEmployeeIds.includes(member._id || member.id)}
                          onChange={() => handleSelectEmployee(member._id || member.id)}
                        />
                        <span className={styles["custom-checkbox"]}></span>
                      </label>
                    </div>
                  ))}
                </div>

                {/* S.No Column */}
                <div className={`${styles["table-column"]} ${styles["s-no-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}>
                      <div className={styles["header-content-center"]}>
                        <span className={styles["header-text"]}>S.No</span>
                      </div>
                    </div>
                  </div>
                  {paginatedData.map((member, index) => (
                    <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["s-no-cell"]}`}>
                      {(currentPageSafe - 1) * itemsPerPage + index + 1}
                    </div>
                  ))}
                </div>

                {/* Employee Name Column */}
                <div className={`${styles["table-column"]} ${styles["company-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}>
                      <div className={styles["header-content"]}>
                        <span className={styles["header-text"]}>Employee Name</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {paginatedData.map((member) => (
                    <Link  
                      key={member._id || member.id} 
                      to={`/teammanagement_salesleads/${member._id || member.id}`} 
                      className={`${styles["table-cell"]} ${styles["company-cell"]} ${styles["no-link-style"]}`}
                    >
                      <div className={styles["avatar"]}>
                    {member.profilePhoto ? (
                      <img
                        src={`${config.API_BASE_URL.replace('/api', '')}${member.profilePhoto}`}
                        alt={`${member.companyName} profile`}
                        className={styles["client-profile-image"]}
                      />
                    ) : (
                      <div className={styles["avatar"]}>
                        {member.employeeName ? member.employeeName.charAt(0).toUpperCase() : 'E'}
                      </div>
                          )}
                       </div>
                      <div className={styles["companyinfo"]}>
                        <div className={styles["company-name"]}>{member.employeeName || 'Unknown'}</div>
                        <div className={styles["company-email"]}>{member.role || 'No Role'}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {/* employeeStatus Column */}
                <div className={`${styles["table-column"]} ${styles["type-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}>
                      <div className={styles["header-content"]}>
                        <span className={styles["header-text"]}>Status</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {paginatedData.map((member) => (
                    <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["type-cell"]}`}>
                      <div className={`${styles["type-chip"]} ${styles[(member.employeeStatus || 'active').toLowerCase().replace(' ', '')] || ''}`}>
                        <span className={styles["chip-text"]}>{member.employeeStatus || 'Active'}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Email Column */}
                <div className={`${styles["table-column"]} ${styles["assigned-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}>
                      <div className={styles["header-content"]}>
                        <span className={styles["header-text"]}>Email ID</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {paginatedData.map((member) => (
                    <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["assigned-cell"]}`}>
                      <div className={styles["assigned-info"]}>
                        <div className={styles["assigned-name"]}>{member.emailId || 'No Email'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Phone Number Column */}
                <div className={`${styles["table-column"]} ${styles["categories-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}>
                      <div className={styles["header-content"]}>
                        <span className={styles["header-text"]}>Phone Number</span>
                      </div>
                    </div>
                  </div>
                  {paginatedData.map((member) => (
                    <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["categories-cell"]}`}>
                      <div className={styles["category-info"]}>
                        <div className={styles["category-text"]}>{member.mobile || 'No Phone'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Assigned Project Column */}
                <div className={`${styles["table-column"]} ${styles["phone-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}>
                      <div className={styles["header-content"]}>
                        <span className={styles["header-text"]}>Assigned Project</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {paginatedData.map((member) => {
                    const projectDisplay = getProjectsDisplay(member.assignedProjects);
                    return (
                      <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["phone-cell"]}`}>
                        <div className={styles["phone-info"]}>
                          <div className={styles["phone-text"]}>{projectDisplay.main}</div>
                          <div className={styles["company-email"]}>{projectDisplay.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Edit Actions Column */}
                <div className={`${styles["table-column"]} ${styles["edit-actions-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}></div>
                  </div>
                  {paginatedData.map((member) => (
                    <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["edit-actions-cell"]}`}>
                      <button
                        className={`${styles["action-button"]} ${styles["edit-button"]}`}
                        onClick={() => handleEdit(member)}
                        aria-label="Edit team member"
                      >
                        <EditIcon />
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Delete Actions Column */}
                <div className={`${styles["table-column"]} ${styles["delete-actions-column"]}`}>
                  <div className={styles["table-header"]}>
                    <div className={styles["table-header-cell"]}></div>
                  </div>
                  {paginatedData.map((member) => (
                    <div key={member._id || member.id} className={`${styles["table-cell"]} ${styles["delete-actions-cell"]}`}>
                      <button
                        className={`${styles["action-button"]} ${styles["delete-button"]}`}
                        onClick={() => handleDelete(member)}
                        aria-label="Delete team member"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Pagination - ALWAYS RENDERED (like in ClientsTable) */}
      <div className={styles["pagination-section"]} aria-hidden={filteredData.length === 0}>
        <button
          className={styles["pagination-button"]}
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPageSafe === 1 || filteredData.length === 0}
          aria-label="Previous page"
        >
          <span>Previous</span>
        </button>

        <span className={styles["page-info"]} aria-live="polite">
          Page {currentPageSafe} of {totalPages}
        </span>

        <button
          className={styles["pagination-button"]}
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPageSafe === totalPages || filteredData.length === 0}
          aria-label="Next page"
        >
          <span>Next</span>
        </button>
      </div>
      
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={memberToDelete ? `Delete ${memberToDelete.employeeName}?` : `Delete ${selectedEmployeeIds.length} employees?`}
        description={memberToDelete 
          ? `Are you sure you want to delete ${memberToDelete.employeeName}? This action cannot be undone.` 
          : `Are you sure you want to delete these ${selectedEmployeeIds.length} employees? This action cannot be undone.`}
      />
      
      <AddEmployeeModal
        isOpen={isAddEmployeeModalOpen}
        onClose={handleAddEmployeeClose}
        onSubmit={handleAddEmployeeSubmit}
      />

      <EditEmployeeModal
        isOpen={isEditEmployeeModalOpen}
        onClose={handleEditEmployeeClose}
        onSubmit={handleEditEmployeeSubmit}
        employee={employeeToEdit}
      />

      <FilterDropdown
        isOpen={isFilterDropdownOpen}
        onClose={handleFilterDropdownClose}
        onFilterSelect={handleFilterSelect}
        position={dropdownPosition}
      />
    </div>
  );
}

export default TeamMembersTable;
