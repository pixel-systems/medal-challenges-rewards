const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  source: {
    type: String,
    enum: ['strava', 'garmin'],
    required: true
  },
  sourceActivityId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  distance: {
    type: Number // meters
  },
  movingTime: {
    type: Number // seconds
  },
  totalTime: {
    type: Number // seconds
  },
  startDate: {
    type: Date,
    required: true
  },
  averageSpeed: {
    type: Number // m/s
  },
  maxSpeed: {
    type: Number // m/s
  },
  calories: {
    type: Number
  },
  averageHeartrate: {
    type: Number
  },
  maxHeartrate: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index to prevent duplicate activities
ActivitySchema.index({ userId: 1, source: 1, sourceActivityId: 1 }, { unique: true });

module.exports = mongoose.model('Activity', ActivitySchema);
