const express = require('express');
const axios = require('axios');
const router = express.Router();

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Dashboard route
router.get('/', ensureAuthenticated, (req, res) => {
  // Ensure user data is available
  if (!req.user) {
    console.error('Dashboard: User not found in session');
    return res.redirect('/');
  }
  
  console.log('Dashboard: Rendering for user:', req.user.email);
  res.render('dashboard', { user: req.user });
});

// Strava profile route - fetch and display athlete details
router.get('/strava-profile', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user.stravaConnected || !req.user.stravaAccessToken) {
      return res.redirect('/dashboard?error=strava_not_connected');
    }

    console.log('Fetching Strava athlete profile for user:', req.user.email);
    
    // Fetch athlete details from Strava API
    const athleteResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
      headers: {
        'Authorization': `Bearer ${req.user.stravaAccessToken}`
      }
    });

    const athlete = athleteResponse.data;
    console.log('Strava athlete data received:', {
      id: athlete.id,
      firstname: athlete.firstname,
      lastname: athlete.lastname
    });

    // Fetch athlete stats
    let stats = null;
    try {
      const statsResponse = await axios.get(`https://www.strava.com/api/v3/athletes/${athlete.id}/stats`, {
        headers: {
          'Authorization': `Bearer ${req.user.stravaAccessToken}`
        }
      });
      stats = statsResponse.data;
      console.log('Strava stats received');
    } catch (statsErr) {
      console.warn('Could not fetch athlete stats:', statsErr.response?.status, statsErr.message);
      // Stats are optional, continue without them
    }

    // Fetch athlete zones (heart rate and power zones)
    let zones = null;
    try {
      const zonesResponse = await axios.get('https://www.strava.com/api/v3/athlete/zones', {
        headers: {
          'Authorization': `Bearer ${req.user.stravaAccessToken}`
        }
      });
      zones = zonesResponse.data;
      console.log('Strava zones received:', {
        hasHeartRate: !!zones.heart_rate,
        hasPower: !!zones.power
      });
    } catch (zonesErr) {
      console.warn('Could not fetch athlete zones:', zonesErr.response?.status, zonesErr.message);
      // Zones are optional, continue without them
    }

    res.render('strava-profile', { 
      user: req.user,
      athlete: athlete,
      stats: stats,
      zones: zones
    });
  } catch (err) {
    console.error('Error fetching Strava profile:', err);
    if (err.response) {
      console.error('Strava API error:', err.response.status, err.response.data);
      if (err.response.status === 401) {
        return res.redirect('/dashboard?error=strava_token_expired');
      }
    }
    res.status(500).render('error', { 
      error: { 
        message: 'Error loading Strava profile',
        details: err.message 
      } 
    });
  }
});

module.exports = router;
