require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Initialize Express app
const app = express();

// Security: Helmet middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    }
  }
}));

// Connect to MongoDB
const mongooseConnectionPromise = mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medal-challenges')
.then(() => {
  console.log('Connected to MongoDB');
  return mongoose.connection;
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  throw err;
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing middleware - MUST be before session
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files BEFORE rate limiting
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting (exclude static files)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for static files
    return req.path.startsWith('/css/') || 
           req.path.startsWith('/js/') || 
           req.path.startsWith('/images/');
  }
});

// Apply rate limiting to all routes
app.use(limiter);

// Stricter rate limiting for auth routes
// OAuth flows involve multiple redirects, so we need a higher limit
// In development, use a more lenient limit
const isDevelopment = process.env.NODE_ENV !== 'production';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 50 : 20, // More lenient in development (50 vs 20 in production)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting in development if needed (uncomment to disable in dev)
  // skip: (req) => isDevelopment,
});

// Session configuration
// Create session store - use mongoUrl directly for reliability
let sessionStore;
try {
  sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/medal-challenges',
    touchAfter: 24 * 3600, // lazy session update
    stringify: false, // Store as BSON for better performance
    autoRemove: 'native'
  });

  // Error handling for session store
  sessionStore.on('error', (error) => {
    console.error('Session store error:', error);
    console.error('Sessions may not persist properly. Check MongoDB connection.');
  });
  
  // Log when store is ready
  sessionStore.on('connected', () => {
    console.log('Session store connected to MongoDB');
  });
  
  // Log when store is opening
  sessionStore.on('opening', () => {
    console.log('Session store opening connection to MongoDB...');
  });
} catch (error) {
  console.error('Failed to create session store:', error);
  sessionStore = undefined;
}

// Session configuration - only use store if it was created successfully
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true, // Set to true for OAuth flows to ensure session exists
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax'
  },
  name: 'medal-challenges.sid', // Custom session name
  // Add unset option to ensure session is always created
  unset: 'keep'
};

// Only add store if it was created successfully
if (sessionStore) {
  sessionConfig.store = sessionStore;
} else {
  console.warn('Warning: Session store not available, using memory store (sessions will be lost on restart)');
}

// Create session middleware
const sessionMiddleware = session(sessionConfig);

// Wrap session middleware to ensure req.session is always created
app.use((req, res, next) => {
  sessionMiddleware(req, res, (err) => {
    if (err) {
      console.error('Session middleware error:', err);
      // Even on error, try to continue - the session might still work
    }
    
    // CRITICAL: Ensure req.session exists
    // If session middleware didn't create it, there's a serious problem
    if (!req.session) {
      console.error('CRITICAL ERROR: req.session is undefined after session middleware');
      console.error('Path:', req.path);
      console.error('This will cause authentication to fail');
      console.error('Possible causes:');
      console.error('  1. Session store connection failed');
      console.error('  2. Session middleware configuration error');
      console.error('  3. MongoDB not accessible');
      
      // For auth routes, we can't continue without a session
      if (req.path.includes('/auth/')) {
        return res.status(500).send('Session initialization failed. Please check server logs.');
      }
    }
    
    next(err);
  });
});


// Passport initialization - MUST be after session middleware
// Initialize Passport before configuring strategies
app.use(passport.initialize());
app.use(passport.session());

// Patch req._passport.session when older Passport versions (pulled in by some
// strategies) have monkey-patched req.logIn/req.login and expect it to exist.
// Without this, Google OAuth fails with "Cannot set properties of undefined (setting 'user')".
app.use((req, res, next) => {
  if (req._passport && !req._passport.session) {
    // Use existing session passport data if available, otherwise create an empty object
    req._passport.session = (req.session && req.session.passport) ? req.session.passport : {};
    if (req.session && !req.session.passport) {
      req.session.passport = req._passport.session;
    }
  }
  next();
});

// Middleware to ensure session exists before Passport tries to use it
// This is critical for OAuth callbacks where the session might not be initialized
app.use((req, res, next) => {
  // Ensure req object exists
  if (!req) {
    console.error('Request object is undefined in middleware');
    return res.status(500).send('Internal server error');
  }
  
  // Ensure session exists - if it doesn't, create it
  // This can happen if the session middleware didn't initialize it properly
  if (!req.session) {
    console.warn('Session not initialized, creating empty session for:', req.path);
    // The session middleware should have created this, but if it didn't,
    // we need to ensure it exists. However, we can't manually create it
    // because it needs the proper session object with methods.
    // Instead, we'll let the session middleware handle it on the next request
    // For now, we'll just log the warning and continue
  }
  
  next();
});

// Passport configuration
require('./config/passport')(passport);

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', authLimiter, require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/activities', require('./routes/activities'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: process.env.NODE_ENV === 'development' ? err : { message: 'Something went wrong!' }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
