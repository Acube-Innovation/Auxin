import React, { useState, useEffect } from "react";
import styles from "./ClientsTable.module.css";
import DeleteModal from "../delete-modal/DeleteModal";
import AddClientModal from "./AddClientModal";
import EditClientModal from "./EditClientModal";
import { Link } from "react-router-dom";
import clientService from "../../services/ClientService";
import config from "../../config/config";
import plus from "../../assets/dashboard/plus.svg";
import ImportCsvModal from "./ImportCsvModal";
import { useToast } from "../../context/ToastContext";
import { Alert } from "react-bootstrap";

// SVG Components
const UserPlusIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles.buttonIcon}
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

const SettingsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles.buttonIcon}
  >
    <path
      d="M20.5547 7H11.5547M14.5547 17H5.55469M14.5547 17C14.5547 18.6569 15.8978 20 17.5547 20C19.2115 20 20.5547 18.6569 20.5547 17C20.5547 15.3431 19.2115 14 17.5547 14C15.8978 14 14.5547 15.3431 14.5547 17ZM10.5547 7C10.5547 8.65685 9.21154 10 7.55469 10C5.89783 10 4.55469 8.65685 4.55469 7C4.55469 5.34315 5.89783 4 7.55469 4C9.21154 4 10.5547 5.34315 10.5547 7Z"
      stroke="#007AFF"
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
    className={styles.searchIcon}
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

const SortIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles.sortIcon}
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
    className={styles.editIcon}
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
    className={styles.deleteIcon}
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

function ClientsTable() {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const activeSearchField = "company-name";
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [clientsData, setClientsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClientType, setSelectedClientType] = useState("");
  const [selectedIndustryType, setSelectedIndustryType] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importErrorDetails, setImportErrorDetails] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Fetch clients data from backend (moved out so callers can reuse)
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const clients = await clientService.getClients();
      // server returns array
      setClientsData(Array.isArray(clients) ? clients : (clients.clients || []));
      setError(null);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err.message || "Failed to fetch clients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleEdit = (id) => {
    const client = clientsData.find((c) => c._id === id);
    if (client) {
      setClientToEdit(client);
      setIsEditClientModalOpen(true);
    }
  };

  const handleDelete = (id) => {
    const client = clientsData.find((c) => c._id === id);
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (clientToDelete) {
        await clientService.deleteClient(clientToDelete._id);
        setClientsData((prevClients) =>
          prevClients.filter((client) => client._id !== clientToDelete._id)
        );
        showToast("Client deleted successfully.", 'success');
      } else if (selectedClientIds.length > 0) {
        await clientService.bulkDeleteClients(selectedClientIds);
        setClientsData((prevClients) =>
          prevClients.filter((client) => !selectedClientIds.includes(client._id))
        );
        setSelectedClientIds([]);
        showToast(`${selectedClientIds.length} clients deleted successfully.`, 'success');
      }
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (err) {
      console.error("Error deleting client:", err);
      // Show the reason as a toast and keep the table (setError would replace the whole table)
      showToast(err.message || "Failed to delete client.", 'error');
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    }
  };

  const handleBulkDelete = () => {
    setClientToDelete(null);
    setIsDeleteModalOpen(true);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = pagedData.map((c) => c._id);
      // Add current page IDs to selection (avoiding duplicates)
      setSelectedClientIds((prev) => [...new Set([...prev, ...allIds])]);
    } else {
      // Remove current page IDs from selection
      const pageIds = new Set(pagedData.map((c) => c._id));
      setSelectedClientIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectRow = (id) => {
    setSelectedClientIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setClientToDelete(null);
  };

  const handleAddClient = () => {
    setIsAddClientModalOpen(true);
  };

  const handleAddClientClose = () => {
    setIsAddClientModalOpen(false);
  };

  const handleAddClientSubmit = async (formData) => {
    try {
      // The modal's onSubmit now returns the newly created client
      // Add optimistically to local state
      setClientsData((prevClients) => [formData, ...prevClients]);
      setIsAddClientModalOpen(false);

      // Refresh authoritative list from server to ensure consistency
      await fetchClients();

      // Show success notification
      showToast(`${formData.companyName} has been successfully added.`, 'success');
    } catch (err) {
      console.error("Error creating client:", err);
      setError(err.message || "Failed to create client");
      // if the add fails, we should probably re-fetch to get back to a consistent state
      fetchClients();
      showToast("Client added, but failed to refresh list.", 'warning');
    }
  };

  const handleEditClientClose = () => {
    setIsEditClientModalOpen(false);
    setClientToEdit(null);
  };

  const handleEditClientSubmit = async (updatedClient) => {
    try {
      setClientsData((prevClients) =>
        prevClients.map((client) =>
          client._id === updatedClient._id ? updatedClient : client
        )
      );
      setIsEditClientModalOpen(false);
      setClientToEdit(null);
      showToast("Client updated successfully.", 'success');
    } catch (err) {
      console.error("Error updating client:", err);
      setError(err.message || "Failed to update client");
      showToast("Failed to update client.", 'error');
    }
  };

  const clientTypeOptions = Array.from(
    new Set(
      clientsData
        .map((client) => (client?.clientType != null ? String(client.clientType).trim() : ""))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const industryTypeOptions = Array.from(
    new Set(
      clientsData
        .map((client) => (client?.industryType != null ? String(client.industryType).trim() : ""))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredData = clientsData.filter((client) => {
    let matchesFilter = true;
    const leadTypeRaw = (client.leadType || "").toString().trim().toLowerCase();
    const relationshipRaw = (client.relationshipStatus || "").toString().trim().toLowerCase();
    const currentStatusRaw =
      typeof client.currentStatus === "string"
        ? client.currentStatus.trim().toLowerCase()
        : "";

    if (activeFilter === "Clients") {
      // Match explicit leadType "Client" (case-insensitive). When leadType is
      // not set on legacy records, fall back to relationshipStatus/currentStatus
      // signals that indicate an active client relationship.
      matchesFilter =
        leadTypeRaw === "client" ||
        (!leadTypeRaw &&
          (relationshipRaw === "active" ||
            relationshipRaw === "dormant" ||
            currentStatusRaw === "won"));
    } else if (activeFilter === "Leads") {
      // Match explicit leadType "Lead" (case-insensitive). When leadType is
      // not set on legacy records, fall back to status signals indicating a
      // lead/prospect (or simply any record that isn't an active client).
      matchesFilter =
        leadTypeRaw === "lead" ||
        (!leadTypeRaw &&
          (relationshipRaw === "prospect" ||
            relationshipRaw === "lost" ||
            ["lead", "quoted", "negotiation", "lost"].includes(currentStatusRaw) ||
            (relationshipRaw === "" && currentStatusRaw === "")));
    }


    // Apply searchTerm based on the selected field
    const term = (searchTerm || "").toLowerCase();
    let matchesSearch = true;
    if (term.trim() !== "") {
      switch (activeSearchField) {
        case "company-name": {
          matchesSearch =
            (client.companyName || "").toLowerCase().includes(term) ||
            (client.email || "").toLowerCase().includes(term) ||
            (client.createdByUsername || "").toLowerCase().includes(term);
          break;
        }
        case "phone-number": {
          matchesSearch =
            (client.mobile || "").toLowerCase().includes(term) ||
            (client.phone || "").toLowerCase().includes(term);
          break;
        }
        case "assigned-to": {
          // The UI currently shows Lead Status in the "Assigned" column.
          // Try matching against currentStatus, assignedRole, or assignedTo if available.
          const assignedToLabel =
            typeof client.assignedTo === "string"
              ? client.assignedTo
              : (client.assignedTo && (client.assignedTo.username || client.assignedTo.employeeName)) || "";
          matchesSearch =
            (client.currentStatus || "").toLowerCase().includes(term) ||
            (client.assignedRole || "").toLowerCase().includes(term) ||
            (assignedToLabel || "").toLowerCase().includes(term);
          break;
        }
        case "categories": {
          matchesSearch = (client.category || "").toLowerCase().includes(term);
          break;
        }
        case "type": {
          matchesSearch =
            (client.leadType || "").toLowerCase().includes(term) ||
            (client.relationshipStatus || "").toLowerCase().includes(term);
          break;
        }
        case "added-on": {
          // Match against createdAt date string if present
          const createdAt = client.createdAt ? new Date(client.createdAt) : null;
          const createdStrISO = createdAt ? createdAt.toISOString().slice(0, 10) : ""; // YYYY-MM-DD
          const createdStrLocal = createdAt ? createdAt.toLocaleDateString() : "";
          matchesSearch =
            createdStrISO.toLowerCase().includes(term) ||
            createdStrLocal.toLowerCase().includes(term);
          break;
        }
        default: {
          // Fallback: search company and email
          matchesSearch =
            (client.companyName || "").toLowerCase().includes(term) ||
            (client.email || "").toLowerCase().includes(term);
        }
      }
    }

    const matchesClientType =
      !selectedClientType ||
      (client.clientType || "").toLowerCase() === selectedClientType.toLowerCase();
    const matchesIndustryType =
      !selectedIndustryType ||
      (client.industryType || "").toLowerCase() === selectedIndustryType.toLowerCase();

    return matchesFilter && matchesSearch && matchesClientType && matchesIndustryType;
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pagedData = filteredData.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  // Reset to first page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, selectedClientType, selectedIndustryType, clientsData.length]);

  const triggerImport = () => {
    console.log("Import button clicked, opening modal");
    setImportError("");
    setImportErrorDetails([]);
    setIsImportModalOpen(true);
  };

  // handle modal result: refresh authoritative list so new server IDs/fields appear
  const formatImportErrorLine = (err) => {
    if (err == null) return "";
    if (typeof err === "string") return err;
    if (typeof err === "object") {
      const rowPart = err.row != null ? `Row ${err.row}: ` : "";
      const reason = String(
        err.reason || err.message || (err.error ? err.error : "")
      ).trim();
      const extra =
        err.rowData &&
          (err.rowData.companyName || err.rowData.email)
          ? ` — ${(err.rowData.companyName || "").trim()} ${(
            err.rowData.email || ""
          ).trim()}`.trim()
          : "";
      const line = `${rowPart}${reason}${extra}`.trim();
      return line || JSON.stringify(err);
    }
    return String(err);
  };

  const formatImportErrorDisplay = (line) => {
    const text = String(line || "").trim();
    const rowMatch = text.match(/^Row\s+(\d+):\s*(.*)$/i);
    if (!rowMatch) {
      return { rowLabel: "", message: text };
    }
    return {
      rowLabel: `Row ${rowMatch[1]}`,
      message: rowMatch[2] || "",
    };
  };

  const handleImportComplete = async (importedClients = [], importErrors = []) => {
    try {
      await fetchClients();
      if (importErrors && importErrors.length > 0) {
        const lines = importErrors.map(formatImportErrorLine).filter(Boolean);
        setImportError("Some rows could not be imported:");
        setImportErrorDetails(lines);
        // Keep modal open so row-level error details remain visible to user.
        setIsImportModalOpen(true);
      } else {
        setImportError("");
        setImportErrorDetails([]);
        // Auto-close only when everything imported successfully.
        setIsImportModalOpen(false);
      }
    } catch (e) {
      console.error("Error refreshing after import:", e);
      setImportError("Import completed but failed to refresh list. Try refreshing page.");
      setImportErrorDetails([]);
      // Keep modal open so user can retry or inspect current import state.
      setIsImportModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.clientsTableContainer}>
        <div className={styles.loadingState}>Loading clients...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.clientsTableContainer}>
        <div className={styles.errorState}>
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.clientsTableContainer}>
      <div className={styles.tableHeaderSection}>
        <div className={styles.tableTitleSection}>
          <h2 className={styles.tableTitle}>Clients and Leads</h2>
          <div className={styles.actionButtons}>
            {selectedClientIds.length > 0 && (
              <button
                className={`${styles.deleteButton} ${styles.bulkDeleteButton}`}
                onClick={handleBulkDelete}
              >
                <DeleteIcon />
                <span>Delete ({selectedClientIds.length})</span>
              </button>
            )}
            <button className={styles.primaryButton} onClick={triggerImport} disabled={isImporting}>
              <div className={styles.addClientButtonText}>Import</div>
              <img src={plus} className={styles.image3} alt="plus" />
            </button>
            <button className={styles.primaryButton} onClick={handleAddClient}>
              <div className={styles.addClientButtonText}>Add Client/Lead</div>
              <UserPlusIcon />
            </button>
            {/* <button className={styles.secondaryButton}>
              <div className={styles.addClientButtonText}>Manage Categories</div>
              <SettingsIcon />
            </button> */}
          </div>
        </div>

        <div className={styles.controlsSection}>
          <div className={styles.segmentedControl}>
            <button
              className={`${styles.toggleButton} ${activeFilter === "All" ? styles.activeAll : ""
                }`}
              onClick={() => setActiveFilter("All")}
            >
              All
            </button>
            <button
              className={`${styles.toggleButton} ${activeFilter === "Clients" ? styles.active : ""
                }`}
              onClick={() => setActiveFilter("Clients")}
            >
              Clients
            </button>
            <button
              className={`${styles.toggleButton} ${activeFilter === "Leads" ? styles.active : ""
                }`}
              onClick={() => setActiveFilter("Leads")}
            >
              Leads
            </button>
          </div>

          <div className={styles.searchAndFilter}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <SearchIcon />
            </div>
            <select
              value={selectedClientType}
              onChange={(e) => setSelectedClientType(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">Client Type</option>
              {clientTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={selectedIndustryType}
              onChange={(e) => setSelectedIndustryType(e.target.value)}
              className={`${styles.filterSelect} ${styles.filterSelectIndustry}`}
            >
              <option value="">Industry Type</option>
              {industryTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.tableSection}>
        {importError && (
          <div className={styles.errorState} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{importError}</div>
            {importErrorDetails.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {importErrorDetails.map((line, idx) => {
                  const display = formatImportErrorDisplay(line);
                  return (
                    <li key={`${line}-${idx}`} style={{ marginBottom: 4 }}>
                      {display.rowLabel ? (
                        <>
                          <span style={{ fontWeight: 700 }}>{display.rowLabel}</span>
                          <span>: {display.message}</span>
                        </>
                      ) : (
                        <span>{display.message}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <div className={styles.tableWrapper}>
          <div className={styles.tableColumns}>
            {/* Checkbox Column */}
            <div className={`${styles.tableColumn} ${styles.checkboxColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={`${styles.headerContent} ${styles.headerContentCenter}`}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        className={styles.hiddenCheckbox}
                        onChange={handleSelectAll}
                        checked={pagedData.length > 0 && pagedData.every((c) => selectedClientIds.includes(c._id))}
                      />
                      <span className={styles.customCheckbox}></span>
                    </label>
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.checkboxCell}`}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.hiddenCheckbox}
                      checked={selectedClientIds.includes(client._id)}
                      onChange={() => handleSelectRow(client._id)}
                    />
                    <span className={styles.customCheckbox}></span>
                  </label>
                </div>
              ))}
            </div>

            {/* S.No Column */}
            <div className={`${styles.tableColumn} ${styles.sNoColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={`${styles.headerContent} ${styles.headerContentCenter}`}>
                    <span className={styles.headerText}>S.No</span>
                  </div>
                </div>
              </div>
              {pagedData.map((client, index) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.sNoCell}`}>
                  {(currentPageSafe - 1) * pageSize + index + 1}
                </div>
              ))}
            </div>

            {/* Company Name Column */}
            <div className={`${styles.tableColumn} ${styles.companyColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Company Name</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <Link
                  key={client._id}
                  to={`/salesandleadsclient/${client._id}`}
                  className={`${styles.tableCell} ${styles.companyCell} ${styles.noLinkStyle}`}
                >
                  <div className={styles.avatar}>
                    {client.profilePicture ? (
                      <img
                        src={`${config.API_BASE_URL.replace('/api', '')}${client.profilePicture}`}
                        alt={`${client.companyName} profile`}
                        className={styles.clientProfileImage}
                      />
                    ) : (
                      <div className={styles.defaultAvatar}>
                        {client.companyName?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                    )}
                  </div>
                  <div className={styles.companyinfo}>
                    <div className={styles.companyName}>{client.companyName}</div>
                    <div className={styles.companyEmail}>{client.email}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Type Column */}
            <div className={`${styles.tableColumn} ${styles.typeColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Lead Type</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.typeCell}`}>
                  <div
                    className={`${styles.typeChip} ${styles[(
                      client.leadType ||
                      client.relationshipStatus ||
                      ""
                    )
                      .toLowerCase()
                      .replace(" ", "")]}`}
                  >
                    <span className={styles.chipText}>
                      {client.leadType || client.relationshipStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Assigned To Column */}
            <div className={`${styles.tableColumn} ${styles.assignedColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Lead Status</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.assignedCell}`}>
                  <div className={styles.assignedInfo}>
                    {/* display name or fallback */}
                    {/* <div className={styles.assignedName}>
                      {client.assignedTo && client.assignedTo.employeeName ? client.assignedTo.employeeName : (client.assignedTo?.username || client.assignedTo || 'Unassigned')}
                    </div> */}
                    <div className={styles.assignedName}>
                      {client.currentStatus && client.currentStatus.employeeName ? client.currentStatus.employeeName : (client.currentStatus?.username || client.currentStatus || 'Unassigned')}
                    </div>
                    <div className={styles.assignedRole}>{client.assignedRole || ''}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Categories Column */}
            <div className={`${styles.tableColumn} ${styles.categoriesColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Categories</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.categoriesCell}`}>
                  <div className={styles.categoryInfo}>
                    <div className={styles.categoryText}>{client.category || ''}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone Number Column */}
            <div className={`${styles.tableColumn} ${styles.phoneColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Phone Number</span>
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.phoneCell}`}>
                  <div className={styles.phoneInfo}>
                    <div className={styles.phoneText}>
                      {client.mobile || client.phone || "Not provided"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Created By Column */}
            <div className={`${styles.tableColumn} ${styles.createdByColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Created By</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.createdByCell}`}>
                  <div className={styles.createdByInfo}>
                    <div className={styles.createdByName}>
                      {client.createdByUsername || 'Unknown'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Actions Column */}
            <div className={`${styles.tableColumn} ${styles.editActionsColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}></div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.editActionsCell}`}>
                  <button
                    className={`${styles.actionButton} ${styles.editButton}`}
                    onClick={() => handleEdit(client._id)}
                    aria-label="Edit client"
                  >
                    <EditIcon />
                  </button>
                </div>
              ))}
            </div>

            {/* Delete Actions Column */}
            <div className={`${styles.tableColumn} ${styles.deleteActionsColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}></div>
              </div>
              {pagedData.map((client) => (
                <div
                  key={client._id}
                  className={`${styles.tableCell} ${styles.deleteActionsCell}`}
                >
                  <button
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    onClick={() => handleDelete(client._id)}
                    aria-label="Delete client"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.paginationSection}>
        <button className={styles.paginationButton} onClick={goPrev} disabled={currentPageSafe <= 1}>
          <span>Previous</span>
        </button>
        <span className={styles.pageInfo}>
          Page {currentPageSafe} of {totalPages}
        </span>
        <button className={styles.paginationButton} onClick={goNext} disabled={currentPageSafe >= totalPages}>
          <span>Next</span>
        </button>
      </div>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={clientToDelete ? `Delete ${clientToDelete?.companyName}?` : `Delete ${selectedClientIds.length} Clients?`}
        description={clientToDelete ? `Are you sure you want to delete ${clientToDelete?.companyName}? This action cannot be undone.` : `Are you sure you want to delete these ${selectedClientIds.length} clients? This action cannot be undone.`}
      />

      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={handleAddClientClose}
        onSubmit={handleAddClientSubmit}
      />

      <EditClientModal
        isOpen={isEditClientModalOpen}
        onClose={handleEditClientClose}
        onSubmit={handleEditClientSubmit}
        clientData={clientToEdit}
      />

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportCsvModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  );
}

export default ClientsTable;