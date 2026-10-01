/**
 * Export utility functions for various data formats
 */

/**
 * Convert data to CSV format
 */
export const convertToCSV = (data, headers) => {
  if (!data || data.length === 0) return '';
  
  const headerRow = headers.join(',');
  const rows = data.map(row => {
    return headers.map(header => {
      const value = row[header] || '';
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
};

/**
 * Download data as CSV file
 */
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export client basic info to CSV
 */
export const exportClientBasicInfo = (clientData) => {
  if (!clientData) return;
  
  const data = [{
    'Company Name': clientData.companyName || 'Not provided',
    'Client Type': clientData.clientType || 'Not provided',
    'Lead Type': clientData.leadType || 'Not provided',
    'Email': clientData.email || 'Not provided',
    'Phone': clientData.phone || 'Not provided',
    'Primary Contact': clientData.primaryContactName || 'Not provided',
    'Designation': clientData.designation || 'Not provided',
    'Mobile': clientData.mobile || 'Not provided',
    'Website': clientData.website || 'Not provided',
    'Address': clientData.address || 'Not provided',
    'Country': clientData.country || 'Not provided',
    'Tax ID': clientData.taxId || 'Not provided',
    'Relationship Status': clientData.relationshipStatus || 'Not provided',
    'Industry Type': clientData.industryType || 'Not provided',
    'Cargo Type': clientData.cargoType || 'Not provided',
    'Account Manager': clientData.accountManager || 'Not provided',
    'Decision Maker': clientData.decisionMaker || 'Not provided',
    'Contract Type': clientData.contractType || 'Not provided',
    'Incoterms': clientData.incoterms || 'Not provided',
    'Lead Source': clientData.leadSource || 'Not provided',
    'Current Status': clientData.currentStatus || 'Not provided'
  }];
  
  const headers = Object.keys(data[0]);
  const csv = convertToCSV(data, headers);
  const filename = `${clientData.companyName || 'client'}_basic_info_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csv, filename);
};

/**
 * Export employee basic info to CSV
 */
export const exportEmployeeBasicInfo = (employeeData) => {
  if (!employeeData) return;
  
  const data = [{
    'Employee ID': employeeData.employeeId || 'Not provided',
    'Employee Name': employeeData.employeeName || 'Not provided',
    'Email ID': employeeData.emailId || 'Not provided',
    'Mobile Number': employeeData.mobile || 'Not provided',
    'Role': employeeData.role || 'Not provided',
    'Designation': employeeData.designation || 'Not provided',
    'Department': employeeData.department || 'Not provided',
    'Attendance Status': employeeData.attendance || 'Not provided',
    'Assigned Projects': employeeData.assignedProjects && Array.isArray(employeeData.assignedProjects)
      ? employeeData.assignedProjects.join('; ')
      : employeeData.assignedProjects || 'No projects assigned',
    'Profile Created': employeeData.createdAt ? new Date(employeeData.createdAt).toLocaleDateString() : 'Not available',
    'Last Updated': employeeData.updatedAt ? new Date(employeeData.updatedAt).toLocaleDateString() : 'Not available',
    'Status': 'Active'
  }];
  
  const headers = Object.keys(data[0]);
  const csv = convertToCSV(data, headers);
  const filename = `${employeeData.employeeName || 'employee'}_basic_info_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csv, filename);
};

/**
 * Export events/meetings to CSV
 */
export const exportEvents = (events, entityName = 'events') => {
  if (!events || events.length === 0) {
    alert('No events to export');
    return;
  }
  
  const data = events.map(event => ({
    'Event Name': event.title || event.eventName || '',
    'Date': event.start ? new Date(event.start).toLocaleDateString() : (event.date ? new Date(event.date).toLocaleDateString() : ''),
    'Time': event.start ? new Date(event.start).toLocaleTimeString() : (event.time || ''),
    'Event Type': event.eventType || 'Meeting',
    'Notes': event.notes || '',
    'Link': event.link || '',
    'Assigned Team Member': event.assignedTeamMember || '',
    'Color': event.color || ''
  }));
  
  const headers = ['Event Name', 'Date', 'Time', 'Event Type', 'Notes', 'Link', 'Assigned Team Member', 'Color'];
  const csv = convertToCSV(data, headers);
  const filename = `${entityName}_meetings_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csv, filename);
};

/**
 * Export documents list to CSV
 */
export const exportDocuments = (documents, entityName = 'documents') => {
  if (!documents || documents.length === 0) {
    alert('No documents to export');
    return;
  }
  
  const data = documents.map(doc => ({
    'File Name': doc.fileName || '',
    'File Size': doc.fileSize || '',
    'File Type': doc.fileType || doc.filetype || '',
    'Type': doc.type || '',
    'Uploaded By': doc.uploadedBy || '',
    'User Role': doc.userRole || '',
    'Upload Date': doc.uploadedDate || ''
  }));
  
  const headers = ['File Name', 'File Size', 'File Type', 'Type', 'Uploaded By', 'User Role', 'Upload Date'];
  const csv = convertToCSV(data, headers);
  const filename = `${entityName}_documents_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csv, filename);
};

/**
 * Export tasks to CSV
 */
export const exportTasks = (tasks, entityName = 'tasks') => {
  if (!tasks || tasks.length === 0) {
    alert('No tasks to export');
    return;
  }
  
  const data = tasks.map(task => ({
    'Task Title': task.title || '',
    'Date': task.date ? new Date(task.date).toLocaleDateString() : '',
    'Status': task.status || '',
    'Priority': task.priority || '',
    'Description': task.description || '',
    'Assigned To': task.assignedTo || '',
    'Created Date': task.createdAt ? new Date(task.createdAt).toLocaleDateString() : ''
  }));
  
  const headers = ['Task Title', 'Date', 'Status', 'Priority', 'Description', 'Assigned To', 'Created Date'];
  const csv = convertToCSV(data, headers);
  const filename = `${entityName}_tasks_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csv, filename);
};

/**
 * Print current page
 */
export const printPage = () => {
  window.print();
};

/**
 * Export to PDF (simplified - uses browser print to PDF)
 */
export const exportToPDF = () => {
  alert('Please use your browser\'s Print to PDF feature (Ctrl+P or Cmd+P)');
  window.print();
};

/**
 * Export to TXT format
 */
export const exportToTXT = (data, filename) => {
  const blob = new Blob([data], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
