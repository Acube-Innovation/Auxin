import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link  } from "react-router-dom";
import auxin_logo from "../assets/auxin_logo.png";
import styles from "./Login.module.css";

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/login`, { username, password }, { withCredentials: true });

      // Store the token in localStorage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem('username', res.data.username);
      console.log(res.data.username); 

      // Store the token and user data in localStorage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('userId', res.data.user._id); // Add this line
      localStorage.setItem('role', res.data.user.role); // Store user role
      
      console.log("Login successful, user ID:", res.data.user._id);
      console.log("Stored user ID:", localStorage.getItem('userId'));
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Your Username/Password is incorrect!');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
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
              Login to CRM
            </div>
            <div className={styles.formContent}>
              <div className={styles.inputContainer}>
                <div className={styles.inputField}>
                  <div className={styles.inputFieldBase}>
                    <div className={styles.inputWithLabel}>
                      <div className={styles.label}>
                        Username
                      </div>
                      <div className={styles.inputWrapper}>
                        <input
                          className={styles.input}
                          id="username"
                          type="text"
                          placeholder="EX. John Doe"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className={styles.inputField}>
                  <div className={styles.inputFieldBase}>
                    <div className={styles.inputWithLabel}>
                      <div className={styles.label}>
                        Password
                      </div>
                      <div className={styles.inputWrapper}>
                        <input
                          className={styles.input}
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="**********"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className={styles.passwordToggle}
                          onClick={togglePasswordVisibility}
                        >
                          {showPassword ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12C1 12 2.33 8.36 5.18 6.06M9.9 4.24A9.12 9.12 0 0 1 12 4C19 4 23 12 23 12C23 12 21.76 15.53 19.1 17.77M1 1L23 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {error && (
                      <div className={styles.errorText}>
                        {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button 
                type="submit" 
                className={styles.loginButton}
                onClick={handleSubmit}
              >
                Login
              </button>
              <div className={styles.forgotPasswordContainer}>
                <div className={styles.forgotPasswordText}>
                  Forgot Password?
                </div>
                {/* <a href="/forgotpassword" className={styles.forgotPasswordLink}>
                  Click Here
                </a> */}
                 <Link to="/forgotpassword" className={styles.forgotPasswordLink}>
                  Click Here
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
