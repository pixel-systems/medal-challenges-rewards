const GoogleStrategy = require('passport-google-oauth20').Strategy;
const StravaStrategy = require('passport-strava-oauth2').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
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
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Update user info
          user.name = profile.displayName;
          user.email = profile.emails[0].value;
          user.avatar = profile.photos[0].value;
          await user.save();
          return done(null, user);
        }

        // Create new user
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          avatar: profile.photos[0].value
        });

        done(null, user);
      } catch (err) {
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
        if (!req.user) {
          return done(null, false, { message: 'User must be logged in to connect Strava' });
        }

        const user = await User.findById(req.user.id);
        
        user.stravaConnected = true;
        user.stravaId = profile.id;
        user.stravaAccessToken = accessToken;
        user.stravaRefreshToken = refreshToken;
        
        await user.save();
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  ));
};
