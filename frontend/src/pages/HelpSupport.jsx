import React, { useState, useEffect } from "react";
import styles from "./HelpSupport.module.css";
import Side from "./sidebar/Sidebar";
import { useToast } from "../context/ToastContext";
import axios from "axios";
import InputField from "../components/InputField";
import NotificationBell from "../components/NotificationBell";
import ProfileAvatar from "../components/ProfileAvatar";

import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";

const HelpSupport = () => {
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.subject.trim()) newErrors.subject = "Subject is required";
    if (!formData.message.trim()) newErrors.message = "Message is required";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/support/send`, formData);
      showToast("Message sent successfully!", "success");
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      showToast("Failed to send message. Please try again later.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        {/* Header Section */}
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Help & Support</div>
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

        {/* Breadcrumb Section */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Help & Support</div>
          </div>
        </section>

        {/* Main Content */}
        <section className={styles["main-content"]}>
          <div className={styles["support-container"]}>
            <div className={styles["support-header"]}>
              <div>
                <div className={styles["support-title"]}>Contact Support</div>
                <div className={styles["support-subtitle"]}>
                  We're here to help! Fill out the form below and we'll get back to you shortly.
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className={styles["support-form"]}>
              <div className={styles["form-row"]}>
                <div className={styles["form-group"]}>
                  <InputField
                    label="Name"
                    placeholder="Your Name"
                    required={true}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    hasError={!!errors.name}
                  />
                  {errors.name && <span className={styles["error-text"]}>{errors.name}</span>}
                </div>

                <div className={styles["form-group"]}>
                  <InputField
                    label="Email"
                    placeholder="your@email.com"
                    required={true}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    hasError={!!errors.email}
                  />
                  {errors.email && <span className={styles["error-text"]}>{errors.email}</span>}
                </div>
              </div>

              <div className={styles["form-row"]}>
                <div className={styles["form-group"]}>
                  <InputField
                    label="Phone"
                    placeholder="+1 (555) 000-0000"
                    required={false}
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className={styles["form-group"]}>
                  <InputField
                    label="Subject"
                    placeholder="How can we help?"
                    required={true}
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    hasError={!!errors.subject}
                  />
                  {errors.subject && <span className={styles["error-text"]}>{errors.subject}</span>}
                </div>
              </div>

              <div className={styles["textarea-container"]}>
                <label className={styles["textarea-label"]}>
                  Message <span style={{ color: "red" }}>*</span>
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className={`${styles.textarea} ${errors.message ? styles["error-input"] : ""}`}
                  placeholder="Describe your issue or question..."
                  rows="5"
                ></textarea>
                {errors.message && <span className={styles["error-text"]}>{errors.message}</span>}
              </div>

              <button type="submit" className={styles["submit-button"]} disabled={loading}>
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HelpSupport;
