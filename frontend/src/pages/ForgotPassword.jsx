import React, { useState } from "react";
import axios from "axios";
import auxin_logo from "../assets/auxin_logo.png";
import { useNavigate } from "react-router-dom";
import OtpInput from "../components/OtpInput";
import styles from "./Login.module.css";

function ForgotPassword() {
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter OTP, 3 = reset password
  const [emailId, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/send-otp`, { emailId });
      setStep(2);
      setError("");
    } catch (err) {
      setError("Email not found!");
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/verify-otp`, { emailId, otp });
      setStep(3);
      setError("");
    } catch (err) {
      setError("Invalid OTP!");
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/reset-password`, { emailId, otp: otp, newPassword });
      alert("Password reset successfully!");
      setStep(1);
      // Redirect to login page
      navigate("/login");
    } catch (err) {
      setError("Failed to reset password!");
    }
  };

  const handleOtpChange = (otpValue) => {
    setOtp(otpValue);
  };

  const handleOtpComplete = (otpValue) => {
    setOtp(otpValue);
    // Optionally auto-submit when OTP is complete
    // handleOtpSubmit({ preventDefault: () => {} });
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.leftPanel}>
        <div className={styles.circle}></div>
        <div className={`${styles.circle} ${styles.circleExtra}`}></div>
        <div className={styles.welcomeBox}>
          <h1>
            Welcome back
            <br />
            to Auxin!
          </h1>
          <p>
            Login and continue where you left off! You will be
            <br />
            signed in based on your roles and permissions.
          </p>
        </div>
      </div>
      <div className={styles.rightPanel}>
        <div className={styles.loginBox}>
          <img src={auxin_logo} alt="Auxin Logo" className={styles.logo} />
          <div className={styles.formContainer}>
            <div className={styles.loginTitle}>
              Reset your Password
            </div>
            <div className={styles.formContent}>
              {step === 1 && (
                <>
                  <div className={styles.inputContainer}>
                    <div className={styles.inputField}>
                      <div className={styles.inputFieldBase}>
                        <div className={styles.inputWithLabel}>
                          <div className={styles.label}>
                            Email
                          </div>
                          <input
                            className={styles.input}
                            type="email"
                            placeholder="Enter your email"
                            value={emailId}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className={styles.loginButton}
                    onClick={handleEmailSubmit}
                  >
                    Get OTP
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <div className={styles.inputContainer}>
                    <div className={styles.inputField}>
                      <div className={styles.inputFieldBase}>
                        <div className={styles.inputWithLabel}>
                          <div className={styles.label}>
                            Check your Email for your OTP
                          </div>
                          <OtpInput 
                            value={otp}
                            placeholder= "0"
                            onChange={handleOtpChange}
                            onComplete={handleOtpComplete}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className={styles.loginButton}
                    onClick={handleOtpSubmit}
                  >
                    Verify OTP
                  </button>
                </>
              )}

              {step === 3 && (
                <>
                  <div className={styles.inputContainer}>
                    <div className={styles.inputField}>
                      <div className={styles.inputFieldBase}>
                        <div className={styles.inputWithLabel}>
                          <div className={styles.label}>
                            New Password
                          </div>
                          <input
                            className={styles.input}
                            type="password"
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className={styles.loginButton}
                    onClick={handlePasswordReset}
                  >
                    Reset Password
                  </button>
                </>
              )}

              {error && (
                <div className={styles.errorText}>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
