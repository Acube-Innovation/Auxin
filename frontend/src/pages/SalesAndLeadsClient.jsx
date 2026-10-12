import React, { useState, useRef, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./SalesAndLeadsClient.module.css";
import Side from "./sidebar/Sidebar";

import Documents from "../components/sales-and-leads/Documents";
import DocumentsService from "../services/DocumentsService";
import { exportClientBasicInfo, exportEvents, exportDocuments, exportTasks, exportToPDF, exportToTXT } from "../utils/exportUtils";
import { getTasksByClient } from "../services/TaskService";
import Calendar from "../components/sales-and-leads/CalendarComponent";
import DeleteModal from "../components/delete-modal/DeleteModal";
import CreateEventModal from "../components/sales-and-leads/CreateEventModal";
import CreateTaskModal from "../components/sales-and-leads/CreateTaskModal";
import EditClientModal from "../components/sales-and-leads/EditClientModal";
import FileUploadModal from "../components/FileUploadModal";
import DropDownList from "../components/DropDownList";
import TaskBoard from "../components/sales-and-leads/TaskBoard";
import clientService from "../services/ClientService"; // Import your client service
import config from "../config/config";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import belldot from "../assets/dashboard/bell-dot.svg";
import admindemo from "../assets/dashboard/admin-demo.jpg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import plus from "../assets/dashboard/plus.svg";
import arrowleft from "../assets/dashboard/arrow-left.svg";
import maersksymbol from "../assets/dashboard/maersk_symbol.svg";
import pencillineblue from "../assets/dashboard/pencil-line-blue.svg";
import upload from "../assets/dashboard/upload.svg";
import deletewhite from "../assets/dashboard/delete-white.svg";
import ProfileAvatar from "../components/ProfileAvatar";
import { io as ioClient } from 'socket.io-client';
import NotificationBell from "../components/NotificationBell";

function SalesAndLeadsClient(clientId ) {
  const [activeTab, setActiveTab] = useState("basicInfo");
  const basicInfoRef = useRef(null);
  const meetingsRef = useRef(null);
  const documentsRef = useRef(null);
  const tasksRef = useRef(null);
  const remarksRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [remarks, setRemarks] = useState([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const [addingRemark, setAddingRemark] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(""); // 'entry' or 'data'
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [clientData, setClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const exportButtonRef = useRef(null);
  const navigate = useNavigate();
  const { id } = useParams(); // Get the client ID from URL params
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [calendarKey, setCalendarKey] = useState(0); // Force calendar refresh
  const [documentsKey, setDocumentsKey] = useState(0); // Force documents refresh
  const taskBoardRefreshRef = useRef(null); // Reference to TaskBoard refresh function
  const { showToast } = useToast();

   const [username, setUsername] = useState("");
   const [userRole, setUserRole] = useState("");
      useEffect(() => {
        setUsername(localStorage.getItem("username") || "");
        setUserRole(localStorage.getItem("role") || "");
      }, []);

  const handleAuthFailure = React.useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
  }, [navigate]);

  // Fetch client data when component mounts
  useEffect(() => {
    const fetchClientData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const client = await clientService.getClient(id);
        setClientData(client);
        setError(null);
      } catch (err) {
        console.error("Error fetching client:", err);
        const msg = err.message || "";
        if (msg.includes("401") || msg.includes("Invalid token") || msg.includes("Token expired") || msg.includes("No token provided")) {
          handleAuthFailure();
          return;
        }
        setError(msg || "Failed to fetch client data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientData();
  }, [id, handleAuthFailure]);

  // Main useEffect for tab indicator positioning
  useEffect(() => {
    const updateIndicatorPosition = () => {
      let activeElement;
      switch (activeTab) {
        case "basicInfo":
          activeElement = basicInfoRef.current;
          break;
        case "meetings":
          activeElement = meetingsRef.current;
          break;
        case "documents":
          activeElement = documentsRef.current;
          break;
        case "tasks":
          activeElement = tasksRef.current;
          break;
        case "remarks":
          activeElement = remarksRef.current;
          break;
        default:
          activeElement = basicInfoRef.current;
      }

      if (activeElement) {
        const rect = activeElement.getBoundingClientRect();
        const containerRect =
          activeElement.parentElement.getBoundingClientRect();
        setIndicatorStyle({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    updateIndicatorPosition();
    window.addEventListener("resize", updateIndicatorPosition);

    return () => {
      window.removeEventListener("resize", updateIndicatorPosition);
    };
  }, [activeTab]);

  const fetchRemarks = React.useCallback(async () => {
    if (!id) return;
    setRemarksLoading(true);
    setRemarkError("");
    try {
      const data = await clientService.getClientRemarks(id);
      setRemarks(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("401") || msg.includes("Invalid token") || msg.includes("Token expired") || msg.includes("No token provided")) {
        handleAuthFailure();
        return;
      }
      setRemarkError(msg || "Failed to load remarks");
      setRemarks([]);
    } finally {
      setRemarksLoading(false);
    }
  }, [id, handleAuthFailure]);

  useEffect(() => {
    if (activeTab === "remarks" && id) fetchRemarks();
  }, [activeTab, id, fetchRemarks]);

  const handleAddRemark = async (e) => {
    e.preventDefault();
    const trimmed = (remarkText || "").trim();
    if (!trimmed) {
      setRemarkError("Remark cannot be empty");
      return;
    }
    setRemarkError("");
    setAddingRemark(true);
    try {
      const created = await clientService.addClientRemark(id, trimmed);
      setRemarks((prev) => [created, ...prev]);
      setRemarkText("");
      showToast?.("Remark added successfully", "success");
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("401") || msg.includes("Invalid token") || msg.includes("Token expired") || msg.includes("No token provided")) {
        handleAuthFailure();
        return;
      }
      setRemarkError(msg || "Failed to add remark");
      showToast?.(msg || "Failed to add remark", "error");
    } finally {
      setAddingRemark(false);
    }
  };

  // Additional useEffect to handle initial tab indicator positioning after data loads
  useEffect(() => {
    if (clientData && activeTab === "basicInfo") {
      const updateInitialPosition = () => {
        if (basicInfoRef.current) {
          const rect = basicInfoRef.current.getBoundingClientRect();
          const containerRect =
            basicInfoRef.current.parentElement.getBoundingClientRect();
          setIndicatorStyle({
            width: rect.width,
            left: rect.left - containerRect.left,
          });
        }
      };

      // Small delay to ensure DOM is fully rendered
      setTimeout(updateInitialPosition, 200);
    }
  }, [clientData, activeTab]);

  // Socket: join client room and listen for client-specific events
  useEffect(() => {
    if (!id) return;

    const raw = config.API_BASE_URL || '';
    const socketUrl = raw.replace(/\/api\/?$/, '') || window.location.origin;
    const socket = ioClient(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => {
      console.log('Client page socket connected', socket.id);
      // join the client room so we receive client-specific events
      socket.emit('join-client', id);
    });

    // When a client-event is received, refresh the client's events from server
    socket.on('client-event', async (payload) => {
      try {
        console.log('Received client-event for client page:', payload);
        // Re-fetch the client to get canonical events array
        const updatedClient = await clientService.getClient(id);
        if (updatedClient && Array.isArray(updatedClient.events)) {
          setEvents(updatedClient.events);
          // bump calendar key so calendar components refresh
          setCalendarKey(k => k + 1);
        }
      } catch (err) {
        console.error('Failed to refresh client events after client-event:', err);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('Client page socket connect_error', err);
    });

    return () => {
      try { socket.disconnect(); } catch (e) { /* ignore */ }
    };
  }, [id]);

  // Add loading and error states
  if (isLoading) {
    return (
      <div className={styles["dashboard-layout"]}>
                <Side />
        <main>
          <div className={styles.loadingState}>Loading client data...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles["dashboard-layout"]}>
       
        <Side />
      
        <main>
          <div className={styles.errorState}>
            <p>Error: {error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </main>
      </div>
    );
  }
  if (!clientData) {
    return (
      <div className={styles["dashboard-layout"]}>
        <Side />
        <main>
          <div className={styles.errorState}>Client not found</div>
        </main>
      </div>
    );
  }

  const handleDeleteEntry = () => {
    setDeleteType("entry");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteData = () => {
    setDeleteType("data");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (deleteType === "entry") {
        await clientService.deleteClient(id);
        navigate("/salesandleads");
        return; // no further cleanup needed, leaving page
      } else if (deleteType === "data") {
        // Optional: implement bulk document delete for this client in backend later
        // For now, simply refresh documents list key
        setDocumentsKey(prev => prev + 1);
      }
    } catch (e) {
      console.error("Delete failed", e);
      showToast(e.message || "Delete failed", "error");
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteType("");
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeleteType("");
  };

  const handleNewEvent = () => {
    setIsCreateEventModalOpen(true);
  };

  const handleCreateEventClose = () => {
    setIsCreateEventModalOpen(false);
  };

  const handleEventCreated = (newEvent) => {
    console.log("Event created successfully:", newEvent);
    // Force calendar component to refresh by updating its key
    setCalendarKey(prev => prev + 1);
    // You can also update local events state if needed
    setEvents(prev => [...prev, newEvent]);
  };

   const handleNewTask = () => {
    setIsCreateTaskModalOpen(true);
  };

  const handleCreateTaskClose = () => {
    setIsCreateTaskModalOpen(false);
  };

const handleTaskCreated = (newTask) => {
    console.log("Task created successfully:", newTask);
    // Force calendar component to refresh by updating its key
    setCalendarKey(prev => prev + 1);
    // Refresh TaskBoard
    if (taskBoardRefreshRef.current) {
      taskBoardRefreshRef.current();
    }
    // You can also update local events state if needed
    setEvents(prev => [...prev, newTask]);

    // Show success notification
    if (window.appNotifications) {
      window.appNotifications.push({
        type: 'success',
        title: 'Task Created',
        message: `${newTask.title} has been successfully created.`
      });
    }
  };
  

  const handleEditClientClose = () => {
    setIsEditClientModalOpen(false);
  };

  const handleEditClientSubmit = async (updatedClient) => {
    try {
      // Update the client data in local state
      setClientData(updatedClient);
      setIsEditClientModalOpen(false);
    } catch (err) {
      console.error("Error updating client:", err);
      setError(err.message || "Failed to update client");
    }
  };

  const handleFileUpload = () => {
    setIsFileUploadModalOpen(true);
  };

  const handleFileUploadClose = () => {
    setIsFileUploadModalOpen(false);
  };

  const handleFileUploadComplete = async (files) => {
    try {
      if (!id || !files || files.length === 0) return;
      // Upload each file sequentially (could be parallel if desired)
      for (const file of files) {
        await DocumentsService.uploadForClient(id, file, {
          uploadedBy: "Current User",
          userRole: "Sales Executive",
        });
      }
      // Refresh documents tab
      setDocumentsKey(prev => prev + 1);
    } catch (e) {
      console.error("Upload failed", e);
      showToast(e.message || "Upload failed", "error");
    } finally {
      setIsFileUploadModalOpen(false);
    }
  };

  const handleExportClick = (event) => {
    if (exportButtonRef.current) {
      const rect = exportButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  const handleExportOptionSelect = async (option) => {
    try {
      if (activeTab === "basicInfo") {
        if (option === "pdf") return exportToPDF();
        if (option === "txt") return exportToTXT(JSON.stringify(clientData, null, 2), `${clientData?.companyName || 'client'}_basic_info.txt`);
        // default to CSV for csv
        return exportClientBasicInfo(clientData);
      }

      if (activeTab === "meetings") {
        // Fetch client events from backend
        const token = localStorage.getItem('token');
        const resp = await fetch(`${config.API_BASE_URL}/api/clients/${id}/events`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        const events = resp.ok ? await resp.json() : [];
        // Map events for export utility shape
        const mapped = (events || []).map(e => ({
          title: e.eventName || e.title,
          date: e.date,
          time: e.time,
          eventType: e.eventType,
          notes: e.notes,
          link: e.link,
          assignedTeamMember: e.assignedTeamMember,
          color: e.color
        }));
        if (option === "pdf") return exportToPDF();
        if (option === "txt") return exportToTXT(JSON.stringify(mapped, null, 2), `${clientData?.companyName || 'client'}_events.txt`);
        return exportEvents(mapped, clientData?.companyName || 'client');
      }

      if (activeTab === "documents") {
        const docs = await DocumentsService.listByClient(id);
        if (option === "pdf") return exportToPDF();
        if (option === "txt") return exportToTXT(JSON.stringify(docs, null, 2), `${clientData?.companyName || 'client'}_documents.txt`);
        return exportDocuments(docs, clientData?.companyName || 'client');
      }

      if (activeTab === "tasks") {
        const tasks = await getTasksByClient(id);
        if (option === "pdf") return exportToPDF();
        if (option === "txt") return exportToTXT(JSON.stringify(tasks, null, 2), `${clientData?.companyName || 'client'}_tasks.txt`);
        return exportTasks(tasks, clientData?.companyName || 'client');
      }
    } catch (e) {
      console.error('Export failed:', e);
      showToast(e.message || 'Export failed', "error");
    } finally {
      setIsDropdownOpen(false);
    }
  };

  // Render different buttons based on active tab
  const renderButtons = () => {
    switch (activeTab) {
      case "basicInfo":
        return (
          <div className={styles.row_view5}>
            <button
              className={`${styles.button_row_view} ${styles.editbutton}`}
              onClick={() => setIsEditClientModalOpen(true)}
            >
              <span className={`${styles.text3} ${styles.editbuttontext}`}>
                Edit Data
              </span>
              <img src={pencillineblue} className={styles.image3} alt="edit" />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="export" />
            </button>
            <button
              className={styles.button_row_view3}
              onClick={handleDeleteEntry}
            >
              <span className={styles.text5}>Delete Entry</span>
              <img src={deletewhite} className={styles.image3} alt="delete" />
            </button>
          </div>
        );
      case "meetings":
        return (
          <div className={styles.row_view5}>
            <button className={styles.button_row_view} onClick={handleNewEvent}>
              <span className={styles.text3}>New Event</span>
              <img src={plus} className={styles.image3} alt="plus" />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} alt="export" className={styles.image3} />
            </button>
          </div>
        );
      case "documents":
        return (
          <div className={styles.row_view5}>
            <button
              className={styles.button_row_view}
              onClick={handleFileUpload}
            >
              <span className={styles.text3}>Upload</span>
              <img src={plus} className={styles.image3} alt="" />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="" />
            </button>
            <button
              className={styles.button_row_view3}
              onClick={handleDeleteData}
            >
              <span className={styles.text5}>Delete All</span>
              <img src={deletewhite} alt="delete" className={styles.image3} />
            </button>
          </div>
        );
      case "tasks":
        return (
          <div className={styles.row_view5}>
            <button
              className={styles.button_row_view}
              onClick={handleNewTask}
            >
              <span className={styles.text3}>New Task</span>
              <img src={plus} alt="newtask" className={styles.image3} />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="" />
            </button>
          </div>
        );
      default:
        return null;
    }
  };



  return (
    <div className={styles["dashboard-layout"]}>
     <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Sales & Leads</div>

            <div className={styles["dashboard-profile"]}>
                <NotificationBell/>
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                   <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>
                                          {userRole?.toUpperCase()}
                                        </div>
                  </div>
                </div>
                {/* <img src={chevrondown} alt="" /> */}
              </div>
            </div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-notactive"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div
              className={styles["breadcrumb-notactive"]}
              onClick={() => navigate("/salesandleads")}
              style={{ cursor: "pointer" }}
            >
              Sales and Leads
            </div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-active"]}>
                 {clientData?.companyName || "Client"}
            </div>
          </div>
        </section>

        <div className={styles.contain}>
          <div className={styles.scroll_view}>
            <div className={styles.column}>
              <div className={styles.row_view}>
                <div className={styles.row_view2}>
                  <img
                    src={arrowleft}
                    className={styles.image}
                    alt="Go Back"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(-1)}
                  />
                  <div className={styles.row_view3}>
                    <div className={styles.row_view4}>
                      {clientData.profilePicture ? (
                        <img
                          src={`${config.API_BASE_URL.replace('/api', '')}${clientData.profilePicture}`}
                          className={styles.image2}
                          alt={`${clientData.companyName} logo`}
                        />
                      ) : (
                        <div className={styles.defaultCompanyLogo}>
                          {clientData.companyName?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                      )}
                      <span className={styles.text}>
                        {clientData.companyName || "Client Name"}
                      </span>
                    </div>
                    <button
                      className={styles.button}
                      onClick={() => alert("Pressed!")}
                    >
                      <span className={styles.text2}>{"Lead"}</span>
                    </button>
                  </div>
                </div>
                {renderButtons()}
              </div>

              {/* Tab Navigation */}
              <div className={styles.view}>
                <div className={styles.column2}>
                  <span
                    ref={basicInfoRef}
                    className={`${styles.text6} ${
                      activeTab === "basicInfo" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("basicInfo")}
                  >
                    {"Basic Info"}
                  </span>
                  <span
                    ref={meetingsRef}
                    className={`${styles.text7} ${
                      activeTab === "meetings" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("meetings")}
                  >
                    {"Meetings"}
                  </span>
                  <div
                    ref={documentsRef}
                    className={`${styles.view2} ${
                      activeTab === "documents" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("documents")}
                  >
                    <span className={styles.text8}>{"Documents"}</span>
                  </div>
                  <div
                    ref={tasksRef}
                    className={`${styles.view2} ${
                      activeTab === "tasks" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("tasks")}
                  >
                    <span className={styles.text8}>{"Tasks"}</span>
                  </div>
                  <div
                    ref={remarksRef}
                    className={`${styles.view2} ${
                      activeTab === "remarks" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("remarks")}
                  >
                    <span className={styles.text8}>{"Remarks"}</span>
                  </div>
                  <div
                    className={styles.box}
                    style={{
                      width: `${indicatorStyle.width}px`,
                      left: `${indicatorStyle.left}px`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className={styles.column3}>
   {activeTab === "basicInfo" && (
  <>
    {/* Primary Contact & Company Info */}
    <div className={styles.row_view6}>
      <div className={styles.column4}>
        <span className={styles.text9}>Company Name</span>
        <span className={styles.text10}>
          {clientData.companyName || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Primary Contact Name</span>
        <span className={styles.text10}>
          {clientData.primaryContactName || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Email</span>
        <span className={styles.text10}>
          {clientData.email || "Not provided"}
        </span>
      </div>
      <div className={styles.column5}>
        <span className={styles.text9}>Mobile (Personal)</span>
        <span className={styles.text10}>
          {clientData.mobile || "Not provided"}
        </span>
      </div>
    </div>

    {/* Secondary Contact & Business Type */}
    <div className={styles.row_view6}>
      <div className={styles.column4}>
        <span className={styles.text9}>Phone (Office)</span>
        <span className={styles.text10}>
          {clientData.phone || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Designation</span>
        <span className={styles.text10}>
          {clientData.designation || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Client Type</span>
        <span className={styles.text10}>
          {clientData.clientType || "Not provided"}
        </span>
      </div>
      <div className={styles.column5}>
        <span className={styles.text9}>Lead Type</span>
        <span className={styles.text10}>
          {clientData.leadType || "Not provided"}
        </span>
      </div>
    </div>

    {/* Business Status & Classification */}
    <div className={styles.row_view6}>
      <div className={styles.column4}>
        <span className={styles.text9}>Relationship Status</span>
        <span className={styles.text10}>
          {clientData.relationshipStatus || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Lead Status</span>
        <span className={styles.text10}>
          {clientData.currentStatus || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Follow-up Status</span>
        <span className={styles.text10}>
          {clientData.followupStatus || "Not provided"}
        </span>
      </div>
      <div className={styles.column5}>
        <span className={styles.text9}>Lead Source</span>
        <span className={styles.text10}>
          {clientData.leadSource || "Not provided"}
        </span>
      </div>
    </div>

    {/* Location & Industry */}
    <div className={styles.row_view6}>
      <div className={styles.column4}>
        <span className={styles.text9}>Address</span>
        <span className={styles.text10}>
          {clientData.address || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Country</span>
        <span className={styles.text10}>
          {clientData.country || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Industry Type</span>
        <span className={styles.text10}>
          {clientData.industryType || "Not provided"}
        </span>
      </div>
      <div className={styles.column5}>
        <span className={styles.text9}>Cargo Type</span>
        <span className={styles.text10}>
          {clientData.cargoType || "Not provided"}
        </span>
      </div>
    </div>

    {/* Business Operations */}
    <div className={styles.row_view6}>
      <div className={styles.column4}>
        <span className={styles.text9}>Account Manager</span>
        <span className={styles.text10}>
          {clientData.accountManager || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Decision Maker</span>
        <span className={styles.text10}>
          {clientData.decisionMaker || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Contract Type</span>
        <span className={styles.text10}>
          {clientData.contractType || "Not provided"}
        </span>
      </div>
      <div className={styles.column5}>
        <span className={styles.text9}>Incoterms</span>
        <span className={styles.text10}>
          {clientData.incoterms || "Not provided"}
        </span>
      </div>
    </div>

    {/* Additional Info */}
    <div className={styles.row_view6}>
      <div className={styles.column4}>
        <span className={styles.text9}>Website</span>
        <span className={styles.text10}>
          {clientData.website ? (
            <a href={clientData.website} target="_blank" rel="noopener noreferrer">
              {clientData.website}
            </a>
          ) : (
            "Not provided"
          )}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Tax ID</span>
        <span className={styles.text10}>
          {clientData.taxId || "Not provided"}
        </span>
      </div>
      <div className={styles.column4}>
        <span className={styles.text9}>Category</span>
        <span className={styles.text10}>
          {clientData.category || "Not provided"}
        </span>
      </div>
      <div className={styles.column5}>
        <span className={styles.text9}>Social Links</span>
        <span className={styles.text10}>
          {clientData.socialLinks ? (
            <a href={clientData.socialLinks} target="_blank" rel="noopener noreferrer">
              {clientData.socialLinks}
            </a>
          ) : (
            "Not provided"
          )}
        </span>
      </div>
    </div>
  </>
)}

              {activeTab === "meetings" && (
                <div className={styles.meetingsContent}>
                  <Calendar key={calendarKey} clientId={id} />
                </div>
              )}

              {activeTab === "documents" && (
                <div>
                  {/* <p>Documents content will be displayed here</p> */}
                  {/* Add your documents content here when ready */}
                  <section className="documents-table-section">
                    <Documents clientId={id} refreshKey={documentsKey} />
                  </section>
                </div>
              )}

              {activeTab === "tasks" && (
                <div className={styles.tasksContent}>
                  <TaskBoard onRefresh={taskBoardRefreshRef} />
                </div>
              )}

              {activeTab === "remarks" && (
                <div className={styles.remarksSection}>
                  <form onSubmit={handleAddRemark} className={styles.remarksForm}>
                    <textarea
                      className={styles.remarksTextarea}
                      value={remarkText}
                      onChange={(e) => {
                        setRemarkText(e.target.value);
                        setRemarkError("");
                      }}
                      placeholder="Add a remark..."
                      rows={3}
                      maxLength={2000}
                      disabled={addingRemark}
                    />
                    <button
                      type="submit"
                      className={styles.remarksSubmitBtn}
                      disabled={addingRemark || !(remarkText || "").trim()}
                    >
                      {addingRemark ? "Adding..." : "Add Remark"}
                    </button>
                  </form>
                  {remarkError && (
                    <div className={styles.remarksError}>{remarkError}</div>
                  )}
                  <div className={styles.remarksListLabel}>Remarks (latest first)</div>
                  <div className={styles.remarksList}>
                    {remarksLoading ? (
                      <p className={styles.remarksLoading}>Loading remarks...</p>
                    ) : remarks.length === 0 ? (
                      <p className={styles.remarksEmpty}>No remarks yet.</p>
                    ) : (
                      remarks.map((r, index) => (
                        <div
                          key={r._id}
                          className={`${styles.remarkCard} ${index === 0 ? styles.remarkCardLatest : ""}`}
                        >
                          <div className={styles.remarkText}>{r.text}</div>
                          <div className={styles.remarkMeta}>
                            {r.createdBy?.username || "Unknown"} · {r.createdBy?.role ? `${r.createdBy.role}` : ""} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

       {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={
          deleteType === "entry" ? "Delete this Entry?" : "Delete this Data?"
        }
        description={
          deleteType === "entry"
            ? "Are you sure you want to delete this entry? This action cannot be undone."
            : "Are you sure you want to delete this data? This action cannot be undone."
        }
      />

      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={handleCreateEventClose}
        clientId={id}
        onEventCreated={handleEventCreated}
      />
       

      <EditClientModal
        isOpen={isEditClientModalOpen}
        onClose={handleEditClientClose}
        onSubmit={handleEditClientSubmit}
        clientData={clientData}
      />

      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onClose={handleFileUploadClose}
        onUpload={handleFileUploadComplete}
      />

      <DropDownList
        isOpen={isDropdownOpen}
        onClose={handleDropdownClose}
        onOptionSelect={handleExportOptionSelect}
        position={dropdownPosition}
      />

       <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={handleCreateTaskClose}
        clientId={id}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}

export default SalesAndLeadsClient;
