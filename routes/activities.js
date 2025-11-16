const express = require('express');
const router = express.Router();
const axios = require('axios');
const Activity = require('../models/Activity');

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Get all activities
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { type, source } = req.query;
    const filter = { userId: req.user.id };

    if (type) filter.type = type;
    if (source) filter.source = source;

    const activities = await Activity.find(filter).sort({ startDate: -1 });
    
    res.render('activities', { 
      user: req.user, 
      activities,
      selectedType: type || '',
      selectedSource: source || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { error: { message: 'Error loading activities' } });
  }
});

// Sync activities from Strava
router.post('/sync/strava', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user.stravaConnected || !req.user.stravaAccessToken) {
      return res.status(400).json({ error: 'Strava not connected' });
    }

    // Fetch activities from Strava API
    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: {
        'Authorization': `Bearer ${req.user.stravaAccessToken}`
      },
      params: {
        per_page: 50
      }
    });

    const stravaActivities = response.data;
    let synced = 0;
    let skipped = 0;

    for (const activity of stravaActivities) {
      try {
        await Activity.create({
          userId: req.user.id,
          source: 'strava',
          sourceActivityId: activity.id.toString(),
          name: activity.name,
          type: activity.type,
          distance: activity.distance,
          movingTime: activity.moving_time,
          totalTime: activity.elapsed_time,
          startDate: new Date(activity.start_date),
          averageSpeed: activity.average_speed,
          maxSpeed: activity.max_speed,
          calories: activity.calories,
          averageHeartrate: activity.average_heartrate,
          maxHeartrate: activity.max_heartrate
        });
        synced++;
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate activity, skip
          skipped++;
        } else {
          console.error('Error saving activity:', err);
        }
      }
    }

    res.json({ 
      success: true, 
      synced, 
      skipped,
      total: stravaActivities.length 
    });
  } catch (err) {
    console.error('Error syncing Strava activities:', err);
    res.status(500).json({ error: 'Error syncing activities' });
  }
});

// Get activity types
router.get('/types', ensureAuthenticated, async (req, res) => {
  try {
    const types = await Activity.distinct('type', { userId: req.user.id });
    res.json(types);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading activity types' });
  }
});

module.exports = router;
