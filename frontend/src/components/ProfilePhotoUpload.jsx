import React, { useRef, useState } from "react";
import "./ProfilePhotoUpload.css";
import config from "../config/config";

function ProfilePhotoUpload({ onUpload, initialImage, clientData }) {
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(initialImage || null);
  const [profileImageUrl, setProfileImageUrl] = useState(null);

  // Get profile image URL if clientData exists
  React.useEffect(() => {
    if (clientData?.profilePicture) {
      // Construct the full URL for the profile picture
      let baseURL = config.API_BASE_URL || 'http://localhost:5000';
      // Remove /api from baseURL if it exists for file serving
      baseURL = baseURL.replace('/api', '');
      setProfileImageUrl(`${baseURL}${clientData.profilePicture}`);
    }
  }, [clientData]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreviewImage(previewUrl);
      setProfileImageUrl(null); // Clear existing image URL

      // Call onUpload with the file
      if (onUpload) {
        onUpload(file);
      }
    }
  };

  const displayImage = previewImage || profileImageUrl;

  return (
    <div className="profile-upload-container">
      <div className="profile-info">
        <div className="avatar-container">
          {displayImage ? (
            <img
              src={displayImage}
              alt="Profile"
              className="profile-image"
            />
          ) : (
            <>
              <div className="avatar-bg">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                  <circle cx="36" cy="36" r="36" fill="#B3B9C4" />
                </svg>
              </div>
              <div className="user-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M25.3332 28V25.3333C25.3332 23.9188 24.7713 22.5623 23.7711 21.5621C22.7709 20.5619 21.4143 20 19.9998 20H11.9998C10.5853 20 9.22879 20.5619 8.2286 21.5621C7.22841 22.5623 6.6665 23.9188 6.6665 25.3333V28M21.3332 9.33333C21.3332 12.2789 18.9454 14.6667 15.9998 14.6667C13.0543 14.6667 10.6665 12.2789 10.6665 9.33333C10.6665 6.38781 13.0543 4 15.9998 4C18.9454 4 21.3332 6.38781 21.3332 9.33333Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </>
          )}
        </div>
        <div className="profile-text">Profile Photo</div>
      </div>
      <button className="profile-upload-button" onClick={handleUploadClick}>
        <span className="profile-upload-text">{displayImage ? 'Change Photo' : 'Upload Photo'}</span>
        <div className="profile-upload-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" >
            <path
              d="M10.6668 14V12.6667C10.6668 11.9594 10.3859 11.2811 9.88578 10.781C9.38568 10.281 8.70741 10 8.00016 10H4.00016C3.29292 10 2.61464 10.281 2.11454 10.781C1.61445 11.2811 1.3335 11.9594 1.3335 12.6667V14M12.6668 5.33333V9.33333M14.6668 7.33333H10.6668M8.66683 4.66667C8.66683 6.13943 7.47292 7.33333 6.00016 7.33333C4.5274 7.33333 3.3335 6.13943 3.3335 4.66667C3.3335 3.19391 4.5274 2 6.00016 2C7.47292 2 8.66683 3.19391 8.66683 4.66667Z"
              stroke="#007AFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default ProfilePhotoUpload;
