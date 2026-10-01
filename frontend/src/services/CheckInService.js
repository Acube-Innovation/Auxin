import config from '../config/config';

class CheckInService {
  constructor() {
    let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

    // Ensure baseURL ends with /api
    if (!baseURL.endsWith('/api')) {
      if (baseURL.endsWith('/')) {
        baseURL += 'api';
      } else {
        baseURL += '/api';
      }
    }

    this.baseURL = `${baseURL}/checkins`;
    console.log('CheckInService initialized with baseURL:', this.baseURL);
  }

  // Get auth token from localStorage
  getAuthToken() {
    return localStorage.getItem('token');
  }

  // Get auth headers
  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Get all check-ins with pagination
  async getCheckIns(page = 1, limit = 10) {
    try {
      console.log(`Fetching check-ins from: ${this.baseURL} (page ${page}, limit ${limit})`);
      const response = await fetch(`${this.baseURL}?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching check-ins:', error);
      throw error;
    }
  }

  // Get single check-in by ID
  async getCheckIn(id) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching check-in:', error);
      throw error;
    }
  }

  // Create new check-in
  async createCheckIn(checkInData, imageFile = null) {
    try {
      console.log('Creating check-in at:', this.baseURL);
      console.log('Check-in data:', checkInData);

      const token = this.getAuthToken();

      // Validate required location data
      if (!checkInData.latitude || !checkInData.longitude) {
        throw new Error('GPS location is required for check-in');
      }

      // Only send what backend expects
      const payload = {
        ...checkInData,
        // location should be a string, not an object
        location: checkInData.location,
        // Remove deviceInfo, gpsAccuracy, etc.
      };

      if (imageFile) {
        // Use FormData for file upload
        const formData = new FormData();
        formData.append('data', JSON.stringify(payload));
        formData.append('imageProof', imageFile);

        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type header - FormData sets it automatically with boundary
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } else {
        // Use JSON for data without file
        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
      }
    } catch (error) {
      console.error('Error creating check-in:', error);
      throw error;
    }
  }

  // Update check-in
  async updateCheckIn(id, checkInData, imageFile = null) {
    try {
      console.log('Updating check-in at:', `${this.baseURL}/${id}`);
      console.log('Check-in data:', checkInData);

      const token = this.getAuthToken();

      if (imageFile) {
        // Use FormData for file upload
        const formData = new FormData();
        formData.append('data', JSON.stringify(checkInData));
        formData.append('imageProof', imageFile);

        const response = await fetch(`${this.baseURL}/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } else {
        // Use JSON for data without file
        const response = await fetch(`${this.baseURL}/${id}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(checkInData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
      }
    } catch (error) {
      console.error('Error updating check-in:', error);
      throw error;
    }
  }

  // Delete check-in
  async deleteCheckIn(id) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting check-in:', error);
      throw error;
    }
  }

  // Get check-ins by date range
  async getCheckInsByDateRange(startDate, endDate) {
    try {
      const queryParams = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const response = await fetch(`${this.baseURL}/date-range?${queryParams}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching check-ins by date range:', error);
      throw error;
    }
  }

  // Get check-ins by user
  // async getCheckInsByUser(userId) {
  //   try {
  //     const response = await fetch(`${this.baseURL}/user/${userId}`, {
  //       method: 'GET',
  //       headers: this.getAuthHeaders(),
  //     });

  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`);
  //     }

  //     return await response.json();
  //   } catch (error) {
  //     console.error('Error fetching check-ins by user:', error);
  //     throw error;
  //   }
  // }

  // In CheckInService - update getCheckInsByUser method
  async getCheckInsByUser(userId) {
    try {
      // If no userId provided, use the token-backed /user/me endpoint
      const endpoint = userId ? `${this.baseURL}/user/${userId}` : `${this.baseURL}/user/me`;
      console.log(`Fetching check-ins for user (endpoint): ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Check-ins API response:', result);

      // Normalize response to array of check-ins
      if (Array.isArray(result)) {
        return result;
      } else if (result.checkIns) {
        return result.checkIns;
      } else if (result.data) {
        return result.data;
      } else {
        // If it's a single object or unexpected shape, try to coerce
        return Array.isArray(result) ? result : [];
      }
    } catch (error) {
      console.error('Error fetching check-ins by user:', error);
      throw error;
    }
  }

  // Get check-ins by client
  async getCheckInsByClient(clientId) {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching check-ins by client:', error);
      throw error;
    }
  }

  // Get today's check-ins
  async getTodayCheckIns() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      return await this.getCheckInsByDateRange(startOfDay, endOfDay);
    } catch (error) {
      console.error('Error fetching today\'s check-ins:', error);
      throw error;
    }
  }

  // Get check-in statistics
  async getCheckInStats(startDate, endDate) {
    try {
      const queryParams = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const response = await fetch(`${this.baseURL}/stats?${queryParams}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching check-in stats:', error);
      throw error;
    }
  }

  // Get high-accuracy GPS location
  async getHighAccuracyLocation(options = {}) {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    };

    const geoOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
          const timestamp = position.timestamp;

          resolve({
            latitude,
            longitude,
            accuracy,
            altitude,
            heading,
            speed,
            timestamp,
            formattedCoordinates: this.formatCoordinates(latitude, longitude)
          });
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
            default:
              errorMessage = 'An unknown error occurred while retrieving location';
              break;
          }
          reject(new Error(errorMessage));
        },
        geoOptions
      );
    });
  }

  // Format coordinates to display format like "10°02'09.4"N 76°25'21.4"E"
  formatCoordinates(latitude, longitude) {
    const formatCoordinate = (coord, isLatitude) => {
      const absolute = Math.abs(coord);
      const degrees = Math.floor(absolute);
      const minutes = Math.floor((absolute - degrees) * 60);
      const seconds = ((absolute - degrees - minutes / 60) * 3600).toFixed(1);
      const direction = isLatitude ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');

      return `${degrees}\u00B0${minutes.toString().padStart(2, '0')}'${seconds}"${direction}`;
    };

    const latFormatted = formatCoordinate(latitude, true);
    const lngFormatted = formatCoordinate(longitude, false);

    return `${latFormatted} ${lngFormatted}`;
  }

  // Watch position for real-time location updates
  watchPosition(successCallback, errorCallback, options = {}) {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000 // 1 minute
    };

    const geoOptions = { ...defaultOptions, ...options };

    if (!navigator.geolocation) {
      errorCallback(new Error('Geolocation is not supported by this browser'));
      return null;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          formattedCoordinates: this.formatCoordinates(
            position.coords.latitude,
            position.coords.longitude
          )
        };
        successCallback(locationData);
      },
      errorCallback,
      geoOptions
    );
  }

  // Clear position watch
  clearWatch(watchId) {
    if (navigator.geolocation && watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
}

export default new CheckInService();
