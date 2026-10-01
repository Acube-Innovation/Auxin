import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// import styles from "../../pages/SalesAndLeads.module.css";
import styles from "../SalesAndLeadsClient.module.css";
import Side from "../sidebar/Sidebar";

import Documents from "../../components/team-management-components/TeamMangementDocuments";
// import Calendar from "../../components/CalendarComponent";
import Meetingstable from "./YourCalendarMeetings";
import clientService from "../../services/ClientService";
import employeeService from "../../services/EmployeeService";
import MeetingService from "../../services/MeetingService";
import config from "../../config/config";
import MobileBottomNavigation from "../../components/MobileBottomNavigation";
import DeleteModal from "../../components/delete-modal/DeleteModal";
import CreateMeetingModal from "./CreateMeetingModal";
import EditMeetingModal from "./EditMeetingModal";
import FileUploadModal from "../../components/FileUploadModal";
import DropDownList from "../../components/DropDownList";

import belldot from "../../assets/dashboard/bell-dot.svg";
import admindemo from "../../assets/dashboard/admin-demo.jpg";
import employee from "../../assets/dashboard/employee.jpg";
import arrowleft from "../../assets/dashboard/arrow-left.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import chevrondright from "../../assets/dashboard/chevron-right.svg";
import plus from "../../assets/dashboard/plus.svg";
import pencillineblue from "../../assets/dashboard/pencil-line-blue.svg";
import upload from "../../assets/dashboard/upload.svg";
import deletewhite from "../../assets/dashboard/delete-white.svg";
import ProfileAvatar from "../../components/ProfileAvatar";
import NotificationBell from "../../components/NotificationBell";

function YourCalendar() {
  const [activeTab, setActiveTab] = useState("meetings");
  const basicInfoRef = useRef(null);
  const meetingsRef = useRef(null);
  const documentsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(""); // 'entry' or 'data'
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [createEventInitial, setCreateEventInitial] = useState(null);
  const [isEditMeetingModalOpen, setIsEditMeetingModalOpen] = useState(false);
  const [editMeetingSelected, setEditMeetingSelected] = useState(null);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const exportButtonRef = useRef(null);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [selectedMeetingToDelete, setSelectedMeetingToDelete] = useState(null);

      useEffect(() => {
        setUsername(localStorage.getItem("username") || "");
        setUserRole(localStorage.getItem("role") || "");
        loadMeetingsForCurrentUser();
      }, []);
  
    // Load and filter events according to role: admin => all, user => assigned OR created
    async function loadMeetingsForCurrentUser() {
      setIsLoadingMeetings(true);
      try {
        const token = localStorage.getItem("token");
        // get current user from server (fallback to localStorage)
        let me = null;
        try {
          const resp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/,'')}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) me = await resp.json();
        } catch (e) {
          // ignore - fallback to localStorage
        }
        me = me || { _id: localStorage.getItem('userId'), username: localStorage.getItem('username'), emailId: localStorage.getItem('email'), role: localStorage.getItem('role') };
        const role = me.role || userRole || 'sales_executive';
  
        // fetch aggregated client events
        let clientEvents = [];
        try {
          const allEventsResp = await fetch(`${clientService.baseURL.replace(/\/clients\/?$/,'')}/clients/events`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (allEventsResp.ok) clientEvents = await allEventsResp.json();
        } catch (e) {
          console.warn('Failed to fetch client events', e);
          clientEvents = [];
        }

        // fetch standalone meetings (saved to /api/meetings)
        let meetingsList = [];
        try {
          const raw = await MeetingService.getMeetings();
          meetingsList = Array.isArray(raw) ? raw : (raw.meetings || []);
        } catch (e) {
          console.warn('Failed to fetch meetings from /api/meetings', e);
          meetingsList = [];
        }
        
        // Normalize meetings to the same structure as client events so filtering works
        const normalizedMeetings = (meetingsList || []).map(m => {
          const date = m.date ? new Date(m.date) : null;
          return {
            _id: m._id || m.id,
            eventId: m._id || m.id,
            eventName: m.title || m.eventName || '',
            title: m.title || m.eventName || '',
            date: date ? date.toISOString().split('T')[0] : null,
            time: m.time || '',
            clientId: m.clientId || null,
            clientName: m.clientName || null,
            assignedTeamMembers: m.assignedTeamMembers || [],
            createdBy: m.createdBy || null,
            // include color at top-level so downstream components can read it directly
            color: m.color || (m.meta && m.meta.meeting && m.meta.meeting.color) || '#FF9500',
            meta: { meeting: m }
          };
        });
  
        // Merge client events and normalized meetings into a single array
        const events = [
          ...(Array.isArray(clientEvents) ? clientEvents : []),
          ...normalizedMeetings
        ];
  
        // Use `events` below in filtering logic instead of the old `events` variable
        if (role === 'admin') {
          // Admin sees all events
          setMeetings(events);
         } else if (role === 'sales_executive') {
          // Sales executive sees events they created or are assigned to
          // resolve employee linked to this user
           let employee = null;
           try {
             const employees = await employeeService.getEmployees();
             employee = (employees || []).find(emp =>
               String(emp.user) === String(me._id) ||
               (emp.emailId && me.emailId && emp.emailId.toLowerCase() === me.emailId.toLowerCase())
             );
           } catch (e) {
             console.warn('Failed to resolve employee:', e);
           }
   
           const empId = employee?._id ? String(employee._id) : null;
           const usernameKey = (me.username || me.emailId || '').toString().toLowerCase();
           const userId = me._id ? String(me._id) : null;
   
          const filtered = (events || []).filter(ev => {
             // Check if user created this event
             if (ev.createdBy && (
                 (userId && String(ev.createdBy) === userId) || 
                 (usernameKey && ev.createdBy.toLowerCase && String(ev.createdBy).toLowerCase() === usernameKey)
               )) {
               return true;
             }
             
             // Check if user is assigned to this event
             // ev may include assignedTeamMembers (array of ids) and assignedBy (string)
             const assignedTeam = ev.assignedTeamMembers || ev.meta?.event?.assignedTeamMembers || ev.assignedTo || ev.meta?.assignedTeamMembers;
             if (empId && Array.isArray(assignedTeam) && assignedTeam.map(String).includes(String(empId))) return true;
             
             // Check if user is the one who assigned this event
             if (ev.assignedBy && usernameKey && String(ev.assignedBy).toLowerCase() === usernameKey) return true;
             
             // fallback: check payload/meta fields
             const metaAssigned = ev.meta?.event?.assignedTeamMembers || ev.meta?.assignedTeamMembers;
             if (empId && Array.isArray(metaAssigned) && metaAssigned.map(String).includes(String(empId))) return true;
             
             return false;
           });
           
           console.log('Filtered events for @:', filtered.length);
           setMeetings(filtered);
         } else {
          // Other roles - use the same logic as before
           let employee = null;
           try {
             const employees = await employeeService.getEmployees();
             employee = (employees || []).find(emp =>
               String(emp.user) === String(me._id) ||
               (emp.emailId && me.emailId && emp.emailId.toLowerCase() === me.emailId.toLowerCase())
             );
           } catch (e) {
             console.warn('Failed to resolve employee:', e);
           }
   
           const empId = employee?._id ? String(employee._id) : null;
           const usernameKey = (me.username || me.emailId || '').toString().toLowerCase();
   
          const filtered = (events || []).filter(ev => {
             // ev may include assignedTeamMembers (array of ids) and assignedBy (string)
             const assignedTeam = ev.assignedTeamMembers || ev.meta?.event?.assignedTeamMembers || ev.assignedTo || ev.meta?.assignedTeamMembers;
             if (empId && Array.isArray(assignedTeam) && assignedTeam.map(String).includes(String(empId))) return true;
             if (ev.assignedBy && usernameKey && String(ev.assignedBy).toLowerCase() === usernameKey) return true;
             // fallback: check payload/meta fields
             const metaAssigned = ev.meta?.event?.assignedTeamMembers || ev.meta?.assignedTeamMembers;
             if (empId && Array.isArray(metaAssigned) && metaAssigned.map(String).includes(String(empId))) return true;
             return false;
           });
           setMeetings(filtered);
         }
       } catch (err) {
         console.error('Error loading meetings for calendar:', err);
         setMeetings([]);
       } finally {
         setIsLoadingMeetings(false);
       }
     }

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

  const handleDeleteEntry = () => {
    setDeleteType("entry");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteData = () => {
    setDeleteType("data");
    setIsDeleteModalOpen(true);
  };

   const handleNewEvent = () => {
     setCreateEventInitial(null);
     setIsCreateEventModalOpen(true);
   };

   const handleCreateEventClose = () => {
     setIsCreateEventModalOpen(false);
     setCreateEventInitial(null);
   };

   // Called when CreateMeetingModal finishes (create or update)
   const handleEventSaved = async (createdMeeting) => {
     // refresh meetings list after save
     try {
       await loadMeetingsForCurrentUser();
     } catch (e) {
       console.warn("Failed to refresh meetings after event save", e);
     }
     // close modal handled by modal itself via onClose
   };

   // Called when calendar requests edit for an event
   const handleEditEvent = (evt) => {
     // evt is the event object from YourCalendarMeetings
     // Close any create modal and open the dedicated EditMeetingModal so update will call PUT instead of creating new
     setCreateEventInitial(null);
     setIsCreateEventModalOpen(false);
     setEditMeetingSelected(evt);
     setIsEditMeetingModalOpen(true);
   };

   const handleEditModalClose = () => {
     setIsEditMeetingModalOpen(false);
     setEditMeetingSelected(null);
   };
   
   const handleEventUpdated = async (updatedMeeting) => {
     try {
       await loadMeetingsForCurrentUser();
     } catch (e) {
       console.warn("Failed to refresh meetings after update", e);
     }
   };

  // Child requests deletion: open DeleteModal and store meeting
  const handleRequestDelete = (evt) => {
    setSelectedMeetingToDelete(evt);
    setDeleteType("meeting");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (selectedMeetingToDelete && (selectedMeetingToDelete._id || selectedMeetingToDelete.id || selectedMeetingToDelete.eventId)) {
        const id = selectedMeetingToDelete._id || selectedMeetingToDelete.id || selectedMeetingToDelete.eventId;
        await MeetingService.deleteMeeting(id);
        // reload meetings
        await loadMeetingsForCurrentUser();
      } else {
        // handle other delete types if present
        if (deleteType === "entry") {
          console.log("Delete Entry confirmed");
        } else if (deleteType === "data") {
          console.log("Delete Data confirmed");
        }
      }
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      // you may show a toast or set an error state
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteType("");
      setSelectedMeetingToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeleteType("");
  };

  const handleFileUpload = () => {
    setIsFileUploadModalOpen(true);
  };

  const handleFileUploadClose = () => {
    setIsFileUploadModalOpen(false);
  };

  const handleFileUploadComplete = (files) => {
    console.log("Files uploaded:", files);
    // Handle uploaded files here
    setIsFileUploadModalOpen(false);
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

  const handleExportOptionSelect = (option) => {
    console.log(`Export as ${option} selected`);
    switch (option) {
      case "pdf":
        alert("Exporting as PDF...");
        // Implement PDF export logic here
        break;
      case "csv":
        alert("Exporting as CSV...");
        // Implement CSV export logic here
        break;
      case "txt":
        alert("Exporting as TXT...");
        // Implement TXT export logic here
        break;
      case "print":
        alert("Printing document...");
        // Implement print logic here
        window.print();
        break;
      default:
        console.log("Unknown export option:", option);
    }
  };

  // Render different buttons based on active tab
  const renderButtons = () => {
    switch (activeTab) {
      case "meetings":
        return (
          <div className={styles.row_view5}>
          
            <button className={styles.button_row_view} onClick={handleNewEvent}>
              <span className={styles.text3}>New Event</span>
              <img src={plus} className={styles.image3} alt="" />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="export" />
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
            <div className={styles["dashboard-title"]}>Calendar</div>

            <div className={styles["dashboard-profile"]}>
                <NotificationBell />
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
            <div className={styles["breadcrumb-active"]}>Your Calendar</div>
          </div>
        </section>

        <div className={styles.contain}style={{ borderBottom: "5px solid #E4E4E4" }}>
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
                      <span className={styles.text}>{"Your Calendar"}</span>
                    </div>
                  </div>
                </div>

                {renderButtons()}
              </div>

              {/* Tab Navigation */}
            </div>
            <div className={styles.column3}>
              {activeTab === "meetings" && (
                <div className={styles.meetingsContent} >
                  <Meetingstable
                    events={meetings}
                    isLoading={isLoadingMeetings}
                    reloadMeetings={loadMeetingsForCurrentUser}
                    onEdit={handleEditEvent}
                    onDelete={handleRequestDelete}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={
          selectedMeetingToDelete ? `Delete "${selectedMeetingToDelete.title || selectedMeetingToDelete.eventName || 'this meeting'}"?` :
          deleteType === "entry" ? "Delete this Entry?" : "Delete this Data?"
        }
        description={
          selectedMeetingToDelete
            ? `This will permanently remove the selected meeting from the calendar. Proceed?`
            : deleteType === "entry"
              ? "Are you sure you want to delete this entry? This action cannot be undone."
              : "Are you sure you want to delete this data? This action cannot be undone."
        }
      />

      <CreateMeetingModal
        isOpen={isCreateEventModalOpen}
        onClose={handleCreateEventClose}
        onEventCreated={handleEventSaved}
        initial={createEventInitial}
      />

      <EditMeetingModal
        isOpen={isEditMeetingModalOpen}
        onClose={handleEditModalClose}
        meeting={editMeetingSelected}
        onEventUpdated={handleEventUpdated}
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
       {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
}

export default YourCalendar;
