import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./CheckInHistory.module.css";
import Side from "./sidebar/Sidebar";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import ProfileAvatar from "../components/ProfileAvatar";
import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import CheckInService from "../services/CheckInService";
import config from "../config/config";
import DeleteModal from "../components/delete-modal/DeleteModal";
import NotificationBell from "../components/NotificationBell";

function CheckInHistory() {
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("");
  const [selectedCheckIn, setSelectedCheckIn] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [userRole, setUserRole] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [checkInToDelete, setCheckInToDelete] = useState(null);

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
    // fetchCheckIns will compute pagination; ensure currentPage is valid
    fetchCheckIns(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage]);

  const fetchCheckIns = async (page, limit) => {
    try {
      setLoading(true);
      console.log("Fetching check-ins using CheckInService");
      const response = await CheckInService.getCheckIns(page, limit);
      console.log("Check-ins fetched successfully:", response);

      // Two possible shapes:
      // 1) Paginated: { checkIns: [...], pagination: { page, pages, total } }
      // 2) Legacy array: [...]
      if (response && response.checkIns && response.pagination) {
        const items = Array.isArray(response.checkIns) ? response.checkIns : [];
        const total = Number(response.pagination.total) || items.length;
        const pages = Math.max(1, Number(response.pagination.pages) || Math.ceil(total / limit));
        setCheckIns(items);
        setTotalPages(pages);
        setTotalItems(total);
      } else if (Array.isArray(response)) {
        const items = response;
        const total = items.length;
        const pages = Math.max(1, Math.ceil(total / limit));
        // clamp page if out of range
        if (page > pages) {
          setCurrentPage(pages);
          // fetch will be re-triggered by setCurrentPage effect
        }
        setCheckIns(items.slice((page - 1) * limit, page * limit));
        setTotalPages(pages);
        setTotalItems(total);
      } else {
        // If unexpected shape, try to coerce
        const coerced = response && response.data ? response.data : [];
        const items = Array.isArray(coerced) ? coerced : [];
        const total = items.length;
        const pages = Math.max(1, Math.ceil(total / limit));
        setCheckIns(items.slice((page - 1) * limit, page * limit));
        setTotalPages(pages);
        setTotalItems(total);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching check-ins:", err);
      setError("Failed to load check-in history");
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "long", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeString) => {
    return timeString;
  };

  const handleViewDetails = (checkIn) => {
    setSelectedCheckIn(checkIn);
    setShowModal(true);
  };

  // Open confirmation modal
  const handleDeleteClick = (checkIn) => {
    setCheckInToDelete(checkIn);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!checkInToDelete) return;
    try {
      await CheckInService.deleteCheckIn(checkInToDelete._id);
      // Refresh current page
      await fetchCheckIns(currentPage, itemsPerPage);
    } catch (err) {
      console.error("Failed to delete check-in:", err);
      alert(err?.message || "Failed to delete check-in");
    } finally {
      setIsDeleteModalOpen(false);
      setCheckInToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setCheckInToDelete(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCheckIn(null);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const renderPagination = () => {
    const pages = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    // Previous button
    pages.push(
      <button
        key="prev"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={styles.paginationButton}
      >
        &lt;
      </button>
    );

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`${styles.paginationButton} ${
            currentPage === i ? styles.activePage : ""
          }`}
        >
          {i}
        </button>
      );
    }

    // Next button
    pages.push(
      <button
        key="next"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={styles.paginationButton}
      >
        &gt;
      </button>
    );

    return (
      <div className={styles.pagination}>
        <div className={styles.paginationInfo}>
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
          entries
        </div>
        <div className={styles.paginationControls}>{pages}</div>
      </div>
    );
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>CheckIn History</div>

            <div className={styles["dashboard-profile"]}>
                <NotificationBell/>
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar
                    size={40}
                    className={styles["profile-picture"]}
                  />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>
                      {username?.toUpperCase()}
                    </div>
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

        {/* Desktop breadcrumb */}
        {/* <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="separator" />
            <div className={styles["breadcrumb-two"]}>Check-in History</div>
          </div>
        </section> */}

        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>CheckIn</div>
          </div>
        </section>

        {/* Main Content */}
        <section className={styles["main-content"]}>
          <div className={styles["checkin-history-container"]}>
            <h2>Employee Check-in Records</h2>

            {loading ? (
              <div className={styles["loading"]}>
                Loading check-in history...
              </div>
            ) : error ? (
              <div className={styles["error"]}>{error}</div>
            ) : checkIns.length === 0 ? (
              <div className={styles["no-data"]}>No check-in records found</div>
            ) : (
              <div className={styles["checkin-list"]}>
                <table className={styles["checkin-table"]}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Location</th>
                      <th>Event Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkIns.map((checkIn) => (
                      <tr key={checkIn._id}>
                        <td>
                          {checkIn.user ? (
                            <div className={styles["user-info"]}>
                              <ProfileAvatar size={30} userData={checkIn.user} />
                              <span>{checkIn.user.username}</span>
                            </div>
                          ) : (
                            "Unknown User"
                          )}
                        </td>
                        <td>
                          {checkIn.clientId
                            ? checkIn.clientId.companyName
                            : "N/A"}
                        </td>
                        <td>{formatDate(checkIn.date)}</td>
                        <td>{formatTime(checkIn.time)}</td>
                        <td className={styles["location-cell"]}>
                          {checkIn.location ? checkIn.location.replace(/\uFFFD/g, '\u00B0') : ''}
                        </td>
                        <td>{checkIn.eventType}</td>
                        <td>
                          <button
                            className={styles["view-button"]}
                            onClick={() => handleViewDetails(checkIn)}
                          >
                            View Details
                          </button>
                          <button
                            className={styles["delete-button"]}
                            style={{ marginLeft: 8 }}
                            onClick={() => handleDeleteClick(checkIn)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && !error && checkIns.length > 0 && renderPagination()}
          </div>
        </section>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />

      {/* Check-in Details Modal */}
      {showModal && selectedCheckIn && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal-content"]}>
            <div className={styles["modal-header"]}>
              <h3>Check-in Details</h3>
              <button className={styles["close-button"]} onClick={closeModal}>
                &times;
              </button>
            </div>
            <div className={styles["modal-body"]}>
              <div className={styles["detail-row"]}>
                <div className={styles["detail-label"]}>Employee:</div>
                <div className={styles["detail-value"]}>
                  {selectedCheckIn.user
                    ? selectedCheckIn.user.username
                    : "Unknown"}
                </div>
              </div>
              <div className={styles["detail-row"]}>
                <div className={styles["detail-label"]}>Client:</div>
                <div className={styles["detail-value"]}>
                  {selectedCheckIn.clientId
                    ? selectedCheckIn.clientId.companyName
                    : "N/A"}
                </div>
              </div>
              <div className={styles["detail-row"]}>
                <div className={styles["detail-label"]}>Date & Time:</div>
                <div className={styles["detail-value"]}>
                  {formatDate(selectedCheckIn.date)} at{" "}
                  {formatTime(selectedCheckIn.time)}
                </div>
              </div>
              <div className={styles["detail-row"]}>
                <div className={styles["detail-label"]}>Event Type:</div>
                <div className={styles["detail-value"]}>
                  {selectedCheckIn.eventType}
                </div>
              </div>
              <div className={styles["detail-row"]}>
                <div className={styles["detail-label"]}>Location:</div>
                <div className={styles["detail-value"]}>
                  {selectedCheckIn.location ? selectedCheckIn.location.replace(/\uFFFD/g, '\u00B0') : ''}
                </div>
              </div>
              {selectedCheckIn.notes && (
                <div className={styles["detail-row"]}>
                  <div className={styles["detail-label"]}>Notes:</div>
                  <div className={styles["detail-value"]}>
                    {selectedCheckIn.notes}
                  </div>
                </div>
              )}
              {selectedCheckIn.teamMembers &&
                selectedCheckIn.teamMembers.length > 0 && (
                  <div className={styles["detail-row"]}>
                    <div className={styles["detail-label"]}>Team Members:</div>
                    <div className={styles["detail-value"]}>
                      {selectedCheckIn.teamMembers
                        .map((member) => member.name)
                        .join(", ")}
                    </div>
                  </div>
                )}
              {selectedCheckIn.imageProof && (
                <div className={styles["image-proof"]}>
                  <h4>Image Proof:</h4>
                  <img
                    src={
                      selectedCheckIn.imageProof && selectedCheckIn.imageProof.startsWith('http')
                        ? selectedCheckIn.imageProof
                        : `${config.API_BASE_URL.replace('/api', '')}${selectedCheckIn.imageProof}`
                    }
                    alt="Check-in proof"
                    className={styles["proof-image"]}
                  />
                </div>
              )}
              {selectedCheckIn.latitude && selectedCheckIn.longitude && (
                <div className={styles["map-container"]}>
                  <h4>Map Location:</h4>
                  <div className={styles["map-placeholder"]}>
                    <a
                      href={`https://www.google.com/maps?q=${selectedCheckIn.latitude},${selectedCheckIn.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles["map-link"]}
                    >
                      View on Google Maps
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={`Delete check-in?`}
        description={`Are you sure you want to delete this check-in? This action cannot be undone.`}
      />
    </div>
  );
}

export default CheckInHistory;
