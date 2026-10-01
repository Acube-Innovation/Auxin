const axios = require('axios');
const io = require('socket.io-client');

// Configuration
const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

// Test data
const TEST_USERS = {
  admin: {
    username: 'admin', // Use username instead of email for login
    password: 'admin123' // Replace with actual test password
  }
};

// Global variables
let adminToken = null;
let socket = null;
let testClientId = null;
let testEmployeeId = null;

// Helper functions
async function loginUser(userType) {
  try {
    console.log(`🔐 Attempting to login as ${userType}...`);
    const response = await axios.post(`${API_URL}/auth/login`, TEST_USERS[userType]);
    console.log(`✅ Successfully logged in as ${userType}`);
    return response.data.token;
  } catch (error) {
    console.error(`❌ Failed to login as ${userType}:`, error.response?.data || error.message);
    return null;
  }
}

async function createTestClient(token) {
  try {
    console.log('🏢 Creating test client...');
    const response = await axios.post(
      `${API_URL}/clients`,
      {
        companyName: `Test Client ${Date.now()}`,
        email: `testclient${Date.now()}@example.com`,
        phone: '1234567890',
        disableNotifications: true // Disable notifications to avoid spam
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✅ Test client created:', response.data._id);
    return response.data._id;
  } catch (error) {
    console.error('❌ Failed to create test client:', error.response?.data || error.message);
    return null;
  }
}

async function getTestEmployee(token) {
  try {
    console.log('👤 Getting test employee...');
    const response = await axios.get(
      `${API_URL}/employees`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (response.data && response.data.length > 0) {
      console.log('✅ Using existing employee:', response.data[0]._id);
      return response.data[0]._id;
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to get employees:', error.response?.data || error.message);
    return null;
  }
}

function setupSocket() {
  return new Promise((resolve) => {
    console.log('🔌 Connecting to Socket.IO...');
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      // Join as admin user
      socket.emit('join-user', { userId: 'admin-user-id', role: 'admin' });
      resolve();
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    // Listen for reminder notifications
    socket.on('event-reminder', (data) => {
      console.log('🔔 EVENT REMINDER RECEIVED:', data);
    });

    socket.on('task-reminder', (data) => {
      console.log('🔔 TASK REMINDER RECEIVED:', data);
    });

    socket.on('notification', (data) => {
      console.log('🔔 GENERAL NOTIFICATION RECEIVED:', data);
    });
  });
}

async function testEventReminders() {
  console.log('\n📅 === TESTING EVENT REMINDERS ===');

  // Create event with reminders (5 minutes and 10 minutes before)
  const eventDateTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
  const eventData = {
    eventName: `Test Event ${Date.now()}`,
    eventType: 'Meeting',
    date: eventDateTime.toISOString().split('T')[0],
    time: eventDateTime.toTimeString().split(' ')[0].substring(0, 5),
    notes: 'Test event for reminder functionality',
    assignedTeamMembers: testEmployeeId ? [testEmployeeId] : [],
    reminders: [5, 10] // 5 and 10 minutes before
  };

  try {
    console.log('📅 Creating event with reminders...');
    const response = await axios.post(
      `${API_URL}/clients/${testClientId}/events`,
      eventData,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    console.log('✅ Event created successfully:', response.data.event._id);

    console.log('⏰ Waiting for reminders... (This will take about 5-10 minutes)');
    console.log('🔔 Watch for reminder notifications in the console');

    // Wait for 12 minutes to see both reminders
    await new Promise(resolve => setTimeout(resolve, 12 * 60 * 1000));

  } catch (error) {
    console.error('❌ Failed to create event:', error.response?.data || error.message);
  }
}

async function testTaskReminders() {
  console.log('\n📋 === TESTING TASK REMINDERS ===');

  // Create task with reminders (3 minutes and 7 minutes before)
  const taskDateTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  const taskData = {
    title: `Test Task ${Date.now()}`,
    project: 'Test Project',
    priority: 'high',
    date: taskDateTime,
    assignedEmployees: testEmployeeId ? [testEmployeeId] : [],
    notes: 'Test task for reminder functionality',
    status: 'pending',
    reminders: [3, 7] // 3 and 7 minutes before
  };

  try {
    console.log('📋 Creating task with reminders...');
    const response = await axios.post(
      `${API_URL}/tasks/clients/${testClientId}/tasks`,
      taskData,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    console.log('✅ Task created successfully:', response.data._id);

    console.log('⏰ Waiting for reminders... (This will take about 3-7 minutes)');
    console.log('🔔 Watch for reminder notifications in the console');

    // Wait for 8 minutes to see both reminders
    await new Promise(resolve => setTimeout(resolve, 8 * 60 * 1000));

  } catch (error) {
    console.error('❌ Failed to create task:', error.response?.data || error.message);
  }
}

async function testEdgeCases() {
  console.log('\n⚠️ === TESTING EDGE CASES ===');

  // Test 1: Event with past reminders (should not trigger)
  console.log('🧪 Testing past reminders (should not trigger)...');
  const pastEventDateTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const pastEventData = {
    eventName: `Past Test Event ${Date.now()}`,
    eventType: 'Meeting',
    date: pastEventDateTime.toISOString().split('T')[0],
    time: pastEventDateTime.toTimeString().split(' ')[0].substring(0, 5),
    notes: 'Past event test',
    assignedTeamMembers: testEmployeeId ? [testEmployeeId] : [],
    reminders: [5] // 5 minutes before (which is in the past)
  };

  try {
    const response = await axios.post(
      `${API_URL}/clients/${testClientId}/events`,
      pastEventData,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    console.log('✅ Past event created (reminders should not trigger):', response.data.event._id);
  } catch (error) {
    console.error('❌ Failed to create past event:', error.response?.data || error.message);
  }

  // Test 2: Event without assigned members
  console.log('🧪 Testing event without assigned members...');
  const noMembersEventDateTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  const noMembersEventData = {
    eventName: `No Members Test Event ${Date.now()}`,
    eventType: 'Meeting',
    date: noMembersEventDateTime.toISOString().split('T')[0],
    time: noMembersEventDateTime.toTimeString().split(' ')[0].substring(0, 5),
    notes: 'Event without assigned members',
    assignedTeamMembers: [], // Empty array
    reminders: [2] // 2 minutes before
  };

  try {
    const response = await axios.post(
      `${API_URL}/clients/${testClientId}/events`,
      noMembersEventData,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    console.log('✅ No-members event created:', response.data.event._id);
    console.log('⏰ Waiting 3 minutes for reminder...');
    await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
  } catch (error) {
    console.error('❌ Failed to create no-members event:', error.response?.data || error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting reminder functionality tests...\n');

  try {
    // Setup
    adminToken = await loginUser('admin');
    if (!adminToken) {
      console.error('❌ Cannot proceed without admin login');
      return;
    }

    await setupSocket();

    testClientId = await createTestClient(adminToken);
    if (!testClientId) {
      console.error('❌ Cannot proceed without test client');
      return;
    }

    testEmployeeId = await getTestEmployee(adminToken);

    // Run tests
    await testEventReminders();
    await testTaskReminders();
    await testEdgeCases();

    console.log('\n✅ All tests completed!');
    console.log('📊 Check the console output above for reminder notifications');
    console.log('🔍 Verify that:');
    console.log('   - Reminders were triggered at the correct times');
    console.log('   - Payloads contain correct metadata');
    console.log('   - Notifications were sent to appropriate user rooms');
    console.log('   - Past reminders did not trigger');
    console.log('   - Events/tasks without members still work');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    if (socket) {
      socket.disconnect();
    }
    process.exit(0);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  if (socket) {
    socket.disconnect();
  }
  process.exit(0);
});

// Run the tests
runTests();
