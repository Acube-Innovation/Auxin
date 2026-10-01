import config from '../config/config';

class EmployeeService {
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

    this.baseURL = `${baseURL}/employees`;
    this.attendanceURL = `${baseURL}/attendance`;
    console.log('EmployeeService initialized with baseURL:', this.baseURL);
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

  // Get all employees
  async getEmployees() {
    try {
      console.log('Fetching employees from:', this.baseURL);
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  }

  // Get single employee by ID
  async getEmployee(id) {
    try {
      console.log('get one employee', this.baseURL);
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employee:', error);
      throw error;
    }
  }

  // Create new employee
  async createEmployee(employeeData) {
    try {
      console.log('Creating employee at:', this.baseURL);
      console.log('Employee data:', employeeData);

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(employeeData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  }

  // // Update employee
  // async updateEmployee(id, employeeData) {
  //   try {
  //     const formData = new FormData();
  //     formData.append('data', JSON.stringify(employeeData));

  //     console.log('Updating employee at:', this.baseURL);
  //     console.log('Employee data:', employeeData);

  //     if (employeeData.profilePhotoFile) {
  //       formData.append('profilePhoto', employeeData.profilePhotoFile);
  //     }

  //     const response = await fetch(`${this.baseURL}/${id}`, {
  //       method: 'PUT',
  //       headers: {
  //         'Authorization': `Bearer ${localStorage.getItem('token')}`
  //       },
  //       body: formData,
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  //     }

  //     return await response.json();
  //   } catch (error) {
  //     console.error('Error updating employee:', error);
  //     throw error;
  //   }
  // }


  // Update employee (supports both with and without file)
// EmployeeService.js - updateEmployee method
async updateEmployee(id, employeeData, profileImageFile = null) {
  try {
    const formData = new FormData();
    
    // Clean the data
    const dataToSend = { ...employeeData };
    
    // Make sure assignedProjects is an array
    if (dataToSend.assignedProjects) {
      if (!Array.isArray(dataToSend.assignedProjects)) {
        dataToSend.assignedProjects = [dataToSend.assignedProjects];
      }
      // Remove any null/undefined values
      dataToSend.assignedProjects = dataToSend.assignedProjects.filter(Boolean);
    }
    
    console.log('📤 Sending employee data:', {
      id,
      dataKeys: Object.keys(dataToSend),
      assignedProjects: dataToSend.assignedProjects,
      assignedProjectsLength: dataToSend.assignedProjects?.length || 0
    });
    
    formData.append('data', JSON.stringify(dataToSend));

    if (profileImageFile) {
      console.log('📤 Adding profile image:', profileImageFile.name);
      formData.append('profilePhoto', profileImageFile);
    }

    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });

    console.log('📥 Response status:', response.status);
    
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      const text = await response.text();
      console.error('Failed to parse JSON:', text.substring(0, 200));
      throw new Error(`Server returned invalid JSON (${response.status}): ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      console.error('Server error response:', responseData);
      throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Employee update successful:', responseData);
    return responseData.employee || responseData;

  } catch (error) {
    console.error('❌ Error updating employee:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Remove or keep updateEmployeeWithFile if needed elsewhere
// async updateEmployeeWithFile(id, employeeData, profileImageFile) {
//   return this.updateEmployee(id, employeeData, profileImageFile);
// }

  // Delete employee
  async deleteEmployee(id) {
    try {
      console.log(`[EmployeeService] Deleting employee ${id}...`);
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      console.log(`[EmployeeService] Delete response status: ${response.status}`);

      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          console.error(`[EmployeeService] Failed to parse error JSON. Body:`, text.substring(0, 200));
          errorData = { message: `HTTP error! status: ${response.status}. Response is not JSON.` };
        }
        console.error(`[EmployeeService] Delete failed:`, errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }

  // Bulk delete employees
  async bulkDeleteEmployees(ids) {
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
      console.error('Error bulk deleting employees:', error);
      throw error;
    }
  }

  // Create employee with profile photo
  // async createEmployeeWithFile(employeeData, profileImage) {
  //   try {
  //     console.log('Creating employee with file at:', this.baseURL);
  //     console.log('Profile image:', profileImage);

  //     const token = localStorage.getItem("token");
  //     const formDataToSend = new FormData();

  //     // Append employee data as JSON string
  //     formDataToSend.append("data", JSON.stringify(employeeData));

  //     // Append profile image if provided
  //     if (profileImage) {
  //       console.log('Appending profile image:', profileImage.name, profileImage.type, profileImage.size);
  //       formDataToSend.append("profilePhoto", profileImage);
  //     }

  //     const response = await fetch(this.baseURL, {
  //       method: "POST",
  //       headers: {
  //         Authorization: `Bearer ${token}`
  //       },
  //       body: formDataToSend,
  //     });

  //     console.log('Response status:', response.status);

  //     if (!response.ok) {
  //       let errorMessage = "Failed to create employee with file";
  //       try {
  //         const errorData = await response.json();
  //         errorMessage = errorData.message || errorMessage;
  //       } catch (e) {
  //         errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
  //       }
  //       throw new Error(errorMessage);
  //     }

  //     return await response.json();
  //   } catch (error) {
  //     console.error('Error in createEmployeeWithFile:', error);
  //     throw error;
  //   }
  // }

  async createEmployeeWithFile(employeeData, profileImageFile = null) {
  try {
    const formData = new FormData();
    
    const dataToSend = { ...employeeData };
    delete dataToSend.profilePhotoFile;
    
    formData.append('data', JSON.stringify(dataToSend));

    if (profileImageFile) {
      formData.append('profilePhoto', profileImageFile);
    }

    const response = await fetch(`${this.baseURL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Handle duplicate email error specifically
      if (response.status === 400 && responseData.error?.includes('Duplicate')) {
        throw new Error(responseData.message || 'Duplicate entry found');
      }
      throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
    }

    return responseData;
  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
}

  // Update employee with profile photo
  async updateEmployeeWithFile(id, employeeData, profileImage) {
    try {
      console.log('Updating employee with file at:', `${this.baseURL}/${id}`);
      console.log('Profile image for update:', profileImage);

      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();

      // Append employee data as JSON string
      formDataToSend.append("data", JSON.stringify(employeeData));

      // Append profile image if provided
      if (profileImage) {
        console.log('Appending profile image for update:', profileImage.name, profileImage.type, profileImage.size);
        formDataToSend.append("profilePhoto", profileImage);
      }

      const response = await fetch(`${this.baseURL}/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formDataToSend,
      });

      console.log('Update response status:', response.status);

      if (!response.ok) {
        let errorMessage = "Failed to update employee with file";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in updateEmployeeWithFile:', error);
      throw error;
    }
  }

  // Additional employee-specific methods
  async getEmployeesByDepartment(department) {
    try {
      const response = await fetch(`${this.baseURL}/department/${department}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employees by department:', error);
      throw error;
    }
  }

  async updateEmployeeAttendance(id, attendanceStatus) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(this.attendanceURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          employeeId: id,
          date: today,
          status: attendanceStatus
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        ...data,
        employee: {
          _id: id,
          attendance: attendanceStatus
        }
      };
    } catch (error) {
      console.error('Error updating employee attendance:', error);
      throw error;
    }
  }

  async assignProjectToEmployee(id, projectName) {
    try {
      const response = await fetch(`${this.baseURL}/${id}/projects`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ project: projectName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error assigning project to employee:', error);
      throw error;
    }
  }

  async removeProjectFromEmployee(id, projectName) {
    try {
      const response = await fetch(`${this.baseURL}/${id}/projects`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ project: projectName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error removing project from employee:', error);
      throw error;
    }
  }
}

export default new EmployeeService();