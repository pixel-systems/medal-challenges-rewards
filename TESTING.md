# Testing Guide for Medal Challenges & Rewards

This guide will help you test the application without needing actual OAuth credentials.

## Prerequisites for Testing

### 1. Install MongoDB

#### Using Docker (Recommended for quick testing):
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

#### On macOS:
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### On Ubuntu:
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongod
```

### 2. Configure Environment

Create a `.env` file from the example:
```bash
cp .env.example .env
```

For testing purposes, you can use placeholder values for OAuth credentials. The app will start but OAuth login won't work until you provide real credentials.

## Testing Without OAuth Credentials

Since setting up OAuth credentials requires:
1. Creating Google Cloud Console project
2. Creating Strava API application
3. Configuring redirect URLs

You can test the application structure and UI without them:

### 1. Start the Server

```bash
npm install
npm start
```

The server should start successfully on http://localhost:3000

### 2. Test the Home Page

Visit http://localhost:3000

You should see:
- Landing page with "Medal Challenges & Rewards" title
- "Sign in with Google" button
- Features section

### 3. Verify Database Connection

Check the console output. You should see:
```
Connected to MongoDB
Server running on http://localhost:3000
```

## Testing With OAuth Credentials

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/auth/google/callback`
5. Copy Client ID and Client Secret to `.env` file

### Strava OAuth Setup

1. Visit [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new application:
   - Application Name: Medal Challenges (or any name)
   - Category: Fitness
   - Website: http://localhost:3000
   - Authorization Callback Domain: localhost
3. Copy Client ID and Client Secret to `.env` file

### Full Flow Testing

Once OAuth is configured:

1. **Login Flow**
   - Visit http://localhost:3000
   - Click "Sign in with Google"
   - Complete Google OAuth flow
   - Should redirect to /dashboard

2. **Dashboard**
   - Should show user profile (avatar, name)
   - Should show Strava connection status (not connected)
   - Should show Garmin connection status (placeholder)

3. **Connect Strava**
   - Click "Connect Strava" button
   - Complete Strava OAuth flow
   - Should redirect back to dashboard with "connected" status

4. **Sync Activities**
   - Click "Sync Activities" button
   - Should fetch activities from Strava API
   - Toast notification should show number of synced activities

5. **View Activities**
   - Navigate to Activities page
   - Should display list of activities with:
     - Activity name
     - Type (Run, Ride, etc.)
     - Distance
     - Duration
     - Date
     - Source badge (Strava)

6. **Filter Activities**
   - Use "Fitness App" dropdown to filter by source
   - Use "Activity Type" dropdown to filter by type
   - Activities list should update accordingly

7. **Disconnect Strava**
   - Return to Dashboard
   - Click "Disconnect" under Strava
   - Should disconnect and remove stored tokens

8. **Logout**
   - Click "Logout" button
   - Should redirect to home page

## API Testing with curl

### Test Activity Sync (requires logged-in session)

```bash
# Note: This requires valid session cookie
curl -X POST http://localhost:3000/activities/sync/strava \
  -H "Content-Type: application/json" \
  -b "connect.sid=your-session-id"
```

### Test Activity Types Endpoint

```bash
curl http://localhost:3000/activities/types \
  -b "connect.sid=your-session-id"
```

## Database Verification

### Check MongoDB Collections

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/medal-challenges

# List collections
show collections

# View users
db.users.find().pretty()

# View activities
db.activities.find().pretty()

# Count activities by source
db.activities.aggregate([
  { $group: { _id: "$source", count: { $sum: 1 } } }
])

# Count activities by type
db.activities.aggregate([
  { $group: { _id: "$type", count: { $sum: 1 } } }
])
```

## Common Issues

### MongoDB Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution**: Ensure MongoDB is running:
```bash
# Check if MongoDB is running
pgrep mongod

# Start MongoDB
# Docker: docker start mongodb
# macOS: brew services start mongodb-community
# Ubuntu: sudo systemctl start mongod
```

### OAuth Redirect URI Mismatch

```
Error: redirect_uri_mismatch
```

**Solution**: Ensure the callback URL in your OAuth app settings exactly matches the URL in `.env`:
- Google: `http://localhost:3000/auth/google/callback`
- Strava: Authorization Callback Domain should be `localhost`

### Session Not Persisting

**Solution**: Check that:
1. MongoDB is running and connected
2. SESSION_SECRET is set in `.env`
3. Browser cookies are enabled

### Strava API Rate Limiting

Strava has rate limits:
- 100 requests per 15 minutes
- 1000 requests per day

**Solution**: For testing, sync activities sparingly or use a test Strava account with fewer activities.

## Expected Results

After successful setup and testing:

1. ✅ Server starts without errors
2. ✅ MongoDB connection established
3. ✅ Landing page displays correctly
4. ✅ Google OAuth login works
5. ✅ Dashboard displays user info
6. ✅ Strava connection works
7. ✅ Activities sync from Strava
8. ✅ Activities display in list
9. ✅ Filtering works correctly
10. ✅ Logout works

## Screenshots Checklist

When testing, verify these UI elements:

- [ ] Home page with Google login button
- [ ] Dashboard with connection cards
- [ ] Connected Strava showing "Sync" button
- [ ] Activities list with multiple activities
- [ ] Filtering dropdowns
- [ ] Activity cards with details
- [ ] Toast notifications
- [ ] Responsive design on mobile

## Performance Testing

### Database Indexes

Check that indexes are created:

```javascript
db.activities.getIndexes()
```

Should show index on `{ userId: 1, source: 1, sourceActivityId: 1 }`

### Load Testing

For testing with many activities:

```bash
# The sync endpoint limits to 50 activities per request
# To test with more, make multiple sync requests
```

## Security Testing

### Session Security
- [ ] Sessions expire after 24 hours
- [ ] Logout properly destroys session
- [ ] Cannot access protected routes when not logged in

### OAuth Security
- [ ] OAuth tokens stored securely in database
- [ ] Refresh tokens stored for Strava
- [ ] No tokens exposed in client-side code

### Input Validation
- [ ] Activity data validated before storage
- [ ] Duplicate activities rejected (unique index)

## Next Steps

After basic testing is complete:
1. Add more comprehensive error handling
2. Implement activity detail view
3. Add pagination for activities
4. Implement Garmin Connect integration
5. Add activity statistics and charts
6. Deploy to production environment
