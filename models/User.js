const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  avatar: {
    type: String
  },
  stravaConnected: {
    type: Boolean,
    default: false
  },
  stravaId: {
    type: String
  },
  stravaAccessToken: {
    type: String
  },
  stravaRefreshToken: {
    type: String
  },
  garminConnected: {
    type: Boolean,
    default: false
  },
  garminAccessToken: {
    type: String
  },
  garminAccessTokenSecret: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for id (Mongoose automatically provides this, but making it explicit)
UserSchema.virtual('id').get(function() {
  return this._id ? this._id.toHexString() : null;
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
