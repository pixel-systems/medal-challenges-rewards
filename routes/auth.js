const express = require('express');
const passport = require('passport');
const axios = require('axios');
const router = express.Router();

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  (req, res, next) => {
    // CRITICAL: Ensure session exists before Passport tries to use it
    // The session middleware should have created req.session automatically
    if (!req.session) {
      console.error('CRITICAL: Session not initialized before Google OAuth callback');
      console.error('Session ID:', req.sessionID);
      console.error('This indicates the session middleware failed to create req.session');
      console.error('This is likely due to a session store connection issue');
      return res.redirect('/?error=session_error');
    }
    
    // Log session info for debugging
    console.log('Session exists, ID:', req.sessionID);
    // Ensure session is ready - touch it to mark it as needing to be saved
    if (req.session.touch) {
      req.session.touch();
    }
    // Force session to be saved to ensure it's persisted
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session before authentication:', err);
        return res.redirect('/?error=session_error');
      }
      console.log('Session saved successfully before authentication');
      next();
    });
  },
  passport.authenticate('google', { 
    failureRedirect: '/?error=auth_failed',
    session: true
  }),
  (req, res, next) => {
    // Ensure request and user are available
    if (!req) {
      console.error('Request object is undefined after authentication');
      return res.redirect('/?error=auth_failed');
    }
    
    if (!req.user) {
      console.error('User not found in request after authentication');
      return res.redirect('/?error=session_failed');
    }
    
    console.log('User authenticated:', req.user.email);
    res.redirect('/dashboard');
  }
);

// Strava OAuth routes
router.get('/strava',
  (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.redirect('/');
    }
    // Manually construct the authorization URL with correct scope format
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.STRAVA_CALLBACK_URL || 'http://localhost:3000/auth/strava/callback');
    // Request all necessary scopes for full activity access
    const scopes = ['read', 'read_all', 'profile:read_all', 'activity:read', 'activity:read_all'];
    const scope = scopes.join(','); // Strava expects comma-separated scopes
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&approval_prompt=force`;
    res.redirect(authUrl);
  }
);

router.get('/strava/callback',
  async (req, res) => {
    // Ensure user is logged in
    if (!req.isAuthenticated() || !req.user) {
      console.error('Strava callback: User not authenticated');
      return res.redirect('/?error=not_logged_in');
    }
    
    const { code, error } = req.query;
    
    if (error) {
      console.error('Strava OAuth error:', error);
      return res.redirect('/dashboard?error=strava_failed');
    }
    
    if (!code) {
      console.error('Strava callback: No authorization code received');
      return res.redirect('/dashboard?error=strava_failed');
    }
    
    try {
      console.log('Strava callback: Exchanging code for token');
      
      // Manually exchange code for token
      const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      });
      
      const { access_token, refresh_token, athlete } = tokenResponse.data;
      
      if (!access_token) {
        console.error('Strava callback: No access token received');
        return res.redirect('/dashboard?error=strava_failed');
      }
      
      console.log('Strava callback: Token received, updating user');
      
      // Update user with Strava connection
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      
      if (!user) {
        console.error('Strava callback: User not found in database');
        return res.redirect('/dashboard?error=strava_failed');
      }
      
      user.stravaConnected = true;
      user.stravaId = athlete.id.toString();
      user.stravaAccessToken = access_token;
      user.stravaRefreshToken = refresh_token;
      
      await user.save();
      
      // Update req.user with fresh data
      req.user.stravaConnected = true;
      req.user.stravaId = athlete.id.toString();
      req.user.stravaAccessToken = access_token;
      req.user.stravaRefreshToken = refresh_token;
      
      console.log('Strava connected for user:', user.email);
      res.redirect('/dashboard?strava=connected');
      
    } catch (err) {
      console.error('Error in Strava callback:', err);
      if (err.response) {
        console.error('Strava API error:', err.response.status, err.response.data);
      }
      res.redirect('/dashboard?error=strava_failed');
    }
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

// Garmin OAuth routes - DISABLED
// router.get('/garmin', (req, res) => {
//   if (!req.isAuthenticated()) {
//     return res.redirect('/');
//   }
//   // Garmin Connect API requires special access and uses OAuth 1.0a
//   // This is a placeholder for future implementation
//   res.redirect('/dashboard?garmin=not-implemented');
// });

module.exports = router;
