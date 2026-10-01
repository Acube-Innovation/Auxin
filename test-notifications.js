// Test script for notifications
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5000/api'; // Adjust if your server runs on a different port
const TEST_USERS = {
  admin: {
    email: 'admin@example.com',
    password: 'adminpassword' // Replace with actual test password
  },
  sales_executive: {
    email: 'sales@example.com',
    password: 'salespassword' // Replace with actual test password
  }
};

// Test functions
async function loginUser(userType) {
  try {
    console.log(`Attempting to login as ${userType}...`);
    const response = await axios.post(`${API_URL}/auth/login`, TEST_USERS[userType]);
    console.log(`Successfully logged in as ${userType}`);
    return response.data.token;
  } catch (error) {
    console.error(`Failed to login as ${userType}:`, error.response?.data || error.message);
    return null;
  }
}

async function createTestTask(token) {
  try {
    console.log('Creating test task...');
    const response = await axios.post(
      `${API_URL}/tasks`,
      {
        title: `Test Task ${Date.now()}`,
        description: 'This is a test task created by the notification test script',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('Test task created successfully:', response.data._id);
    return response.data;
  } catch (error) {
    console.error('Failed to create test task:', error.response?.data || error.message);
    return null;
  }
}

async function createTestEvent(token) {
  try {
    console.log('Creating test event...');
    const response = await axios.post(
      `${API_URL}/employees/events`,
      {
        title: `Test Event ${Date.now()}`,
        description: 'This is a test event created by the notification test script',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        location: 'Test Location'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('Test event created successfully:', response.data._id);
    return response.data;
  } catch (error) {
    console.error('Failed to create test event:', error.response?.data || error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('Starting notification tests...');
  
  // Login as admin
  const adminToken = await loginUser('admin');
  if (!adminToken) {
    console.error('Cannot proceed with tests without admin login');
    return;
  }
  
  // Create test task
  const task = await createTestTask(adminToken);
  
  // Create test event
  const event = await createTestEvent(adminToken);
  
  console.log('\nTest Summary:');
  console.log('-------------');
  console.log('1. Admin login:', adminToken ? 'SUCCESS' : 'FAILED');
  console.log('2. Create task:', task ? 'SUCCESS' : 'FAILED');
  console.log('3. Create event:', event ? 'SUCCESS' : 'FAILED');
  
  console.log('\nTest completed. Please check the browser notifications in your application.');
  console.log('Make sure you have different user accounts logged in to verify user-specific notifications.');
}

// Run the tests
runTests().catch(console.error);