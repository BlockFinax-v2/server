# BlockFinax Server - Production Deployment Guide

## 🚀 Production-Ready Features

### ✅ Security
- **Helmet.js** - Security headers and protection
- **Rate Limiting** - Prevents API abuse
- **Input Validation** - Validates all inputs
- **CORS Configuration** - Configurable cross-origin policies
- **Address Validation** - Ethereum address format validation

### ✅ Performance & Reliability
- **Connection Management** - Handles duplicate connections
- **Memory Management** - Auto-cleanup of inactive users
- **Message History** - Stores recent conversations
- **Call Management** - Active call tracking with timeouts
- **Error Handling** - Comprehensive error catching and logging

### ✅ Monitoring & Debugging
- **Health Check Endpoint** - `/health` for monitoring
- **Structured Logging** - Different log levels with timestamps
- **Connection Statistics** - Track active users and calls
- **Graceful Shutdown** - Proper cleanup on server shutdown

## 📦 Installation

1. **Install Dependencies**
   ```bash
   cd /home/bilal/bilal_projects/BlockFinax/server
   npm install
   ```

2. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env.production
   
   # Edit production environment variables
   nano .env.production
   ```

3. **Configuration**
   Update these important settings in `.env.production`:
   ```env
   NODE_ENV=production
   PORT=3001
   CORS_ORIGIN=https://your-domain.com
   ```

## 🚀 Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run prod
```

### Using PM2 (Recommended for Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start server-production.js --name "blockfinax-server"

# Auto-start on system boot
pm2 startup
pm2 save
```

## 🐳 Docker Deployment

### Build Docker Image
```bash
docker build -t blockfinax-server .
```

### Run Container
```bash
docker run -d \
  --name blockfinax-server \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e CORS_ORIGIN=https://your-domain.com \
  blockfinax-server
```

### Docker Compose
```yaml
version: '3.8'
services:
  blockfinax-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - CORS_ORIGIN=https://your-domain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 🔧 API Endpoints

### Health Check
```
GET /health
```
Returns server status, uptime, and connection statistics.

### Online Users
```
GET /api/users/online
```
Returns list of currently online users.

## 🔌 WebSocket Events

### Client → Server

| Event | Description | Data |
|-------|-------------|------|
| `authenticate` | User login | `{address, name}` |
| `send_message` | Send message | `{toAddress, message, type, metadata}` |
| `typing` | Typing indicator | `{conversationId, isTyping}` |
| `start_call` | Initiate call | `{toAddress, callType}` |
| `call_response` | Call response | `{callId, response, toAddress}` |
| `webrtc_signal` | WebRTC signaling | `{toAddress, signal, callId}` |
| `get_conversation` | Get chat history | `{withAddress, limit}` |

### Server → Client

| Event | Description | Data |
|-------|-------------|------|
| `authenticated` | Login success | `{success, user}` |
| `users_online` | Online users list | `[{address, name, isOnline, lastSeen}]` |
| `message_received` | New message | `{id, fromAddress, toAddress, text, timestamp, ...}` |
| `message_sent` | Message sent confirmation | `{id, status, ...}` |
| `user_typing` | Someone is typing | `{conversationId, userAddress, isTyping}` |
| `incoming_call` | Incoming call | `{id, fromAddress, callType, timestamp}` |
| `call_response_received` | Call response | `{callId, response, fromAddress}` |
| `webrtc_signal` | WebRTC signaling | `{fromAddress, signal, callId}` |
| `error` | Error message | `{message}` |

## 🔒 Security Considerations

1. **HTTPS Only** - Use SSL/TLS in production
2. **Environment Variables** - Never commit `.env` files
3. **Rate Limiting** - Configured to prevent abuse
4. **Input Validation** - All inputs are validated and sanitized
5. **CORS** - Configure allowed origins properly

## 📊 Monitoring

### Health Check
The server exposes a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "connectedUsers": 5,
  "activeCalls": 2
}
```

### Logs
The server provides structured logging with different levels:
- **INFO** - General information
- **WARN** - Warning messages
- **ERROR** - Error messages
- **DEBUG** - Debug information (development only)

## 🚀 Testing the Deployment

1. **Start the server:**
   ```bash
   npm run prod
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Test WebSocket connection:**
   Use the mobile app or a WebSocket client to connect to `ws://localhost:3001`

## 🔧 Production Checklist

- [ ] Configure environment variables in `.env.production`
- [ ] Set up SSL/TLS certificate
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up monitoring (PM2/Docker health checks)
- [ ] Configure log rotation
- [ ] Set up backup strategy (if using database)
- [ ] Configure firewall rules
- [ ] Test failover scenarios

## 🆘 Troubleshooting

### Connection Issues
- Check CORS configuration
- Verify SSL certificates
- Check firewall settings
- Ensure proper port forwarding

### Performance Issues
- Monitor memory usage
- Check active connections
- Review rate limiting settings
- Scale horizontally if needed

### Common Errors
- **"Not authenticated"** - Client needs to send `authenticate` event first
- **"Invalid address format"** - Ensure Ethereum addresses are properly formatted
- **"Rate limit exceeded"** - Client is sending too many requests

## 📈 Scaling Considerations

For high-traffic production deployments:
1. **Load Balancer** - Distribute connections across multiple server instances
2. **Redis** - Use Redis adapter for Socket.io clustering
3. **Database** - Replace in-memory storage with persistent database
4. **CDN** - Use CDN for static assets
5. **Monitoring** - Implement comprehensive monitoring and alerting