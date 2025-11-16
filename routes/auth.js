const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// Strava OAuth routes
router.get('/strava',
  (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.redirect('/');
    }
    next();
  },
  passport.authenticate('strava', { scope: ['read', 'activity:read'] })
);

router.get('/strava/callback',
  passport.authenticate('strava', { failureRedirect: '/dashboard' }),
  (req, res) => {
    res.redirect('/dashboard?strava=connected');
  }
);

// Disconnect Strava
router.get('/strava/disconnect', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }

  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    user.stravaConnected = false;
    user.stravaId = null;
    user.stravaAccessToken = null;
    user.stravaRefreshToken = null;
    
    await user.save();
    res.redirect('/dashboard?strava=disconnected');
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard?error=true');
  }
});

// Garmin OAuth routes (placeholder - Garmin uses OAuth 1.0a and requires special API access)
router.get('/garmin', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  // Garmin Connect API requires special access and uses OAuth 1.0a
  // This is a placeholder for future implementation
  res.redirect('/dashboard?garmin=not-implemented');
});

module.exports = router;
