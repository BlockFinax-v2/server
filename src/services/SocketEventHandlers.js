/**
 * Socket Event Handlers
 * Manages all Socket.IO event handling
 */

const logger = require('../utils/logger');

class SocketEventHandlers {
  constructor(socketService) {
    this.socketService = socketService;
  }

  /**
   * Register all event handlers for a socket
   */
  registerHandlers(socket) {
    // Authentication
    socket.on('authenticate', (data) => {
      this.handleAuthentication(socket, data);
    });

    // Messaging
    socket.on('send_message', (data) => {
      this.handleSendMessage(socket, data);
    });

    socket.on('typing', (data) => {
      this.handleTyping(socket, data);
    });

    // Calling
    socket.on('initiate_call', (data) => {
      this.handleInitiateCall(socket, data);
    });

    socket.on('call_response', (data) => {
      this.handleCallResponse(socket, data);
    });

    socket.on('end_call', (data) => {
      this.handleEndCall(socket, data);
    });

    socket.on('call_status_update', (data) => {
      this.handleCallStatusUpdate(socket, data);
    });

    // WebRTC Signaling
    socket.on('webrtc_offer', (data) => {
      this.handleWebRTCOffer(socket, data);
    });

    socket.on('webrtc_answer', (data) => {
      this.handleWebRTCAnswer(socket, data);
    });

    socket.on('webrtc_ice_candidate', (data) => {
      this.handleWebRTCIceCandidate(socket, data);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  }

  /**
   * Handle user authentication
   */
  handleAuthentication(socket, data) {
    this.socketService.authenticateUser(socket, data);
  }

  /**
   * Handle message sending
   */
  handleSendMessage(socket, data) {
    this.socketService.sendMessage(socket, data);
  }

  /**
   * Handle typing indicators
   */
  handleTyping(socket, data) {
    this.socketService.handleTyping(socket, data);
  }

  /**
   * Handle call initiation
   */
  handleInitiateCall(socket, data) {
    this.socketService.initiateCall(socket, data);
  }

  /**
   * Handle call response
   */
  handleCallResponse(socket, data) {
    this.socketService.respondToCall(socket, data);
  }

  /**
   * Handle call termination
   */
  handleEndCall(socket, data) {
    this.socketService.endCall(socket, data);
  }

  /**
   * Handle call status updates (mute, video toggle, etc.)
   */
  handleCallStatusUpdate(socket, data) {
    const { callId, status } = data;
    const call = this.socketService.activeCalls.get(callId);
    
    if (!call) {
      return;
    }

    const otherSocketId = call.getOtherParticipantSocketId(socket.id);
    const otherSocket = this.socketService.io.sockets.sockets.get(otherSocketId);
    
    if (otherSocket) {
      otherSocket.emit('peer_status_update', {
        callId,
        status
      });
    }
  }

  /**
   * Handle WebRTC offer
   */
  handleWebRTCOffer(socket, data) {
    this.socketService.handleWebRTCSignaling(socket, 'webrtc_offer', data);
  }

  /**
   * Handle WebRTC answer
   */
  handleWebRTCAnswer(socket, data) {
    this.socketService.handleWebRTCSignaling(socket, 'webrtc_answer', data);
  }

  /**
   * Handle WebRTC ICE candidate
   */
  handleWebRTCIceCandidate(socket, data) {
    this.socketService.handleWebRTCSignaling(socket, 'webrtc_ice_candidate', data);
  }
}

module.exports = SocketEventHandlers;