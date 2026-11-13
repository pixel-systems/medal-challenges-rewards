const GoogleStrategy = require('passport-google-oauth20').Strategy;
const StravaStrategy = require('passport-strava-oauth2').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  // Serialize user for the session
  passport.serializeUser((user, done) => {
    try {
      if (!user) {
        console.error('Serialize: User is null or undefined');
        return done(new Error('Invalid user object'), null);
      }
      
      // Handle both Mongoose documents and plain objects
      const userId = user.id || user._id || (user._id ? user._id.toString() : null);
      
      if (!userId) {
        console.error('Serialize: User ID not found', user);
        return done(new Error('User ID not found'), null);
      }
      
      console.log('Serialize: Saving user ID to session:', userId, user.email);
      done(null, userId);
    } catch (err) {
      console.error('Serialize error:', err);
      done(err, null);
    }
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      if (!user) {
        console.error('Deserialize: User not found for ID:', id);
        return done(null, false);
      }
      console.log('Deserialize: User loaded:', user.email);
      done(null, user);
    } catch (err) {
      console.error('Deserialize error:', err);
      done(err, null);
    }
  });

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google OAuth callback - Profile ID:', profile.id);
        
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Update user info
          user.name = profile.displayName;
          user.email = profile.emails[0] ? profile.emails[0].value : user.email;
          user.avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : user.avatar;
          await user.save();
          console.log('User updated:', user.email);
          // Ensure user has id property for Passport serialization
          if (!user.id && user._id) {
            user.id = user._id.toString();
          }
          return done(null, user);
        }

        // Create new user
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : '',
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : ''
        });

        console.log('New user created:', user.email);
        // Ensure user has id property for Passport serialization
        if (!user.id && user._id) {
          user.id = user._id.toString();
        }
        done(null, user);
      } catch (err) {
        console.error('Error in Google OAuth callback:', err);
        done(err, null);
      }
    }
  ));

  // Strava OAuth Strategy
  passport.use(new StravaStrategy({
      clientID: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
      callbackURL: process.env.STRAVA_CALLBACK_URL,
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if req and req.user exist
        if (!req || !req.user) {
          console.error('Strava callback: req or req.user is missing');
          return done(null, false, { message: 'User must be logged in to connect Strava' });
        }

        console.log('Strava callback - User ID:', req.user.id);
        console.log('Strava callback - Profile ID:', profile.id);
        
        const user = await User.findById(req.user.id);
        if (!user) {
          console.error('Strava callback: User not found in database');
          return done(null, false, { message: 'User not found' });
        }
        
        user.stravaConnected = true;
        user.stravaId = profile.id;
        user.stravaAccessToken = accessToken;
        user.stravaRefreshToken = refreshToken;
        
        await user.save();
        console.log('Strava connected for user:', user.email);
        
        // Return the existing user from req.user to maintain session
        // This prevents Passport from trying to create a new session
        // We update req.user with the fresh data from DB
        req.user = user;
        done(null, req.user);
      } catch (err) {
        console.error('Error connecting Strava:', err);
        done(err, null);
      }
    }
  ));
};
