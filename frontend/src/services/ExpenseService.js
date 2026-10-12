import config from '../config/config';

class ExpenseService {
    constructor() {
        let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

        if (!baseURL.endsWith('/api')) {
            if (baseURL.endsWith('/')) {
                baseURL += 'api';
            } else {
                baseURL += '/api';
            }
        }

        this.baseURL = `${baseURL}/expenses`;
    }

    getAuthToken() {
        return localStorage.getItem('token');
    }

    getAuthHeaders(includeContentType = true) {
        const token = this.getAuthToken();
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }

    async createExpense(expenseData) {
        try {
            // Check if expenseData is FormData (for file uploads)
            const isFormData = expenseData instanceof FormData;
            
            const response = await fetch(`${this.baseURL}/create`, {
                method: 'POST',
                headers: isFormData ? { 'Authorization': `Bearer ${this.getAuthToken()}` } : this.getAuthHeaders(),
                body: isFormData ? expenseData : JSON.stringify(expenseData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating expense:', error);
            throw error;
        }
    }

    async getMyExpenses() {
        try {
            const response = await fetch(`${this.baseURL}/my-expenses`, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching my expenses:', error);
            throw error;
        }
    }

    async getAllExpenses(status = '') {
        try {
            let url = `${this.baseURL}/all`;
            if (status) {
                url += `?status=${encodeURIComponent(status)}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching all expenses:', error);
            throw error;
        }
    }

    async hodAction(expenseId, action, remarks = '') {
        try {
            const response = await fetch(`${this.baseURL}/hod-action/${expenseId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ action, remarks }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error performing HOD action:', error);
            throw error;
        }
    }

    async hrAction(expenseId, action, remarks = '') {
        try {
            const response = await fetch(`${this.baseURL}/hr-action/${expenseId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ action, remarks }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error performing HR action:', error);
            throw error;
        }
    }

    async deleteExpense(expenseId) {
        try {
            const response = await fetch(`${this.baseURL}/${expenseId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    }

    async downloadDocument(expenseId, expenseTitle) {
        try {
            const response = await fetch(`${this.baseURL}/document/${expenseId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.getAuthToken()}` },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to download document');
            }

            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `expense-document-${expenseTitle}.pdf`;
            
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading document:', error);
            throw error;
        }
    }
}

const expenseServiceInstance = new ExpenseService();
export default expenseServiceInstance;
