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

// Get all activities with pagination
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = { userId: req.user.id };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    console.log('Activities request - User:', req.user.email);
    console.log('Activities request - Page:', pageNum, 'Limit:', limitNum);

    // Get total count for pagination
    const total = await Activity.countDocuments(filter);
    console.log('Total activities found:', total);
    
    // Get activities with pagination
    let activities = await Activity.find(filter)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // For Strava activities, try to fetch kudos count from API (only for first page to avoid performance issues)
    if (pageNum === 1 && activities.length > 0 && req.user.stravaAccessToken) {
      const axios = require('axios');
      const activitiesWithKudos = await Promise.all(activities.map(async (activity) => {
        if (activity.source === 'strava' && activity.sourceActivityId) {
          try {
            const stravaResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activity.sourceActivityId}`, {
              headers: {
                'Authorization': `Bearer ${req.user.stravaAccessToken}`
              }
            });
            // Add kudos count to activity object
            const activityObj = activity.toObject();
            activityObj.kudosCount = stravaResponse.data.kudos_count || 0;
            return activityObj;
          } catch (err) {
            // If fetch fails, just return activity without kudos
            return activity.toObject();
          }
        }
        return activity.toObject();
      }));
      activities = activitiesWithKudos;
    } else {
      // Convert to plain objects
      activities = activities.map(a => a.toObject());
    }
    
    console.log('Activities returned:', activities.length);
    
    // Check if there are more pages
    const hasMore = skip + activities.length < total;
    
    // If it's an AJAX request, return JSON
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'json') {
      return res.json({
        activities,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    }
    
    // Otherwise render the page
    res.render('activities', { 
      user: req.user, 
      activities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { error: { message: 'Error loading activities' } });
  }
});

// Sync activities from Strava
// Uses Strava API v3 athlete/activities endpoint with proper pagination
router.post('/sync/strava', ensureAuthenticated, async (req, res) => {
  try {
    console.log('Sync request - User:', req.user.email);
    console.log('Sync request - Strava connected:', req.user.stravaConnected);
    console.log('Sync request - Has access token:', !!req.user.stravaAccessToken);
    
    if (!req.user.stravaConnected || !req.user.stravaAccessToken) {
      console.error('Strava sync: User not connected or missing access token');
      return res.status(400).json({ error: 'Strava not connected. Please connect your Strava account first.' });
    }

    const { 
      page = 1, 
      per_page = 20,  // Strava max is 200 per page
      before = null,   // Unix timestamp - activities before this time
      after = null    // Unix timestamp - activities after this time
    } = req.body;
    
    const pageNum = parseInt(page);
    const perPage = Math.min(parseInt(per_page), 200); // Cap at 200 (Strava max)

    // Build query parameters according to Strava API documentation
    const params = {
      per_page: perPage,
      page: pageNum
    };

    // Add optional date filters if provided
    if (before) {
      params.before = parseInt(before);
    }
    if (after) {
      params.after = parseInt(after);
    }

    console.log(`Fetching Strava activities - Page ${pageNum}, Per page: ${perPage}`);
    if (before) console.log(`  Before: ${new Date(before * 1000).toISOString()}`);
    if (after) console.log(`  After: ${new Date(after * 1000).toISOString()}`);

    // Fetch activities from Strava API v3 with proper parameters
    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: {
        'Authorization': `Bearer ${req.user.stravaAccessToken}`
      },
      params: params
    });

    const stravaActivities = response.data;
    console.log(`Received ${stravaActivities.length} activities from Strava API`);

    if (!Array.isArray(stravaActivities)) {
      console.error('Strava API returned non-array response:', stravaActivities);
      return res.status(500).json({ error: 'Invalid response from Strava API' });
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const activity of stravaActivities) {
      try {
        // Ensure required fields exist
        if (!activity.id || !activity.name || !activity.type) {
          console.warn('Skipping activity with missing required fields:', activity.id);
          errors++;
          continue;
        }

        await Activity.create({
          userId: req.user.id,
          source: 'strava',
          sourceActivityId: activity.id.toString(),
          name: activity.name || 'Untitled Activity',
          type: activity.type || 'Unknown',
          distance: activity.distance || null,
          movingTime: activity.moving_time || null,
          totalTime: activity.elapsed_time || null,
          startDate: new Date(activity.start_date),
          averageSpeed: activity.average_speed || null,
          maxSpeed: activity.max_speed || null,
          calories: activity.calories || null,
          averageHeartrate: activity.average_heartrate || null,
          maxHeartrate: activity.max_heartrate || null
        });
        synced++;
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate activity, skip
          skipped++;
        } else {
          console.error('Error saving activity:', err);
          errors++;
        }
      }
    }

    console.log(`Sync complete - Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`);

    // Determine if there are more pages
    // If we got a full page (perPage activities), there might be more
    const hasMore = stravaActivities.length === perPage;

    res.json({ 
      success: true, 
      synced, 
      skipped,
      errors,
      total: stravaActivities.length,
      hasMore: hasMore,
      page: pageNum,
      perPage: perPage
    });
  } catch (err) {
    console.error('Error syncing Strava activities:', err);
    if (err.response) {
      console.error('Strava API error:', err.response.status, err.response.data);
      if (err.response.status === 401) {
        return res.status(401).json({ error: 'Strava access token expired. Please reconnect your Strava account.' });
      }
      if (err.response.status === 429) {
        return res.status(429).json({ error: 'Strava API rate limit exceeded. Please try again later.' });
      }
    }
    res.status(500).json({ error: 'Error syncing activities', details: err.message });
  }
});

// Get activity types (must be before /:id route)
router.get('/types', ensureAuthenticated, async (req, res) => {
  try {
    const types = await Activity.distinct('type', { userId: req.user.id });
    res.json(types);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading activity types' });
  }
});

// Get activity details by ID (must be after specific routes like /types)
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const activity = await Activity.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // If it's a Strava activity and user has access token, fetch additional details from Strava
    let stravaDetails = null;
    let stravaLaps = null;
    let stravaZones = null;
    let stravaComments = null;
    let stravaStream = null;
    
    if (activity.source === 'strava' && req.user.stravaAccessToken) {
      try {
        const axios = require('axios');
        const baseUrl = `https://www.strava.com/api/v3/activities/${activity.sourceActivityId}`;
        const headers = {
          'Authorization': `Bearer ${req.user.stravaAccessToken}`
        };
        
        // Fetch main activity details
        const stravaResponse = await axios.get(baseUrl, { headers });
        stravaDetails = stravaResponse.data;
        
        // Fetch laps
        try {
          const lapsResponse = await axios.get(`${baseUrl}/laps`, { headers });
          stravaLaps = lapsResponse.data;
          console.log('Fetched laps:', stravaLaps?.length || 0);
        } catch (lapsErr) {
          console.warn('Could not fetch laps:', lapsErr.message);
        }
        
        // Fetch zones
        try {
          const zonesResponse = await axios.get(`${baseUrl}/zones`, { headers });
          stravaZones = zonesResponse.data;
          console.log('Fetched zones');
        } catch (zonesErr) {
          console.warn('Could not fetch zones:', zonesErr.message);
        }
        
        // Fetch comments
        try {
          const commentsResponse = await axios.get(`${baseUrl}/comments`, { headers });
          stravaComments = commentsResponse.data;
          console.log('Fetched comments:', stravaComments?.length || 0);
        } catch (commentsErr) {
          console.warn('Could not fetch comments:', commentsErr.message);
        }
        
        // Fetch activity stream data (for graphs)
        try {
          // Request stream data with all needed types
          const streamTypes = ['distance', 'altitude', 'time', 'heartrate', 'cadence', 'velocity_smooth', 'grade_smooth'];
          const streamResponse = await axios.get(`${baseUrl}/streams`, {
            headers: headers,
            params: {
              keys: streamTypes.join(','),
              key_by_type: true
            }
          });
          stravaStream = streamResponse.data;
          console.log('Fetched stream data:', {
            hasDistance: !!stravaStream.distance,
            hasAltitude: !!stravaStream.altitude,
            hasHeartrate: !!stravaStream.heartrate,
            hasCadence: !!stravaStream.cadence,
            hasVelocity: !!stravaStream.velocity_smooth
          });
        } catch (streamErr) {
          console.warn('Could not fetch stream data:', streamErr.message);
          // Stream data is optional, continue without it
        }
        
      } catch (stravaErr) {
        console.warn('Could not fetch Strava details:', stravaErr.message);
        // Continue without Strava details
      }
    }

    res.json({
      activity: activity,
      stravaDetails: stravaDetails,
      stravaLaps: stravaLaps,
      stravaZones: stravaZones,
      stravaComments: stravaComments,
      stravaStream: stravaStream
    });
  } catch (err) {
    console.error('Error fetching activity details:', err);
    res.status(500).json({ error: 'Error loading activity details' });
  }
});

module.exports = router;
