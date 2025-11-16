# Medal Challenges & Rewards 🏅

A fitness tracking web application that allows users to connect their Strava and Garmin Connect accounts, sync activities, and view them in a unified dashboard with filtering capabilities.

## Features

- 🔐 **OAuth2 Authentication** - Login with Google
- 🚴 **Strava Integration** - Connect Strava account and sync activities
- ⌚ **Garmin Connect Integration** - Placeholder for Garmin Connect (requires special API access)
- 📊 **Activity Dashboard** - View all activities in one place
- 🔍 **Filtering** - Filter activities by type and source (fitness app)
- 💾 **MongoDB Storage** - All data stored in MongoDB for flexibility and cost-effectiveness

## Technology Stack

- **Backend**: Node.js with Express
- **Authentication**: Passport.js with OAuth2 strategies (Google, Strava)
- **Database**: MongoDB (or AWS DocumentDB)
- **Frontend**: EJS templates with vanilla JavaScript
- **APIs**: Strava API v3

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Google OAuth2 credentials
- Strava API credentials

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/pixel-systems/medal-challenges-rewards.git
cd medal-challenges-rewards
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-random-session-secret

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/medal-challenges

# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Strava OAuth2
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_CALLBACK_URL=http://localhost:3000/auth/strava/callback
```

### 4. Obtain OAuth Credentials

#### Google OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth Client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
7. Copy Client ID and Client Secret to `.env`

#### Strava API

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new application
3. Set Authorization Callback Domain: `localhost`
4. Copy Client ID and Client Secret to `.env`

#### Garmin Connect

⚠️ **Note**: Garmin Connect API requires special approval and uses OAuth 1.0a. The current implementation includes a placeholder for future integration.

### 5. Start MongoDB

If using local MongoDB:

```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu
sudo systemctl start mongod

# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 6. Run the Application

Development mode (with auto-restart):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

1. **Login**: Visit the homepage and click "Sign in with Google"
2. **Connect Strava**: Go to Dashboard and click "Connect Strava"
3. **Sync Activities**: After connecting, click "Sync Activities" to import your recent activities
4. **View Activities**: Navigate to Activities page to see all synced activities
5. **Filter**: Use the dropdown filters to filter by activity type or fitness app source

## Project Structure

```
medal-challenges-rewards/
├── config/
│   └── passport.js          # Passport authentication configuration
├── models/
│   ├── User.js              # User schema
│   └── Activity.js          # Activity schema
├── routes/
│   ├── index.js             # Home and logout routes
│   ├── auth.js              # OAuth authentication routes
│   ├── dashboard.js         # Dashboard route
│   └── activities.js        # Activities routes
├── views/
│   ├── index.ejs            # Landing page
│   ├── dashboard.ejs        # Dashboard with app connections
│   ├── activities.ejs       # Activities list with filtering
│   └── error.ejs            # Error page
├── public/
│   ├── css/
│   │   └── style.css        # Application styles
│   └── js/
│       ├── dashboard.js     # Dashboard client-side logic
│       └── activities.js    # Activities client-side logic
├── .env.example             # Example environment variables
├── .gitignore               # Git ignore file
├── package.json             # Project dependencies
├── server.js                # Application entry point
└── README.md                # This file
```

## Database Choice: MongoDB vs DynamoDB

**MongoDB was chosen** for the following reasons:

1. **Cost-Effective Development**: Free local development, free tier on MongoDB Atlas
2. **Flexible Schema**: Easy to modify activity data structure as we integrate more fitness apps
3. **Query Flexibility**: Complex filtering by activity type, date ranges, and sources
4. **Easier Local Testing**: Simple local setup without AWS dependencies
5. **Mongoose ORM**: Excellent Node.js integration with schema validation
6. **AWS Compatible**: Can easily migrate to AWS DocumentDB if needed

**DynamoDB Considerations**: While DynamoDB has excellent scalability, it requires:
- More complex query patterns with GSIs for filtering
- AWS account and credentials even for local development (DynamoDB Local)
- Pay-per-request pricing (though minimal for small apps)
- More complex data modeling for relationships

## API Endpoints

### Authentication
- `GET /` - Home page
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/strava` - Initiate Strava OAuth
- `GET /auth/strava/callback` - Strava OAuth callback
- `GET /auth/strava/disconnect` - Disconnect Strava
- `GET /logout` - Logout user

### Dashboard
- `GET /dashboard` - User dashboard

### Activities
- `GET /activities` - List activities (with optional query params: `type`, `source`)
- `POST /activities/sync/strava` - Sync activities from Strava
- `GET /activities/types` - Get list of activity types

## Security Considerations

- Session secrets stored in environment variables
- OAuth tokens encrypted in database
- MongoDB connection string kept in environment variables
- HTTPS should be used in production
- Rate limiting should be added for API endpoints

## Future Enhancements

- [ ] Garmin Connect full integration (pending API approval)
- [ ] Activity statistics and analytics
- [ ] Challenges and achievements system
- [ ] Social features (compare with friends)
- [ ] Export data functionality
- [ ] Advanced filtering (date ranges, distance ranges)
- [ ] Activity maps visualization
- [ ] Mobile responsive improvements
- [ ] PWA support

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## Support

For issues and questions, please open a GitHub issue.