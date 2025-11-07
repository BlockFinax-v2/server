const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow WebSocket connections
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: NODE_ENV === 'production' ? CORS_ORIGIN.split(',') : '*',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    connectedUsers: connectedUsers.size,
    activeCalls: activeCalls.size,
  });
});

// API endpoints
app.get('/api/users/online', (req, res) => {
  const onlineUsers = Array.from(connectedUsers.values())
    .filter(user => user.isOnline)
    .map(user => ({
      address: user.address,
      name: user.name,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
    }));
  
  res.json({ users: onlineUsers });
});

// Socket.io configuration
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true,
});

// Logging utility
const log = {
  info: (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] ${timestamp} - ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp} - ${message}`, error?.message || error || '');
    if (error?.stack && NODE_ENV !== 'production') {
      console.error(error.stack);
    }
  },
  debug: (message, data) => {
    if (NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      console.log(`[DEBUG] ${timestamp} - ${message}`, data ? JSON.stringify(data) : '');
    }
  },
  warn: (message, data) => {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] ${timestamp} - ${message}`, data ? JSON.stringify(data) : '');
  }
};

// Store connected users with enhanced data structure
const connectedUsers = new Map();
const userSockets = new Map();
const activeCalls = new Map(); // Track active calls
const messageHistory = new Map(); // Basic message storage (replace with database in production)
const conversationRooms = new Map(); // Track conversation rooms

// Utility functions
const isValidEthereumAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const generateMessageId = () => {
  return `msg_${Date.now()}_${uuidv4()}`;
};

const generateCallId = () => {
  return `call_${Date.now()}_${uuidv4()}`;
};

const getConversationId = (addr1, addr2) => {
  return [addr1, addr2].sort().join(':');
};

const cleanupInactiveUsers = () => {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  
  for (const [address, user] of connectedUsers.entries()) {
    if (!user.isOnline && user.lastSeen < thirtyMinutesAgo) {
      connectedUsers.delete(address);
      log.debug(`Cleaned up inactive user: ${address}`);
    }
  }
};

// Cleanup inactive users every 30 minutes
setInterval(cleanupInactiveUsers, 30 * 60 * 1000);

// Socket connection handling
io.on('connection', (socket) => {
  log.info('New socket connection:', { socketId: socket.id, ip: socket.handshake.address });

  // Set socket timeout
  socket.setTimeout(300000); // 5 minutes

  // Handle user authentication/connection
  socket.on('authenticate', (data) => {
    try {
      const { address, name } = data;
      
      // Validate input
      if (!address || !name) {
        socket.emit('error', { message: 'Missing required fields: address and name' });
        return;
      }

      if (!isValidEthereumAddress(address)) {
        socket.emit('error', { message: 'Invalid Ethereum address format' });
        return;
      }

      const normalizedAddress = address.toLowerCase();
      
      // Check if user is already connected from another socket
      const existingUser = connectedUsers.get(normalizedAddress);
      if (existingUser && existingUser.isOnline && existingUser.socketId !== socket.id) {
        // Disconnect the old socket
        const oldSocket = io.sockets.sockets.get(existingUser.socketId);
        if (oldSocket) {
          log.warn(`Disconnecting duplicate connection for user: ${normalizedAddress}`);
          oldSocket.disconnect(true);
        }
      }

      // Store user info
      const userData = {
        address: normalizedAddress,
        name: name.substring(0, 50), // Limit name length
        socketId: socket.id,
        isOnline: true,
        lastSeen: new Date(),
        connectedAt: new Date(),
        messageCount: 0,
        callCount: 0,
      };

      connectedUsers.set(normalizedAddress, userData);
      userSockets.set(socket.id, normalizedAddress);
      
      log.info('User authenticated successfully', {
        address: normalizedAddress,
        name: userData.name,
        socketId: socket.id
      });
      
      // Join user to their personal room
      socket.join(`user:${normalizedAddress}`);
      
      // Broadcast online users (only send necessary info)
      const onlineUsers = Array.from(connectedUsers.values())
        .filter(u => u.isOnline)
        .map(u => ({
          address: u.address,
          name: u.name,
          isOnline: u.isOnline,
          lastSeen: u.lastSeen,
        }));
      
      io.emit('users_online', onlineUsers);
      
      // Send confirmation to user
      socket.emit('authenticated', { 
        success: true, 
        user: {
          address: normalizedAddress,
          name: userData.name,
          connectedAt: userData.connectedAt,
        }
      });

    } catch (error) {
      log.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  });

  // Handle messages
  socket.on('send_message', (data) => {
    try {
      const { toAddress, message, type = 'text', metadata = {} } = data;
      const fromAddress = userSockets.get(socket.id);
      
      if (!fromAddress) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Validate input
      if (!toAddress || !message) {
        socket.emit('error', { message: 'Missing required fields: toAddress and message' });
        return;
      }

      if (!isValidEthereumAddress(toAddress)) {
        socket.emit('error', { message: 'Invalid recipient address format' });
        return;
      }

      const normalizedToAddress = toAddress.toLowerCase();
      const messageText = message.substring(0, 1000); // Limit message length
      
      // Rate limiting per user
      const sender = connectedUsers.get(fromAddress);
      if (sender) {
        sender.messageCount = (sender.messageCount || 0) + 1;
        // Reset counter every minute
        setTimeout(() => {
          if (sender.messageCount > 0) sender.messageCount--;
        }, 60000);
        
        // Check rate limit (60 messages per minute)
        if (sender.messageCount > 60) {
          socket.emit('error', { message: 'Message rate limit exceeded' });
          return;
        }
      }

      const messageData = {
        id: generateMessageId(),
        fromAddress,
        toAddress: normalizedToAddress,
        text: messageText,
        type: type.substring(0, 20), // Limit type length
        metadata: typeof metadata === 'object' ? metadata : {},
        timestamp: new Date().toISOString(),
        status: 'sent',
      };

      log.debug('Processing message', {
        from: fromAddress,
        to: normalizedToAddress,
        type: messageData.type,
        messageId: messageData.id
      });

      // Store message in history (basic implementation)
      const conversationId = getConversationId(fromAddress, normalizedToAddress);
      if (!messageHistory.has(conversationId)) {
        messageHistory.set(conversationId, []);
      }
      
      const conversation = messageHistory.get(conversationId);
      conversation.push(messageData);
      
      // Keep only last 100 messages per conversation
      if (conversation.length > 100) {
        conversation.splice(0, conversation.length - 100);
      }

      // Send to recipient if online
      const recipient = connectedUsers.get(normalizedToAddress);
      if (recipient && recipient.isOnline) {
        const recipientSocket = io.sockets.sockets.get(recipient.socketId);
        if (recipientSocket) {
          recipientSocket.emit('message_received', {
            ...messageData,
            status: 'delivered'
          });
          log.debug('Message delivered to recipient', { messageId: messageData.id });
        }
      } else {
        log.debug('Recipient offline, message stored', { 
          messageId: messageData.id,
          recipient: normalizedToAddress 
        });
      }

      // Send confirmation back to sender
      socket.emit('message_sent', messageData);

    } catch (error) {
      log.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle message delivery confirmation
  socket.on('message:delivered', (data) => {
    try {
      const { messageId } = data;
      const userAddress = userSockets.get(socket.id);
      
      if (!userAddress || !messageId) return;
      
      // Here you would update message status in database
      log.debug('Message delivery confirmed', { messageId, userAddress });
      
    } catch (error) {
      log.error('Message delivery confirmation error:', error);
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    try {
      const { conversationId, isTyping } = data;
      const fromAddress = userSockets.get(socket.id);
      
      if (!fromAddress || typeof isTyping !== 'boolean') return;

      // Broadcast typing status to other participants in conversation
      socket.broadcast.emit('user_typing', {
        conversationId: conversationId?.substring(0, 100), // Limit length
        userAddress: fromAddress,
        isTyping,
      });

      log.debug('Typing indicator', { 
        fromAddress, 
        conversationId, 
        isTyping 
      });

    } catch (error) {
      log.error('Typing indicator error:', error);
    }
  });

  // Handle call initiation
  socket.on('start_call', (data) => {
    try {
      const { toAddress, callType } = data;
      const fromAddress = userSockets.get(socket.id);
      
      if (!fromAddress) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      if (!toAddress || !callType) {
        socket.emit('error', { message: 'Missing required fields: toAddress and callType' });
        return;
      }

      if (!isValidEthereumAddress(toAddress)) {
        socket.emit('error', { message: 'Invalid recipient address format' });
        return;
      }

      if (!['voice', 'video'].includes(callType)) {
        socket.emit('error', { message: 'Invalid call type' });
        return;
      }

      const normalizedToAddress = toAddress.toLowerCase();
      
      // Check if either user is already in a call
      const existingCall = Array.from(activeCalls.values()).find(call => 
        call.participants.includes(fromAddress) || call.participants.includes(normalizedToAddress)
      );

      if (existingCall) {
        socket.emit('error', { message: 'User already in a call' });
        return;
      }

      // Rate limiting for calls
      const caller = connectedUsers.get(fromAddress);
      if (caller) {
        caller.callCount = (caller.callCount || 0) + 1;
        setTimeout(() => {
          if (caller.callCount > 0) caller.callCount--;
        }, 60000);
        
        if (caller.callCount > 10) { // 10 calls per minute
          socket.emit('error', { message: 'Call rate limit exceeded' });
          return;
        }
      }

      const recipient = connectedUsers.get(normalizedToAddress);
      if (recipient && recipient.isOnline) {
        const recipientSocket = io.sockets.sockets.get(recipient.socketId);
        if (recipientSocket) {
          const callData = {
            id: generateCallId(),
            fromAddress,
            toAddress: normalizedToAddress,
            callType,
            status: 'ringing',
            timestamp: new Date().toISOString(),
            participants: [fromAddress, normalizedToAddress],
          };

          // Store active call
          activeCalls.set(callData.id, {
            ...callData,
            startTime: new Date(),
          });

          recipientSocket.emit('incoming_call', callData);
          socket.emit('call_initiated', callData);

          log.info('Call initiated', {
            callId: callData.id,
            from: fromAddress,
            to: normalizedToAddress,
            type: callType
          });

          // Auto-cleanup call after 30 seconds if not answered
          setTimeout(() => {
            const call = activeCalls.get(callData.id);
            if (call && call.status === 'ringing') {
              activeCalls.delete(callData.id);
              
              const callerSocket = io.sockets.sockets.get(call.callerSocketId);
              const recipientSocket = io.sockets.sockets.get(call.recipientSocketId);
              
              if (callerSocket) callerSocket.emit('call_timeout', { callId: callData.id });
              if (recipientSocket) recipientSocket.emit('call_timeout', { callId: callData.id });
              
              log.info('Call timed out', { callId: callData.id });
            }
          }, 30000);

        } else {
          socket.emit('error', { message: 'Recipient not available' });
        }
      } else {
        socket.emit('error', { message: 'Recipient offline' });
      }

    } catch (error) {
      log.error('Start call error:', error);
      socket.emit('error', { message: 'Failed to start call' });
    }
  });

  // Handle call responses
  socket.on('call_response', (data) => {
    try {
      const { callId, response, toAddress } = data;
      const fromAddress = userSockets.get(socket.id);
      
      if (!fromAddress || !callId || !response || !toAddress) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      if (!['accept', 'decline', 'end'].includes(response)) {
        socket.emit('error', { message: 'Invalid call response' });
        return;
      }

      const normalizedToAddress = toAddress.toLowerCase();
      const call = activeCalls.get(callId);
      
      if (!call) {
        socket.emit('error', { message: 'Call not found' });
        return;
      }

      if (!call.participants.includes(fromAddress)) {
        socket.emit('error', { message: 'Not authorized for this call' });
        return;
      }

      const recipient = connectedUsers.get(normalizedToAddress);
      if (recipient && recipient.isOnline) {
        const recipientSocket = io.sockets.sockets.get(recipient.socketId);
        if (recipientSocket) {
          recipientSocket.emit('call_response_received', {
            callId,
            response,
            fromAddress,
            timestamp: new Date().toISOString(),
          });

          // Update call status
          if (response === 'accept') {
            activeCalls.set(callId, {
              ...call,
              status: 'active',
              acceptedAt: new Date(),
            });
            log.info('Call accepted', { callId, from: fromAddress, to: normalizedToAddress });
          } else if (response === 'decline' || response === 'end') {
            activeCalls.delete(callId);
            log.info('Call ended/declined', { callId, response, from: fromAddress, to: normalizedToAddress });
          }
        }
      }

    } catch (error) {
      log.error('Call response error:', error);
      socket.emit('error', { message: 'Failed to process call response' });
    }
  });

  // Handle WebRTC signaling
  socket.on('webrtc_signal', (data) => {
    try {
      const { toAddress, signal, callId } = data;
      const fromAddress = userSockets.get(socket.id);
      
      if (!fromAddress || !toAddress || !signal) return;
      
      const normalizedToAddress = toAddress.toLowerCase();
      
      // Validate call exists and user is participant
      if (callId) {
        const call = activeCalls.get(callId);
        if (!call || !call.participants.includes(fromAddress)) {
          log.warn('Invalid WebRTC signal attempt', { fromAddress, callId });
          return;
        }
      }
      
      const recipient = connectedUsers.get(normalizedToAddress);
      if (recipient && recipient.isOnline) {
        const recipientSocket = io.sockets.sockets.get(recipient.socketId);
        if (recipientSocket) {
          recipientSocket.emit('webrtc_signal', {
            fromAddress,
            signal,
            callId,
            timestamp: new Date().toISOString(),
          });
          
          log.debug('WebRTC signal relayed', { 
            from: fromAddress, 
            to: normalizedToAddress,
            callId 
          });
        }
      }

    } catch (error) {
      log.error('WebRTC signal error:', error);
    }
  });

  // Handle get conversation history
  socket.on('get_conversation', (data) => {
    try {
      const { withAddress, limit = 50 } = data;
      const fromAddress = userSockets.get(socket.id);
      
      if (!fromAddress || !withAddress) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      const normalizedWithAddress = withAddress.toLowerCase();
      const conversationId = getConversationId(fromAddress, normalizedWithAddress);
      const messages = messageHistory.get(conversationId) || [];
      
      // Return last N messages
      const recentMessages = messages.slice(-Math.min(limit, 100));
      
      socket.emit('conversation_history', {
        conversationId,
        withAddress: normalizedWithAddress,
        messages: recentMessages,
      });

      log.debug('Conversation history requested', {
        fromAddress,
        withAddress: normalizedWithAddress,
        messageCount: recentMessages.length
      });

    } catch (error) {
      log.error('Get conversation error:', error);
      socket.emit('error', { message: 'Failed to get conversation' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    try {
      const address = userSockets.get(socket.id);
      
      if (address) {
        const user = connectedUsers.get(address);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          
          // End any active calls
          const userCalls = Array.from(activeCalls.entries()).filter(([_, call]) => 
            call.participants.includes(address)
          );
          
          userCalls.forEach(([callId, call]) => {
            activeCalls.delete(callId);
            
            // Notify other participants
            call.participants.forEach(participantAddress => {
              if (participantAddress !== address) {
                const participant = connectedUsers.get(participantAddress);
                if (participant && participant.isOnline) {
                  const participantSocket = io.sockets.sockets.get(participant.socketId);
                  if (participantSocket) {
                    participantSocket.emit('call_ended', {
                      callId,
                      reason: 'participant_disconnected',
                      disconnectedUser: address,
                    });
                  }
                }
              }
            });
            
            log.info('Call ended due to disconnection', { callId, disconnectedUser: address });
          });
        }
        
        userSockets.delete(socket.id);
        
        log.info('User disconnected', { address, reason, socketId: socket.id });
        
        // Broadcast updated online users
        const onlineUsers = Array.from(connectedUsers.values())
          .filter(u => u.isOnline)
          .map(u => ({
            address: u.address,
            name: u.name,
            isOnline: u.isOnline,
            lastSeen: u.lastSeen,
          }));
        
        io.emit('users_online', onlineUsers);
      }

    } catch (error) {
      log.error('Disconnect handling error:', error);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    log.error('Socket error:', error);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  
  // Close server
  server.close(() => {
    log.info('Server closed');
    
    // Close all socket connections
    io.close(() => {
      log.info('Socket.io closed');
      process.exit(0);
    });
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    log.error('Force closing server after timeout');
    process.exit(1);
  }, 30000);
});

// Start server
server.listen(PORT, () => {
  log.info('BlockFinax WebSocket Server Started', {
    port: PORT,
    environment: NODE_ENV,
    cors: corsOptions.origin,
    timestamp: new Date().toISOString(),
  });
});

// Export for testing
module.exports = { app, server, io };