const express = require('express');
const router = express.Router();

// Home page route
router.get('/', (req, res) => {
  // Debug logging
  console.log('Home route - isAuthenticated:', req.isAuthenticated());
  console.log('Home route - user:', req.user ? req.user.email : 'null');
  
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  // Pass user even if null (for template logic)
  res.render('index', { user: req.user || null });
});

// Logout route
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });
});

module.exports = router;
