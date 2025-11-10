const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Store connected users and active calls
const connectedUsers = new Map();
const userSockets = new Map();
const activeCalls = new Map(); // callId -> call data
const userCalls = new Map(); // userAddress -> callId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication/connection
  socket.on('authenticate', (data) => {
    const { address, name } = data;
    
    // Store user info
    connectedUsers.set(address, {
      address,
      name,
      socketId: socket.id,
      isOnline: true,
      lastSeen: new Date(),
    });
    
    // Map socket to address for easy lookup
    userSockets.set(socket.id, address);
    
    console.log(`User ${name} (${address}) authenticated`);
    
    // Broadcast online users
    io.emit('users_online', Array.from(connectedUsers.values()));
    
    // Send confirmation to user
    socket.emit('authenticated', { success: true });
  });

  // Handle messages
  socket.on('send_message', (data) => {
    const { toAddress, message, type = 'text', metadata = {} } = data;
    const fromAddress = userSockets.get(socket.id);
    
    if (!fromAddress) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAddress,
      toAddress,
      text: message,
      type,
      metadata,
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    console.log(`Message from ${fromAddress} to ${toAddress}:`, message);

    // Send to recipient if online
    const recipient = connectedUsers.get(toAddress);
    if (recipient) {
      const recipientSocket = io.sockets.sockets.get(recipient.socketId);
      if (recipientSocket) {
        recipientSocket.emit('message_received', messageData);
        messageData.status = 'delivered';
      }
    }

    // Send confirmation back to sender
    socket.emit('message_sent', messageData);
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { conversationId, isTyping } = data;
    const fromAddress = userSockets.get(socket.id);
    
    if (!fromAddress) return;

    // Broadcast typing status to other participants in conversation
    socket.broadcast.emit('user_typing', {
      conversationId,
      userAddress: fromAddress,
      isTyping,
    });
  });

  // Handle call initiation
  socket.on('initiate_call', (data) => {
    const { toAddress, callType } = data; // callType: 'voice' | 'video'
    const fromAddress = userSockets.get(socket.id);
    
    if (!fromAddress) {
      socket.emit('call_error', { message: 'Not authenticated' });
      return;
    }

    // Check if user is already in a call
    if (userCalls.has(fromAddress) || userCalls.has(toAddress)) {
      socket.emit('call_error', { message: 'User is already in a call' });
      return;
    }

    const caller = connectedUsers.get(fromAddress);
    const recipient = connectedUsers.get(toAddress);
    
    if (!recipient || !recipient.isOnline) {
      socket.emit('call_error', { message: 'User is not available' });
      return;
    }

    const recipientSocket = io.sockets.sockets.get(recipient.socketId);
    if (!recipientSocket) {
      socket.emit('call_error', { message: 'User is not connected' });
      return;
    }

    const callId = uuidv4();
    const callData = {
      id: callId,
      caller: {
        address: fromAddress,
        name: caller.name,
        socketId: socket.id
      },
      recipient: {
        address: toAddress,
        name: recipient.name,
        socketId: recipient.socketId
      },
      callType,
      status: 'ringing',
      startTime: new Date().toISOString(),
      endTime: null
    };

    // Store the active call
    activeCalls.set(callId, callData);
    userCalls.set(fromAddress, callId);
    userCalls.set(toAddress, callId);

    // Notify recipient of incoming call
    recipientSocket.emit('incoming_call', {
      callId,
      caller: callData.caller,
      callType,
      timestamp: callData.startTime
    });

    // Confirm call initiation to caller
    socket.emit('call_initiated', {
      callId,
      recipient: callData.recipient,
      callType,
      status: 'ringing'
    });

    console.log(`Call initiated: ${fromAddress} -> ${toAddress} (${callType})`);
  });

  // Handle call responses (accept/decline)
  socket.on('call_response', (data) => {
    const { callId, response } = data; // response: 'accept' | 'decline'
    const fromAddress = userSockets.get(socket.id);
    
    if (!fromAddress) return;

    const call = activeCalls.get(callId);
    if (!call) {
      socket.emit('call_error', { message: 'Call not found' });
      return;
    }

    if (response === 'accept') {
      call.status = 'accepted';
      call.acceptTime = new Date().toISOString();

      // Notify caller that call was accepted
      const callerSocket = io.sockets.sockets.get(call.caller.socketId);
      if (callerSocket) {
        callerSocket.emit('call_accepted', {
          callId,
          recipient: call.recipient
        });
      }

      // Send acceptance confirmation to recipient
      socket.emit('call_accepted', {
        callId,
        caller: call.caller
      });

      console.log(`Call ${callId} accepted`);
    } else {
      // Call declined
      call.status = 'declined';
      call.endTime = new Date().toISOString();

      // Notify caller that call was declined
      const callerSocket = io.sockets.sockets.get(call.caller.socketId);
      if (callerSocket) {
        callerSocket.emit('call_declined', {
          callId,
          reason: 'declined'
        });
      }

      // Clean up
      cleanupCall(callId);
      console.log(`Call ${callId} declined`);
    }
  });

  // Handle call termination
  socket.on('end_call', (data) => {
    const { callId } = data;
    const fromAddress = userSockets.get(socket.id);
    
    if (!fromAddress) return;

    const call = activeCalls.get(callId);
    if (!call) return;

    call.status = 'ended';
    call.endTime = new Date().toISOString();

    // Notify other participant
    const otherSocketId = call.caller.socketId === socket.id 
      ? call.recipient.socketId 
      : call.caller.socketId;
    
    const otherSocket = io.sockets.sockets.get(otherSocketId);
    if (otherSocket) {
      otherSocket.emit('call_ended', {
        callId,
        reason: 'ended_by_peer'
      });
    }

    cleanupCall(callId);
    console.log(`Call ${callId} ended by ${fromAddress}`);
  });

  // WebRTC signaling for peer-to-peer connection
  socket.on('webrtc_offer', (data) => {
    const { callId, offer } = data;
    const call = activeCalls.get(callId);
    
    if (!call) return;

    const otherSocketId = call.caller.socketId === socket.id 
      ? call.recipient.socketId 
      : call.caller.socketId;
    
    const otherSocket = io.sockets.sockets.get(otherSocketId);
    if (otherSocket) {
      otherSocket.emit('webrtc_offer', {
        callId,
        offer
      });
    }
  });

  socket.on('webrtc_answer', (data) => {
    const { callId, answer } = data;
    const call = activeCalls.get(callId);
    
    if (!call) return;

    const otherSocketId = call.caller.socketId === socket.id 
      ? call.recipient.socketId 
      : call.caller.socketId;
    
    const otherSocket = io.sockets.sockets.get(otherSocketId);
    if (otherSocket) {
      otherSocket.emit('webrtc_answer', {
        callId,
        answer
      });
    }
  });

  socket.on('webrtc_ice_candidate', (data) => {
    const { callId, candidate } = data;
    const call = activeCalls.get(callId);
    
    if (!call) return;

    const otherSocketId = call.caller.socketId === socket.id 
      ? call.recipient.socketId 
      : call.caller.socketId;
    
    const otherSocket = io.sockets.sockets.get(otherSocketId);
    if (otherSocket) {
      otherSocket.emit('webrtc_ice_candidate', {
        callId,
        candidate
      });
    }
  });

  // Handle call status updates (mute, video toggle, etc.)
  socket.on('call_status_update', (data) => {
    const { callId, status } = data; // status: { audio: boolean, video: boolean }
    const call = activeCalls.get(callId);
    
    if (!call) return;

    const otherSocketId = call.caller.socketId === socket.id 
      ? call.recipient.socketId 
      : call.caller.socketId;
    
    const otherSocket = io.sockets.sockets.get(otherSocketId);
    if (otherSocket) {
      otherSocket.emit('peer_status_update', {
        callId,
        status
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const address = userSockets.get(socket.id);
    
    if (address) {
      // Handle active calls
      const callId = userCalls.get(address);
      if (callId) {
        const call = activeCalls.get(callId);
        if (call) {
          call.status = 'disconnected';
          call.endTime = new Date().toISOString();

          // Notify other participant
          const otherSocketId = call.caller.socketId === socket.id 
            ? call.recipient.socketId 
            : call.caller.socketId;
          
          const otherSocket = io.sockets.sockets.get(otherSocketId);
          if (otherSocket) {
            otherSocket.emit('call_ended', {
              callId,
              reason: 'peer_disconnected'
            });
          }

          cleanupCall(callId);
        }
      }

      const user = connectedUsers.get(address);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
      }
      
      userSockets.delete(socket.id);
      
      console.log(`User ${address} disconnected`);
      
      // Broadcast updated online users
      io.emit('users_online', Array.from(connectedUsers.values()).filter(u => u.isOnline));
    }
  });
});

// Helper function to cleanup call data
function cleanupCall(callId) {
  const call = activeCalls.get(callId);
  if (call) {
    userCalls.delete(call.caller.address);
    userCalls.delete(call.recipient.address);
    activeCalls.delete(callId);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    activeCalls: activeCalls.size
  });
});

// Get server stats
app.get('/stats', (req, res) => {
  res.json({
    connectedUsers: Array.from(connectedUsers.values()),
    activeCalls: Array.from(activeCalls.values()),
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`BlockFinax WebSocket server running on port ${PORT}`);
});
