# Deployment Guide

This guide covers various deployment options for the GenAI Image Evaluation Platform.

## 🚀 Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Start both frontend and backend
npm run dev

# Or start separately
npm run server  # Backend on port 3001
npm start       # Frontend on port 3000
```

### Production Build
```bash
# Build the application
npm run build

# Start production server
npm run server
```

## 🌐 Deployment Options

### 1. Traditional VPS/Server

#### Prerequisites
- Node.js 16+ installed
- PM2 for process management (recommended)
- Nginx for reverse proxy (optional)

#### Setup Steps
```bash
# 1. Clone repository
git clone <repository-url>
cd genai-image-evaluation-platform

# 2. Install dependencies
npm install

# 3. Set environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Build application
npm run build

# 5. Install PM2 globally
npm install -g pm2

# 6. Start application with PM2
pm2 start server.js --name "genai-eval"
pm2 save
pm2 startup
```

#### Nginx Configuration (Optional)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Docker Deployment

#### Create Dockerfile
```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "run", "server"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  genai-eval:
    build: .
    ports:
      - "3001:3001"
    environment:
      - REACT_APP_OPENAI_API_KEY=${OPENAI_API_KEY}
      - REACT_APP_GROQ_API_KEY=${GROQ_API_KEY}
      - REACT_APP_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./dataset:/app/dataset
    restart: unless-stopped
```

#### Deploy with Docker
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### 3. Cloud Platform Deployment

#### Heroku
```bash
# Install Heroku CLI
# Create Procfile
echo "web: npm run server" > Procfile

# Deploy
heroku create your-app-name
heroku config:set REACT_APP_OPENAI_API_KEY=your_key
heroku config:set REACT_APP_GROQ_API_KEY=your_key
heroku config:set REACT_APP_ANTHROPIC_API_KEY=your_key
git push heroku main
```

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 4. AWS Deployment

#### EC2 Instance
```bash
# Launch EC2 instance (Ubuntu 20.04+)
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <repository-url>
cd genai-image-evaluation-platform
npm install
npm run build

# Install PM2
sudo npm install -g pm2
pm2 start server.js --name "genai-eval"
pm2 startup
pm2 save
```

#### ECS with Fargate
```yaml
# task-definition.json
{
  "family": "genai-eval",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "genai-eval",
      "image": "your-account.dkr.ecr.region.amazonaws.com/genai-eval:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "REACT_APP_OPENAI_API_KEY",
          "value": "your-key"
        }
      ]
    }
  ]
}
```

## 🔧 Environment Configuration

### Required Environment Variables
```bash
# At least one LLM provider API key is required
REACT_APP_OPENAI_API_KEY=sk-...
REACT_APP_GROQ_API_KEY=gsk_...
REACT_APP_ANTHROPIC_API_KEY=sk-ant-...

# Optional providers
REACT_APP_AZURE_API_KEY=...
REACT_APP_AZURE_ENDPOINT=...
REACT_APP_AWS_ACCESS_KEY_ID=...
REACT_APP_AWS_SECRET_ACCESS_KEY=...
REACT_APP_AWS_REGION=us-east-1

# Optional server configuration
REACT_APP_API_BASE_URL=http://localhost:3001
```

### Security Considerations
1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive data
3. **Enable HTTPS** in production
4. **Set up proper CORS** policies
5. **Monitor API usage** and costs
6. **Implement rate limiting** if needed

## 📊 Monitoring and Maintenance

### Health Checks
```bash
# Check if application is running
curl http://localhost:3001/api/health

# Check PM2 status
pm2 status

# View logs
pm2 logs genai-eval
```

### Performance Monitoring
- Monitor API response times
- Track memory usage
- Monitor disk space for dataset storage
- Set up alerts for API key expiration

### Backup Strategy
- Regular dataset backups
- Environment variable backups
- Database backups (if applicable)
- Configuration file backups

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 npm run server
```

#### Memory Issues
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 server.js

# Or with PM2
pm2 start server.js --name "genai-eval" --node-args="--max-old-space-size=4096"
```

#### API Key Issues
- Verify API keys are correctly set
- Check API key permissions
- Ensure sufficient credits/quotas
- Verify model names are current

### Log Analysis
```bash
# View application logs
pm2 logs genai-eval

# View system logs
journalctl -u your-service-name

# Monitor real-time logs
tail -f /var/log/your-app.log
```

## 🔄 Updates and Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild application
npm run build

# Restart services
pm2 restart genai-eval
```

### Database Migrations
- No database required for this application
- Dataset updates can be done by replacing files in `dataset/` directory

### Security Updates
- Regularly update dependencies: `npm audit fix`
- Monitor for security advisories
- Keep Node.js and system packages updated

---

For additional support or questions, please refer to the main README.md or open an issue in the repository.


