const express = require('express');
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
  res.render('dashboard', { user: req.user });
});

module.exports = router;
