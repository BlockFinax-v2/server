# BlockFinax Server v2.0

A production-ready, scalable WebSocket server built with Express.js and Socket.IO for real-time messaging and calling functionality.

## 🏗 Architecture

```
src/
├── config/           # Application configuration
├── controllers/      # Request handlers and business logic
├── middleware/       # Express middleware (security, logging, error handling)
├── models/          # Data models and validation
├── routes/          # API route definitions
├── services/        # Business logic and external service integrations
├── utils/           # Utility functions and helpers
└── server.js        # Main application entry point
```

## 🚀 Features

### Core Functionality

- **Real-time Messaging**: Instant message delivery with delivery confirmations
- **Voice & Video Calls**: WebRTC-based calling with signaling support
- **User Management**: Authentication and presence tracking
- **Typing Indicators**: Real-time typing status updates

### Production Ready

- **Security**: Helmet.js, CORS, rate limiting, input validation
- **Error Handling**: Centralized error handling with logging
- **Monitoring**: Health checks, metrics, and detailed logging
- **Scalability**: Clustered deployment support with PM2
- **Configuration**: Environment-based configuration management

## 🛠 Installation & Setup

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn

### Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production mode
npm run prod
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Security Configuration
CORS_ORIGIN=*
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

## 🔧 API Endpoints

### Health Checks

- `GET /` - Server info
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system health
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

### Statistics & Monitoring

- `GET /api` - API information
- `GET /api/stats` - Complete server statistics
- `GET /api/metrics` - Basic metrics
- `GET /api/users` - Online users list
- `GET /api/calls` - Active calls list

## 🔌 Socket.IO Events

### Authentication

```javascript
// Client connects and authenticates
socket.emit("authenticate", {
  address: "user_blockchain_address",
  name: "User Display Name",
});

// Server confirms authentication
socket.on("authenticated", (data) => {
  console.log("Authenticated:", data.success);
});
```

### Messaging

```javascript
// Send a message
socket.emit("send_message", {
  toAddress: "recipient_address",
  message: "Hello World!",
  type: "text",
  metadata: {},
});

// Receive messages
socket.on("message_received", (messageData) => {
  console.log("New message:", messageData);
});

// Message delivery confirmation
socket.on("message_sent", (messageData) => {
  console.log("Message sent:", messageData.status);
});
```

### Calling

```javascript
// Initiate a call
socket.emit("initiate_call", {
  toAddress: "recipient_address",
  callType: "video", // or 'voice'
});

// Handle incoming call
socket.on("incoming_call", (callData) => {
  console.log("Incoming call from:", callData.caller.name);
});

// Respond to call
socket.emit("call_response", {
  callId: "call_id",
  response: "accept", // or 'decline'
});

// Handle call acceptance
socket.on("call_accepted", (data) => {
  console.log("Call accepted, starting WebRTC...");
});
```

### WebRTC Signaling

```javascript
// Exchange WebRTC offers/answers
socket.emit("webrtc_offer", { callId, offer });
socket.on("webrtc_offer", ({ callId, offer }) => {
  // Handle WebRTC offer
});

socket.emit("webrtc_answer", { callId, answer });
socket.on("webrtc_answer", ({ callId, answer }) => {
  // Handle WebRTC answer
});

// Exchange ICE candidates
socket.emit("webrtc_ice_candidate", { callId, candidate });
socket.on("webrtc_ice_candidate", ({ callId, candidate }) => {
  // Handle ICE candidate
});
```

## 🔐 Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **CORS Protection**: Configurable cross-origin request policies
- **Helmet.js**: Security headers and protection against common attacks
- **Input Validation**: Message and call data validation
- **Error Handling**: Secure error responses without sensitive information leaks

## 📊 Monitoring & Logging

### Logging Levels

- `error`: Error conditions
- `warn`: Warning conditions
- `info`: General information (default)
- `debug`: Debug information

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "version": "2.0.0",
  "environment": "production"
}
```

### Statistics Response

```json
{
  "success": true,
  "data": {
    "totalConnections": 150,
    "onlineUsers": 145,
    "activeCalls": 12,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🚀 Deployment

### PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem configuration
npm run pm2:start

# Monitor
npm run pm2:logs

# Restart
npm run pm2:restart
```

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables

```bash
# Production deployment
export NODE_ENV=production
export PORT=3001
export LOG_LEVEL=info
export CORS_ORIGIN="https://yourdomain.com"
```

## 🧪 Development

### File Structure Guidelines

- **Controllers**: Handle HTTP requests, input validation, and response formatting
- **Services**: Business logic, external API calls, and complex operations
- **Models**: Data structures, validation rules, and data manipulation
- **Middleware**: Request/response processing, authentication, logging
- **Routes**: URL routing and controller binding
- **Utils**: Helper functions, constants, and shared utilities

### Adding New Features

1. Create models in `/models` for data structures
2. Implement business logic in `/services`
3. Create route handlers in `/controllers`
4. Define routes in `/routes`
5. Add middleware if needed
6. Update configuration in `/config`

### Error Handling

All errors are handled centrally. Use the provided error classes:

```javascript
const { asyncHandler } = require("../middleware/errorHandler");

const myController = asyncHandler(async (req, res) => {
  // Your async code here
  // Errors are automatically caught and handled
});
```

## 📋 Migration from v1.0

The new architecture maintains 100% API compatibility with the previous version while providing:

- Better code organization
- Improved error handling
- Enhanced security
- Production-ready monitoring
- Scalability improvements

No changes are required for existing clients.

## 🤝 Contributing

1. Follow the established architecture patterns
2. Add appropriate error handling and logging
3. Update documentation for new features
4. Test thoroughly before submitting PRs

## 📄 License

MIT License - see LICENSE file for details.
