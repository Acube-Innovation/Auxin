import React, { useState, useEffect } from "react";
import styles from "./Profile.module.css";
import Side from "./sidebar/Sidebar";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import admindemo from "../assets/dashboard/admin-demo.jpg";
import UserService from "../services/UserService";
import config from "../config/config";
import ProfileAvatar from "../components/ProfileAvatar";
import NotificationBell from "../components/NotificationBell";

function Profile() {
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [formData, setFormData] = useState({
    username: "p.sinha",
    phoneNumber: "+91 738 683 7626",
    newPassword: "",
    emailId: "",
    profilePicture: admindemo,
    browserNotifications: false,
    appNotifications: true,
  });

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
    (async () => {
      try {
        const me = await UserService.getMe();
        setUsername(me.username || "");
        setUserRole(me.role || "");
        setFormData((prev) => ({
          ...prev,
          username: me.username || prev.username,
          phoneNumber: me.phoneNumber || "",
          emailId: me.emailId || "",
          profilePicture: me.profilePicture
            ? `${config.API_BASE_URL.replace("/api", "")}${me.profilePicture}`
            : null,
        }));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCancel = () => {
    // Reset form to original values
    setFormData({
      username: "p.sinha",
      phoneNumber: "+91 738 683 7626",
      newPassword: "",
      emailId: "",
      profilePicture: admindemo,
      browserNotifications: false,
      appNotifications: true,
    });
  };

  // Add this function to handle logout
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("role");
      window.location.href = "/login";
    }
  };

  const handleSaveChanges = async () => {
    try {
      const updated = await UserService.updateMe({
        username: formData.username,
        phoneNumber: formData.phoneNumber,
        emailId: formData.emailId,
        newPassword: formData.newPassword || undefined,
      });
      setUsername(updated.username || "");
      alert("Profile updated successfully!");
    } catch (e) {
      alert(e.message || "Failed to update profile");
    }
  };

  const handleEditProfilePicture = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const updated = await UserService.uploadProfilePicture(file);
        setFormData((prev) => ({
          ...prev,
          profilePicture: updated.profilePicture
            ? `${config.API_BASE_URL.replace("/api", "")}${
                updated.profilePicture
              }`
            : prev.profilePicture,
        }));
      } catch (err) {
        alert("Failed to upload profile picture");
      }
    };
    input.click();
  };

  const handleRemoveProfilePicture = () => {
    setFormData((prev) => ({ ...prev, profilePicture: null }));
    // Persist removal
    UserService.updateMe({ profilePicture: null }).catch(() => {});
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Profile</div>

            <div className={styles["dashboard-profile"]}>
              <NotificationBell />

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

        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Profile</div>
          </div>
        </section>

        <div className={styles["header-content"]}>
          <div className={styles["profile-container"]}>
            <div className={styles["profile-title"]}>Your Profile</div>

            <div className={styles["header-actions"]}>
              {/* <button className={styles["cancel-button"]} onClick={handleCancel}>
              Cancel
            </button> */}
              <button
                className={styles["logout-button"]}
                onClick={handleLogout}
              >
                <span>Logout</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6"
                    stroke="#E8362C"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                className={styles["save-button"]}
                onClick={handleSaveChanges}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <section className={styles["profile-content"]}>
          <div className={styles["profile-form"]}>
            <div className={styles["form-row"]}>
              <div className={styles["form-label"]}>Username</div>
              <div className={styles["form-field"]}>
                <input
                  type="text"
                  className={styles["form-input"]}
                  value={formData.username}
                  onChange={(e) =>
                    handleInputChange("username", e.target.value)
                  }
                />
              </div>
            </div>

            <div className={styles["divider"]}></div>

            <div className={styles["form-row"]}>
              <div className={styles["form-label"]}>Phone Number</div>
              <div className={styles["form-field"]}>
                <input
                  type="text"
                  className={styles["form-input"]}
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    handleInputChange("phoneNumber", e.target.value)
                  }
                />
              </div>
            </div>

            <div className={styles["divider"]}></div>

            <div className={styles["form-row"]}>
              <div className={styles["form-label"]}>Email Id</div>
              <div className={styles["form-field"]}>
                <input
                  type="email"
                  className={styles["form-input"]}
                  placeholder="Enter Your Email"
                  value={formData.emailId}
                  onChange={(e) => handleInputChange("emailId", e.target.value)}
                />
              </div>
            </div>

            <div className={styles["divider"]}></div>

            <div className={styles["form-row"]}>
              <div className={styles["form-label"]}>Change Password</div>
              <div className={styles["form-field"]}>
                <input
                  type="password"
                  className={styles["form-input"]}
                  placeholder="Enter New Password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    handleInputChange("newPassword", e.target.value)
                  }
                />
              </div>
            </div>

            <div className={styles["divider"]}></div>

            <div className={styles["form-row"]}>
              <div className={styles["form-label"]}>Profile Picture</div>
              <div className={styles["profile-picture-section"]}>
                <div className={styles["profile-picture-container"]}>
                  {formData.profilePicture ? (
                    <img
                      src={formData.profilePicture}
                      alt="Profile"
                      className={styles["profile-picture"]}
                    />
                  ) : (
                    <div className={styles["profile-picture-placeholder"]}>
                      {username?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className={styles["profile-picture-actions"]}>
                  <button
                    className={styles["edit-button"]}
                    onClick={handleEditProfilePicture}
                  >
                    <span style={{ color: "#34C759" }}>Edit</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8.00031 13.3332H14.0003M10.0003 3.33316L12.0003 5.33316M10.9176 2.41449C11.183 2.1491 11.543 2 11.9183 2C12.2936 2 12.6536 2.1491 12.919 2.41449C13.1844 2.67988 13.3335 3.03983 13.3335 3.41516C13.3335 3.79048 13.1844 4.15043 12.919 4.41582L4.91231 12.4232C4.75371 12.5818 4.55766 12.6978 4.34231 12.7605L2.42764 13.3192C2.37028 13.3359 2.30947 13.3369 2.25158 13.3221C2.1937 13.3072 2.14086 13.2771 2.09861 13.2349C2.05635 13.1926 2.02624 13.1398 2.01141 13.0819C1.99658 13.024 1.99758 12.9632 2.01431 12.9058L2.57298 10.9912C2.63579 10.776 2.75181 10.5802 2.91031 10.4218L10.9176 2.41449Z"
                        stroke="#34C759"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    className={styles["remove-button"]}
                    onClick={handleRemoveProfilePicture}
                  >
                    <span>Remove</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M2 3.99967H14M12.6667 3.99967V13.333C12.6667 13.9997 12 14.6663 11.3333 14.6663H4.66667C4 14.6663 3.33333 13.9997 3.33333 13.333V3.99967M5.33333 3.99967V2.66634C5.33333 1.99967 6 1.33301 6.66667 1.33301H9.33333C10 1.33301 10.6667 1.99967 10.6667 2.66634V3.99967M6.66667 7.33301V11.333M9.33333 7.33301V11.333"
                        stroke="#E8362C"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className={styles["divider"]}></div>
            {/* <div className={styles["divider"]}></div> */}

            {/* <div className={styles["form-row"]}>
              <div className={styles["form-label"]}>Notifications</div>
              <div className={styles["notifications-section"]}>
                <div className={styles["notification-item"]}>
                  <div className={styles["checkbox-container"]}>
                    <div
                      className={`${styles["checkbox"]} ${
                        formData.browserNotifications
                          ? styles["checkbox-checked"]
                          : ""
                      }`}
                      onClick={() =>
                        handleInputChange(
                          "browserNotifications",
                          !formData.browserNotifications
                        )
                      }
                    >
                      {formData.browserNotifications && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M1.875 6.75L4.5 9.375L10.5 3.375"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className={styles["notification-content"]}>
                    <div className={styles["notification-title"]}>
                      Browser Notifications
                    </div>
                    <div className={styles["notification-description"]}>
                      You will be notified when a new email arrives.
                    </div>
                  </div>
                </div>

                <div className={styles["notification-item"]}>
                  <div className={styles["checkbox-container"]}>
                    <div
                      className={`${styles["checkbox"]} ${
                        formData.appNotifications
                          ? styles["checkbox-checked"]
                          : ""
                      }`}
                      onClick={() =>
                        handleInputChange(
                          "appNotifications",
                          !formData.appNotifications
                        )
                      }
                    >
                      {formData.appNotifications && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M1.875 6.75L4.5 9.375L10.5 3.375"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className={styles["notification-content"]}>
                    <div className={styles["notification-title"]}>
                      App Notifications
                    </div>
                    <div className={styles["notification-description"]}>
                      You will be notified with sound when someone messages you.
                    </div>
                  </div>
                </div>
              </div>
            </div> */}
          </div>
        </section>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
}

export default Profile;
