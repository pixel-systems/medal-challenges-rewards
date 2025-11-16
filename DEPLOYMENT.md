# Deployment Guide

This guide covers deploying Medal Challenges & Rewards to production environments.

## Deployment Options

### Option 1: Heroku (Easiest)

#### Prerequisites
- Heroku account
- Heroku CLI installed
- MongoDB Atlas account (free tier available)

#### Steps

1. **Prepare MongoDB**

   Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas):
   ```
   - Sign up for MongoDB Atlas
   - Create a free cluster
   - Create database user
   - Whitelist IP addresses (0.0.0.0/0 for Heroku)
   - Get connection string
   ```

2. **Prepare Heroku App**

   ```bash
   # Login to Heroku
   heroku login

   # Create app
   heroku create medal-challenges-rewards

   # Set environment variables
   heroku config:set NODE_ENV=production
   heroku config:set SESSION_SECRET=$(openssl rand -hex 32)
   heroku config:set MONGODB_URI="your-mongodb-atlas-connection-string"
   heroku config:set GOOGLE_CLIENT_ID="your-google-client-id"
   heroku config:set GOOGLE_CLIENT_SECRET="your-google-client-secret"
   heroku config:set GOOGLE_CALLBACK_URL="https://your-app.herokuapp.com/auth/google/callback"
   heroku config:set STRAVA_CLIENT_ID="your-strava-client-id"
   heroku config:set STRAVA_CLIENT_SECRET="your-strava-client-secret"
   heroku config:set STRAVA_CALLBACK_URL="https://your-app.herokuapp.com/auth/strava/callback"
   ```

3. **Update OAuth Redirect URIs**

   Update your OAuth applications:
   - Google Cloud Console: Add `https://your-app.herokuapp.com/auth/google/callback`
   - Strava API Settings: Add your Heroku domain to authorized domains

4. **Deploy**

   ```bash
   git push heroku main
   ```

5. **Open App**

   ```bash
   heroku open
   ```

### Option 2: AWS (EC2 + DocumentDB)

#### Architecture
- EC2 instance for Node.js app
- DocumentDB (MongoDB-compatible) for database
- ALB (Application Load Balancer) for HTTPS
- Route 53 for DNS

#### Prerequisites
- AWS account
- Domain name
- AWS CLI installed

#### Steps

1. **Set up DocumentDB**
   ```bash
   # Create DocumentDB cluster
   aws docdb create-db-cluster \
     --db-cluster-identifier medal-challenges-cluster \
     --engine docdb \
     --master-username admin \
     --master-user-password YourPassword
   ```

2. **Launch EC2 Instance**
   ```bash
   # Use Amazon Linux 2 AMI
   # Install Node.js and Git
   sudo yum update -y
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs git
   ```

3. **Clone and Configure App**
   ```bash
   git clone https://github.com/pixel-systems/medal-challenges-rewards.git
   cd medal-challenges-rewards
   npm install
   
   # Create .env file with production values
   cat > .env << EOF
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=$(openssl rand -hex 32)
   MONGODB_URI=mongodb://admin:password@your-docdb-endpoint:27017/medal-challenges?tls=true&tlsCAFile=/path/to/rds-combined-ca-bundle.pem
   # ... other environment variables
   EOF
   ```

4. **Set up PM2 for Process Management**
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name medal-challenges
   pm2 startup
   pm2 save
   ```

5. **Configure NGINX as Reverse Proxy**
   ```bash
   sudo yum install nginx -y
   
   # Configure NGINX
   sudo vim /etc/nginx/conf.d/medal-challenges.conf
   ```

   NGINX configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Set up SSL with Let's Encrypt**
   ```bash
   sudo amazon-linux-extras install epel
   sudo yum install certbot python-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Option 3: DigitalOcean App Platform

#### Steps

1. **Create App**
   - Go to DigitalOcean App Platform
   - Connect GitHub repository
   - Configure app settings

2. **Add MongoDB Database**
   - Add a managed MongoDB database
   - Or use MongoDB Atlas

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   SESSION_SECRET=your-secret
   MONGODB_URI=your-mongodb-connection
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   # etc.
   ```

4. **Deploy**
   - DigitalOcean will automatically deploy on push to main branch

### Option 4: Docker Deployment

#### Dockerfile

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

#### docker-compose.yml

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/medal-challenges
      - SESSION_SECRET=${SESSION_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - STRAVA_CLIENT_ID=${STRAVA_CLIENT_ID}
      - STRAVA_CLIENT_SECRET=${STRAVA_CLIENT_SECRET}
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:latest
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

volumes:
  mongo-data:
```

#### Deploy
```bash
docker-compose up -d
```

## Production Considerations

### Environment Variables

Ensure all sensitive data is in environment variables:
- ✅ SESSION_SECRET - Use strong random value
- ✅ Database credentials
- ✅ OAuth client secrets
- ✅ API keys

### Security

1. **HTTPS Only**
   - Use SSL certificates (Let's Encrypt is free)
   - Redirect HTTP to HTTPS

2. **Session Security**
   ```javascript
   // In server.js, update session config for production:
   cookie: {
     maxAge: 24 * 60 * 60 * 1000,
     secure: process.env.NODE_ENV === 'production', // HTTPS only
     httpOnly: true,
     sameSite: 'strict'
   }
   ```

3. **Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

   Add to server.js:
   ```javascript
   const rateLimit = require('express-rate-limit');

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });

   app.use('/api/', limiter);
   ```

4. **Helmet for Security Headers**
   ```bash
   npm install helmet
   ```

   ```javascript
   const helmet = require('helmet');
   app.use(helmet());
   ```

### Performance

1. **Database Indexing**
   - Indexes are defined in models
   - Verify they're created in production

2. **Compression**
   ```bash
   npm install compression
   ```

   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

3. **Caching**
   - Use Redis for session store in high-traffic scenarios
   - Cache activity type lists

### Monitoring

1. **Logging**
   ```bash
   npm install winston
   ```

   Set up structured logging:
   ```javascript
   const winston = require('winston');

   const logger = winston.createLogger({
     level: 'info',
     format: winston.format.json(),
     transports: [
       new winston.transports.File({ filename: 'error.log', level: 'error' }),
       new winston.transports.File({ filename: 'combined.log' })
     ]
   });
   ```

2. **Error Tracking**
   - Integrate Sentry or Rollbar for error tracking

3. **Health Check Endpoint**
   Add to server.js:
   ```javascript
   app.get('/health', (req, res) => {
     res.json({ status: 'ok', timestamp: new Date() });
   });
   ```

### Backup Strategy

1. **MongoDB Backups**
   - MongoDB Atlas: Automated backups included
   - DocumentDB: Enable automated backups
   - Self-hosted: Use mongodump

   ```bash
   # Backup
   mongodump --uri="mongodb://localhost:27017/medal-challenges" --out=/backups/

   # Restore
   mongorestore --uri="mongodb://localhost:27017/medal-challenges" /backups/medal-challenges/
   ```

### Scaling

1. **Horizontal Scaling**
   - Use load balancer (ALB, nginx)
   - Multiple app instances with PM2 cluster mode:
   ```bash
   pm2 start server.js -i max
   ```

2. **Database Scaling**
   - MongoDB Atlas: Auto-scaling available
   - DocumentDB: Read replicas

3. **CDN for Static Assets**
   - Use CloudFront or Cloudflare
   - Serve CSS/JS from CDN

## Cost Estimates

### Free Tier (Development)
- MongoDB Atlas: Free (512 MB)
- Heroku: Free tier discontinued, use DigitalOcean $5/month
- Total: ~$5/month

### Small Production
- DigitalOcean App Platform: $12/month
- MongoDB Atlas M10: $57/month
- Total: ~$69/month

### Medium Production
- AWS EC2 t3.medium: ~$35/month
- AWS DocumentDB t3.medium: ~$70/month
- AWS ALB: ~$20/month
- Total: ~$125/month

## Maintenance

### Regular Updates
```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Check for security vulnerabilities
npm audit
npm audit fix
```

### Database Maintenance
```javascript
// Add to maintenance script
db.activities.aggregate([
  { $group: { _id: "$userId", count: { $sum: 1 } } }
]);

// Remove old sessions
db.sessions.deleteMany({ expires: { $lt: new Date() } });
```

## Rollback Plan

1. **Keep Previous Release**
   ```bash
   # Tag releases
   git tag -a v1.0.0 -m "Release 1.0.0"
   git push origin v1.0.0

   # Rollback to previous version
   git checkout v1.0.0
   npm install
   pm2 restart all
   ```

2. **Database Migrations**
   - Always backup before schema changes
   - Test migrations in staging first
   - Keep rollback scripts

## Troubleshooting Production Issues

### High Memory Usage
```bash
# Check memory
pm2 monit

# Restart app
pm2 restart medal-challenges
```

### Database Connection Issues
```bash
# Check MongoDB connectivity
mongosh "your-mongodb-uri"

# Check network
telnet your-db-host 27017
```

### OAuth Issues
- Verify callback URLs in OAuth app settings
- Check environment variables
- Review error logs

## Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Test database connectivity
4. Review OAuth configuration
5. Open GitHub issue for bugs
