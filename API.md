# API Documentation

This document describes the available API endpoints in the Medal Challenges & Rewards application.

## Base URL

```
http://localhost:3000
```

## Authentication

The application uses session-based authentication with Passport.js. Users must be authenticated via Google OAuth2 to access protected endpoints.

### Session Cookie

After successful authentication, a session cookie (`connect.sid`) is set and must be included in subsequent requests.

## Endpoints

### Public Endpoints

#### GET /

Home page - landing page with login button.

**Response**: HTML page

---

### Authentication Endpoints

#### GET /auth/google

Initiates Google OAuth2 authentication flow.

**Response**: Redirects to Google login

---

#### GET /auth/google/callback

Google OAuth2 callback URL.

**Query Parameters:**
- `code` - Authorization code from Google

**Response**: Redirects to `/dashboard` on success, `/` on failure

---

#### GET /auth/strava

Initiates Strava OAuth2 authentication flow. User must be logged in.

**Authentication**: Required

**Response**: Redirects to Strava authorization page

---

#### GET /auth/strava/callback

Strava OAuth2 callback URL.

**Authentication**: Required

**Query Parameters:**
- `code` - Authorization code from Strava

**Response**: Redirects to `/dashboard?strava=connected` on success

---

#### GET /auth/strava/disconnect

Disconnects user's Strava account.

**Authentication**: Required

**Response**: Redirects to `/dashboard?strava=disconnected`

---

#### GET /logout

Logs out the current user and destroys the session.

**Authentication**: Required

**Response**: Redirects to `/`

---

### Protected Endpoints

All endpoints below require authentication.

#### GET /dashboard

User dashboard showing connected apps and sync status.

**Authentication**: Required

**Response**: HTML page

---

#### GET /activities

List all activities for the authenticated user with optional filtering.

**Authentication**: Required

**Query Parameters:**
- `type` (optional) - Filter by activity type (e.g., "Run", "Ride")
- `source` (optional) - Filter by source ("strava" or "garmin")

**Response**: HTML page with activity list

**Example:**
```
GET /activities?type=Run&source=strava
```

---

#### POST /activities/sync/strava

Syncs activities from Strava API to the database.

**Authentication**: Required

**Prerequisites**: User must have Strava connected

**Request Body**: None

**Response:**
```json
{
  "success": true,
  "synced": 10,
  "skipped": 5,
  "total": 15
}
```

**Response Fields:**
- `success` - Boolean indicating if sync was successful
- `synced` - Number of new activities synced
- `skipped` - Number of activities already in database
- `total` - Total activities fetched from Strava

**Error Response:**
```json
{
  "error": "Strava not connected"
}
```

**Status Codes:**
- `200` - Success
- `400` - Strava not connected
- `500` - Server error

---

#### GET /activities/types

Get list of unique activity types for the authenticated user.

**Authentication**: Required

**Response:**
```json
["Run", "Ride", "Swim", "Walk"]
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

## Data Models

### User

```javascript
{
  _id: ObjectId,
  googleId: String,
  name: String,
  email: String,
  avatar: String,
  stravaConnected: Boolean,
  stravaId: String,
  stravaAccessToken: String,
  stravaRefreshToken: String,
  garminConnected: Boolean,
  garminAccessToken: String,
  garminAccessTokenSecret: String,
  createdAt: Date
}
```

### Activity

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  source: String, // "strava" or "garmin"
  sourceActivityId: String,
  name: String,
  type: String,
  distance: Number, // meters
  movingTime: Number, // seconds
  totalTime: Number, // seconds
  startDate: Date,
  averageSpeed: Number, // m/s
  maxSpeed: Number, // m/s
  calories: Number,
  averageHeartrate: Number,
  maxHeartrate: Number,
  createdAt: Date
}
```

## Rate Limits

### Strava API Limits

The Strava API has the following rate limits:
- 100 requests per 15 minutes
- 1,000 requests per day

When syncing activities, the application fetches up to 50 activities per request to stay within these limits.

## Error Responses

### 401 Unauthorized

Returned when accessing protected endpoints without authentication.

**Response:**
```
Redirects to /
```

### 400 Bad Request

Returned when request is invalid (e.g., trying to sync without connecting Strava).

**Response:**
```json
{
  "error": "Error message"
}
```

### 500 Internal Server Error

Returned when a server error occurs.

**Response:**
```json
{
  "error": "Error message"
}
```

Or HTML error page (depending on request type).

## Client-Side JavaScript APIs

### Dashboard

#### syncStrava()

Triggers activity sync from Strava.

**Usage:**
```javascript
syncStrava();
```

Shows toast notification with sync results.

---

#### syncGarmin()

Placeholder for Garmin sync (not yet implemented).

**Usage:**
```javascript
syncGarmin();
```

---

#### showToast(message, type)

Displays a toast notification.

**Parameters:**
- `message` (string) - Message to display
- `type` (string) - 'success' or 'error'

**Usage:**
```javascript
showToast('Activity synced!', 'success');
showToast('Error occurred', 'error');
```

### Activities

#### loadActivityTypes()

Loads activity types for the filter dropdown.

**Usage:**
```javascript
loadActivityTypes();
```

Called automatically on page load.

## WebSocket / Real-time Updates

Currently not implemented. Activities require manual sync via the "Sync Activities" button.

**Future Enhancement**: Consider implementing WebSocket for real-time activity updates.

## Pagination

Currently not implemented. All activities are loaded at once.

**Future Enhancement**: Implement pagination for large activity lists:
```
GET /activities?page=1&limit=20
```

## Example API Usage

### Full Authentication and Sync Flow

```javascript
// 1. User clicks "Sign in with Google"
window.location.href = '/auth/google';

// 2. After Google OAuth, user is at /dashboard

// 3. User clicks "Connect Strava"
window.location.href = '/auth/strava';

// 4. After Strava OAuth, user is back at /dashboard

// 5. User clicks "Sync Activities"
fetch('/activities/sync/strava', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include' // Include session cookie
})
.then(response => response.json())
.then(data => {
  console.log(`Synced ${data.synced} activities`);
  window.location.href = '/activities';
})
.catch(error => console.error('Error:', error));

// 6. View activities with filtering
window.location.href = '/activities?type=Run&source=strava';
```

### Using curl

```bash
# Login flow requires browser for OAuth

# After logging in via browser, extract session cookie
# Then use it with curl:

SESSION_COOKIE="connect.sid=s%3A..."

# Sync Strava activities
curl -X POST http://localhost:3000/activities/sync/strava \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE"

# Get activity types
curl http://localhost:3000/activities/types \
  -H "Cookie: $SESSION_COOKIE"

# Get filtered activities (returns HTML)
curl "http://localhost:3000/activities?type=Run" \
  -H "Cookie: $SESSION_COOKIE"
```

## Security Considerations

1. **OAuth Tokens**: Never expose access tokens in client-side code
2. **HTTPS**: Use HTTPS in production for secure cookie transmission
3. **CSRF**: Consider adding CSRF protection for state-changing operations
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Input Validation**: All user inputs should be validated

## Testing

See [TESTING.md](TESTING.md) for detailed testing instructions.

## Changelog

### Version 1.0.0 (Initial Release)
- Google OAuth2 authentication
- Strava OAuth2 integration
- Activity sync from Strava
- Activity listing with filtering
- MongoDB data storage
