import React, { useState, useRef, useEffect } from 'react';
import styles from '../pages/Login.module.css';

const OtpInput = ({ value, onChange, onComplete }) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (value) {
      const otpArray = value.split('').slice(0, 4);
      while (otpArray.length < 4) {
        otpArray.push('');
      }
      setOtp(otpArray);
    }
  }, [value]);

  const handleChange = (index, val) => {
    if (!/^\d*$/.test(val)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = val.slice(-1); // Only take the last character
    setOtp(newOtp);

    const otpString = newOtp.join('');
    onChange(otpString);

    // Auto-focus next input
    if (val && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Call onComplete when all 4 digits are entered
    if (otpString.length === 4 && onComplete) {
      onComplete(otpString);
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // Handle arrow keys
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 4);
    
    const newOtp = ['', '', '', ''];
    for (let i = 0; i < digits.length; i++) {
      newOtp[i] = digits[i];
    }
    setOtp(newOtp);
    
    const otpString = newOtp.join('');
    onChange(otpString);
    
    // Focus the next empty input or the last one
    const nextIndex = Math.min(digits.length, 3);
    inputRefs.current[nextIndex]?.focus();
    
    if (otpString.length === 4 && onComplete) {
      onComplete(otpString);
    }
  };

  return (
    <div className={styles.otpContainer}>
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={styles.otpInput}
          maxLength={1}
          autoComplete="off"
          placeholder="0"
        />
      ))}
    </div>
  );
};

export default OtpInput;
