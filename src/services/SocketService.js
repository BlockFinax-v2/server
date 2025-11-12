/**
 * Socket.IO Service
 * Handles all WebSocket connections and real-time communication
 */

const { Server } = require('socket.io');
const config = require('../config');
const logger = require('../utils/logger');
const User = require('../models/User');
const Message = require('../models/Message');
const Call = require('../models/Call');
const SocketEventHandlers = require('./SocketEventHandlers');

class SocketService {
  constructor(httpServer) {
    this.httpServer = httpServer;
    this.io = null;
    this.connectedUsers = new Map(); // address -> User
    this.userSockets = new Map(); // socketId -> address
    this.activeCalls = new Map(); // callId -> Call
    this.userCalls = new Map(); // address -> callId
    this.eventHandlers = null;
  }

  /**
   * Initialize Socket.IO server
   */
  initialize() {
    this.io = new Server(this.httpServer, {
      cors: config.cors,
      transports: config.socket.transports,
      pingTimeout: config.socket.pingTimeout,
      pingInterval: config.socket.pingInterval,
      maxHttpBufferSize: config.socket.maxHttpBufferSize,
      allowEIO3: config.socket.allowEIO3
    });

    this.eventHandlers = new SocketEventHandlers(this);
    this.setupConnectionHandling();
    
    logger.info('Socket.IO service initialized');
  }

  /**
   * Setup connection handling
   */
  setupConnectionHandling() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      
      // Register all event handlers
      this.eventHandlers.registerHandlers(socket);
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });
    });
  }

  /**
   * Handle user authentication
   */
  authenticateUser(socket, data) {
    try {
      const { address, name } = data;

      if (!address || !name) {
        throw new Error('Address and name are required');
      }

      if (name.length > config.limits.maxUsernameLength) {
        throw new Error(`Name cannot exceed ${config.limits.maxUsernameLength} characters`);
      }

      // Check connection limits
      if (this.connectedUsers.size >= config.limits.maxConnectedUsers) {
        throw new Error('Server at maximum capacity');
      }

      // Create or update user
      const user = new User({ address, name, socketId: socket.id });
      this.connectedUsers.set(address, user);
      this.userSockets.set(socket.id, address);

      logger.info(`User authenticated: ${name} (${address})`);

      // Broadcast updated online users
      this.broadcastOnlineUsers();

      // Send confirmation
      socket.emit('authenticated', { success: true, user: user.toClientData() });

    } catch (error) {
      logger.error('Authentication error:', error.message);
      socket.emit('auth_error', { message: error.message });
    }
  }

  /**
   * Handle message sending
   */
  sendMessage(socket, data) {
    try {
      const fromAddress = this.userSockets.get(socket.id);
      
      if (!fromAddress) {
        throw new Error('User not authenticated');
      }

      // Validate message
      Message.validate(data, config.limits.maxMessageLength);

      // Create message
      const message = new Message({
        fromAddress,
        toAddress: data.toAddress,
        text: data.message,
        type: data.type,
        metadata: data.metadata
      });

      logger.info(`Message from ${fromAddress} to ${data.toAddress}`);

      // Send to recipient if online
      const recipient = this.connectedUsers.get(data.toAddress);
      if (recipient && recipient.isOnline) {
        const recipientSocket = this.io.sockets.sockets.get(recipient.socketId);
        if (recipientSocket) {
          recipientSocket.emit('message_received', message.toClientData());
          message.markAsDelivered();
        }
      }

      // Send confirmation to sender
      socket.emit('message_sent', message.toClientData());

    } catch (error) {
      logger.error('Message sending error:', error.message);
      socket.emit('message_error', { message: error.message });
    }
  }

  /**
   * Handle call initiation
   */
  initiateCall(socket, data) {
    try {
      const { toAddress, callType } = data;
      const fromAddress = this.userSockets.get(socket.id);

      if (!fromAddress) {
        throw new Error('User not authenticated');
      }

      // Check for existing calls
      if (this.userCalls.has(fromAddress) || this.userCalls.has(toAddress)) {
        throw new Error('User is already in a call');
      }

      // Check call limits
      if (this.activeCalls.size >= config.limits.maxActiveCalls) {
        throw new Error('Maximum number of active calls reached');
      }

      const caller = this.connectedUsers.get(fromAddress);
      const recipient = this.connectedUsers.get(toAddress);

      if (!recipient || !recipient.isOnline) {
        throw new Error('User is not available');
      }

      const recipientSocket = this.io.sockets.sockets.get(recipient.socketId);
      if (!recipientSocket) {
        throw new Error('User is not connected');
      }

      // Validate call data
      Call.validate({ caller, recipient, callType });

      // Create call
      const call = new Call({ caller, recipient, callType });
      
      // Store call references
      this.activeCalls.set(call.id, call);
      this.userCalls.set(fromAddress, call.id);
      this.userCalls.set(toAddress, call.id);

      // Notify recipient
      recipientSocket.emit('incoming_call', {
        callId: call.id,
        caller: call.caller,
        callType,
        timestamp: call.startTime
      });

      // Confirm to caller
      socket.emit('call_initiated', {
        callId: call.id,
        recipient: call.recipient,
        callType,
        status: 'ringing'
      });

      logger.info(`Call initiated: ${fromAddress} -> ${toAddress} (${callType})`);

      // Set timeout for call response
      setTimeout(() => {
        if (this.activeCalls.has(call.id) && call.status === 'ringing') {
          this.endCall(socket, { callId: call.id }, 'timeout');
        }
      }, config.limits.callTimeout);

    } catch (error) {
      logger.error('Call initiation error:', error.message);
      socket.emit('call_error', { message: error.message });
    }
  }

  /**
   * Handle call response
   */
  respondToCall(socket, data) {
    try {
      const { callId, response } = data;
      const fromAddress = this.userSockets.get(socket.id);

      if (!fromAddress) {
        throw new Error('User not authenticated');
      }

      const call = this.activeCalls.get(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      if (!call.isParticipant(fromAddress)) {
        throw new Error('Not authorized for this call');
      }

      const otherSocketId = call.getOtherParticipantSocketId(socket.id);
      const otherSocket = this.io.sockets.sockets.get(otherSocketId);

      if (response === 'accept') {
        call.accept();

        // Notify caller
        if (otherSocket) {
          otherSocket.emit('call_accepted', {
            callId,
            recipient: call.recipient
          });
        }

        // Confirm to recipient
        socket.emit('call_accepted', {
          callId,
          caller: call.caller
        });

        logger.info(`Call ${callId} accepted`);

      } else {
        call.decline();

        // Notify caller
        if (otherSocket) {
          otherSocket.emit('call_declined', {
            callId,
            reason: 'declined'
          });
        }

        this.cleanupCall(callId);
        logger.info(`Call ${callId} declined`);
      }

    } catch (error) {
      logger.error('Call response error:', error.message);
      socket.emit('call_error', { message: error.message });
    }
  }

  /**
   * End call
   */
  endCall(socket, data, reason = 'ended_by_user') {
    try {
      const { callId } = data;
      const call = this.activeCalls.get(callId);

      if (!call) {
        return;
      }

      call.end();

      // Notify other participant
      const otherSocketId = call.getOtherParticipantSocketId(socket.id);
      const otherSocket = this.io.sockets.sockets.get(otherSocketId);

      if (otherSocket) {
        otherSocket.emit('call_ended', {
          callId,
          reason
        });
      }

      this.cleanupCall(callId);
      logger.info(`Call ${callId} ended: ${reason}`);

    } catch (error) {
      logger.error('End call error:', error.message);
    }
  }

  /**
   * Handle WebRTC signaling
   */
  handleWebRTCSignaling(socket, eventType, data) {
    try {
      const { callId } = data;
      const call = this.activeCalls.get(callId);

      if (!call) {
        return;
      }

      const otherSocketId = call.getOtherParticipantSocketId(socket.id);
      const otherSocket = this.io.sockets.sockets.get(otherSocketId);

      if (otherSocket) {
        otherSocket.emit(eventType, data);
      }

    } catch (error) {
      logger.error(`WebRTC signaling error (${eventType}):`, error.message);
    }
  }

  /**
   * Handle typing indicators
   */
  handleTyping(socket, data) {
    try {
      const { conversationId, isTyping } = data;
      const fromAddress = this.userSockets.get(socket.id);

      if (!fromAddress) {
        return;
      }

      // Broadcast to other participants
      socket.broadcast.emit('user_typing', {
        conversationId,
        userAddress: fromAddress,
        isTyping
      });

    } catch (error) {
      logger.error('Typing indicator error:', error.message);
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(socket, reason) {
    const address = this.userSockets.get(socket.id);

    if (address) {
      // Handle active calls
      const callId = this.userCalls.get(address);
      if (callId) {
        this.endCall(socket, { callId }, 'peer_disconnected');
      }

      // Update user status
      const user = this.connectedUsers.get(address);
      if (user) {
        user.setOnlineStatus(false);
      }

      this.userSockets.delete(socket.id);

      logger.info(`User ${address} disconnected: ${reason}`);

      // Broadcast updated online users
      this.broadcastOnlineUsers();
    }
  }

  /**
   * Broadcast online users
   */
  broadcastOnlineUsers() {
    const onlineUsers = Array.from(this.connectedUsers.values())
      .filter(user => user.isOnline)
      .map(user => user.toClientData());

    this.io.emit('users_online', onlineUsers);
  }

  /**
   * Cleanup call data
   */
  cleanupCall(callId) {
    const call = this.activeCalls.get(callId);
    if (call) {
      this.userCalls.delete(call.caller.address);
      this.userCalls.delete(call.recipient.address);
      this.activeCalls.delete(callId);
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedUsers: Array.from(this.connectedUsers.values()).map(user => user.toClientData()),
      activeCalls: Array.from(this.activeCalls.values()).map(call => call.toClientData()),
      totalConnections: this.connectedUsers.size,
      onlineUsers: Array.from(this.connectedUsers.values()).filter(user => user.isOnline).length,
      totalActiveCalls: this.activeCalls.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup service
   */
  cleanup() {
    if (this.io) {
      logger.info('Closing Socket.IO connections...');
      this.io.close();
      
      // Clear data structures
      this.connectedUsers.clear();
      this.userSockets.clear();
      this.activeCalls.clear();
      this.userCalls.clear();
    }
  }
}

module.exports = SocketService;