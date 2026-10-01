const axios = require('axios');

// Quick test for task reminders
async function quickTest() {
  try {
    console.log('🧪 Quick test: Creating a task with reminders in 1 minute...');

    // Create task with reminder in 1 minute
    const taskDateTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
    const taskData = {
      title: `Quick Test Task ${Date.now()}`,
      project: 'Test Project',
      priority: 'high',
      date: taskDateTime,
      assignedEmployees: [], // No assigned employees for simplicity
      notes: 'Quick test task for reminder functionality',
      status: 'pending',
      reminders: [1] // 1 minute before
    };

    // Try to create task without auth first to see what happens
    const response = await axios.post(
      'http://localhost:5000/api/tasks/clients/test-client-id/tasks',
      taskData
    );

    console.log('✅ Task created:', response.data);

  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }
}

quickTest();
