# Backend Connection Setup for AddClientModal

## Overview
This guide explains how to connect your AddClientModal to the backend so it can save client data to the database.

## What's Already Set Up

### 1. Backend Components Created:
- ✅ **Client Model** (`server/models/Client.js`) - MongoDB schema for clients
- ✅ **Client Routes** (`server/routes/clients.js`) - API endpoints for CRUD operations
- ✅ **Server Integration** - Routes added to `server/server.js`
- ✅ **Frontend Service** (`frontend/src/services/clientService.js`) - API communication layer
- ✅ **Modal Integration** - AddClientModal updated to use the service

### 2. API Endpoints Available:
- `POST /api/clients` - Create new client
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get single client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

## Setup Steps

### Step 1: Environment Configuration
Create a `.env` file in your `server` directory:

```env
MONGO_URI=mongodb://localhost:27017/auxin_app
PORT=5000
JWT_SECRET=your_secret_key_here
```

### Step 2: Frontend Environment (Optional)
Create a `.env` file in your `frontend` directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

If you don't create this, it will default to `http://localhost:5000/api`.

### Step 3: Start the Backend
```bash
cd server
npm install
npm start
```

### Step 4: Start the Frontend
```bash
cd frontend
npm install
npm start
```

## How It Works

### 1. User Fills Form
- User completes the 3-step form in AddClientModal
- All form data is collected in the `formData` state

### 2. Form Submission
When user clicks "Finish":
- Required fields are validated (Company Name & Email)
- Empty fields are filtered out
- Date strings are converted to Date objects
- Numbers are properly typed
- Data is sent to backend via `clientService.createClient()`

### 3. Backend Processing
- Request reaches `POST /api/clients` endpoint
- Data is validated against the Client schema
- Client is saved to MongoDB
- Response includes the saved client data

### 4. Success Handling
- Modal closes automatically
- Form resets to initial state
- `onSubmit` callback is called with saved client data
- User can see the new client in the list

## Data Flow

```
AddClientModal → clientService → Backend API → MongoDB → Response → UI Update
```

## Error Handling

### Frontend Errors:
- **Validation Errors**: Required field validation
- **Network Errors**: Connection issues, server down
- **API Errors**: Backend validation failures

### Backend Errors:
- **Schema Validation**: Invalid data types
- **Database Errors**: Connection issues, duplicate keys
- **Authentication Errors**: Invalid/missing JWT token

## Testing the Connection

### 1. Check Backend is Running
```bash
curl http://localhost:5000/api/protected-data
```

### 2. Test Client Creation
```bash
curl -X POST http://localhost:5000/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "companyName": "Test Company",
    "email": "test@example.com"
  }'
```

### 3. Check Database
```bash
# Connect to MongoDB
mongosh
use auxin_app
db.clients.find()
```

## Troubleshooting

### Common Issues:

1. **CORS Errors**
   - Ensure frontend URL is in `allowedOrigins` in `server.js`
   - Check CORS configuration

2. **Authentication Errors**
   - Verify JWT token is in localStorage
   - Check `authMiddleware` is working

3. **Database Connection**
   - Ensure MongoDB is running
   - Check connection string in `.env`

4. **Port Conflicts**
   - Change PORT in `.env` if 5000 is busy
   - Update frontend config accordingly

### Debug Steps:

1. **Check Console Logs**
   - Frontend: Browser console
   - Backend: Terminal running server

2. **Verify API Endpoints**
   - Test with Postman or curl
   - Check network tab in browser

3. **Database Verification**
   - Connect to MongoDB directly
   - Check if collections exist

## Security Features

- **JWT Authentication**: All client endpoints require valid token
- **Input Validation**: Backend validates all incoming data
- **CORS Protection**: Only allowed origins can access API
- **Error Sanitization**: Sensitive error details are not exposed

## Next Steps

After successful connection:

1. **Update ClientsTable**: Modify to fetch real data from backend
2. **Add Edit Functionality**: Implement client editing
3. **Add Delete Functionality**: Implement client deletion
4. **Add Search/Filter**: Implement backend search
5. **Add Pagination**: Handle large datasets

## Support

If you encounter issues:
1. Check console logs for error messages
2. Verify all environment variables are set
3. Ensure MongoDB is running and accessible
4. Check network connectivity between frontend and backend
