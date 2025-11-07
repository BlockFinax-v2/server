# BlockFinax WebSocket Server

Production-ready WebSocket server for real-time messaging and calling features.

## Deployment

This server is configured for easy deployment on Railway, Render, or Heroku.

### Environment Variables Required:
- `NODE_ENV=production`
- `PORT` (automatically set by hosting platform)
- `CORS_ORIGIN` (set to your mobile app domain or * for development)

### Health Check Endpoint:
- `GET /health` - Returns server status and metrics

### Features:
- Real-time messaging with Socket.io
- WebRTC signaling for voice/video calls
- Rate limiting and security headers
- User authentication with Ethereum addresses
- Message persistence and conversation management