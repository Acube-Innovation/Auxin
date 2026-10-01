import config from '../config/config';

class ClientService {
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

    this.baseURL = `${baseURL}/clients`;
    console.log('ClientService initialized with baseURL:', this.baseURL);

  }

  // Remove empty-string values (and trim strings) to avoid sending invalid enum '' to backend
  sanitizePayload(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const cloned = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      // Preserve Date objects by converting to ISO strings
      if (val instanceof Date) {
        cloned[key] = val.toISOString();
        continue;
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') continue; // skip empty strings
        cloned[key] = trimmed;
      } else if (val === null || val === undefined) {
        continue;
      } else if (Array.isArray(val)) {
        // keep array but sanitize elements if they are objects
        cloned[key] = val
          .map((it) => (typeof it === 'object' ? this.sanitizePayload(it) : it))
          .filter((it) => !(it === undefined || it === null));
        if (cloned[key].length === 0) delete cloned[key];
      } else if (typeof val === 'object') {
        const nested = this.sanitizePayload(val);
        if (nested && (Array.isArray(nested) ? nested.length > 0 : Object.keys(nested).length > 0)) {
          cloned[key] = nested;
        }
      } else {
        cloned[key] = val;
      }
    }
    return cloned;
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

  // Get all clients
  async getClients() {
    try {
      console.log('Fetching clients from:', this.baseURL); // Debug log
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  }

  // Get clients filtered by followStatus (and role visibility on server)
  async getClientsByFollowupStatus(followupStatus, startDate, endDate) {
    try {
      const params = new URLSearchParams();
      if (followupStatus) params.set('followupStatus', followupStatus);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const url = `${this.baseURL}?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching clients by followStatus:', error);
      throw error;
    }
  }

  // Get single client by ID
  async getClient(id) {
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
      console.error('Error fetching client:', error);
      throw error;
    }
  }

  // Create new client
  async createClient_old(clientData) {
    try {
      console.log('Creating client at:', this.baseURL); // Debug log
      console.log('Client data:', clientData); // Debug log

      const payload = this.sanitizePayload(clientData);
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status); // Debug log
      console.log('Response headers:', response.headers); // Debug log

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }

  async createClient(clientData) {
    try {
      console.log('Creating client at:', this.baseURL);

      const payload = this.sanitizePayload(clientData);

      // Add notification control - check if it's a bulk operation
      if (clientData.disableNotifications || clientData.isBulkImport) {
        payload.disableNotifications = true;
      }

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }

  // Update client
  async updateClient(id, clientData) {
    try {
      const formData = new FormData();
      formData.append('data', JSON.stringify(this.sanitizePayload(clientData)));

      console.log('Creating client at:', this.baseURL); // Debug log
      console.log('Client data:', clientData); // Debug log

      if (clientData.profilePictureFile) {
        formData.append('profilePicture', clientData.profilePictureFile);
      }

      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // no Content-Type! fetch sets it automatically
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  }

  // Delete client
  async deleteClient(id) {
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
      console.error('Error deleting client:', error);
      throw error;
    }
  }

  // Bulk delete clients
  async bulkDeleteClients(ids) {
    try {
      const response = await fetch(`${this.baseURL}/bulk-delete`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error bulk deleting clients:', error);
      throw error;
    }
  }

  // Add this to your clientService
  // Updated bulkCreateClients method
  async bulkCreateClients(clientsData) {
    try {
      const payload = {
        clients: clientsData.map(client => this.sanitizePayload(client)),
        options: {
          disableNotifications: true,
          isBulkImport: true
        }
      };

      console.log('Bulk creating clients:', payload.clients.length, 'clients');

      const response = await fetch(`${this.baseURL}/bulk-import`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error bulk creating clients:', error);
      throw error;
    }
  }

  async createClientWithFile(clientData, profileImage) {
    try {
      console.log('Creating client with file at:', this.baseURL);
      console.log('Profile image:', profileImage);

      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();

      // Append client data as JSON string
      formDataToSend.append("data", JSON.stringify(this.sanitizePayload(clientData)));

      // Append profile image if provided - using consistent field name
      if (profileImage) {
        console.log('Appending profile image:', profileImage.name, profileImage.type, profileImage.size);
        formDataToSend.append("profilePicture", profileImage);
      }

      const response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
          // Note: Don't set Content-Type header - FormData sets it automatically with boundary
        },
        body: formDataToSend,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = "Failed to create client with file";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in createClientWithFile:', error);
      throw error;
    }
  }

  async updateClientWithFile(id, clientData, profileImage) {
    try {
      console.log('Updating client with file at:', `${this.baseURL}/${id}`);
      console.log('Profile image for update:', profileImage);

      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();

      // Append client data as JSON string
      formDataToSend.append("data", JSON.stringify(this.sanitizePayload(clientData)));

      // Append profile image if provided
      if (profileImage) {
        console.log('Appending profile image for update:', profileImage.name, profileImage.type, profileImage.size);
        formDataToSend.append("profilePicture", profileImage);
      }

      const response = await fetch(`${this.baseURL}/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
          // Note: Don't set Content-Type header - FormData sets it automatically with boundary
        },
        body: formDataToSend,
      });

      console.log('Update response status:', response.status);

      if (!response.ok) {
        let errorMessage = "Failed to update client with file";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in updateClientWithFile:', error);
      throw error;
    }
  }
}

export default new ClientService;
