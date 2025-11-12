/**
 * Call Model
 * Represents a call in the system
 */

class Call {
  constructor({ caller, recipient, callType }) {
    this.id = require('uuid').v4();
    this.caller = {
      address: caller.address,
      name: caller.name,
      socketId: caller.socketId
    };
    this.recipient = {
      address: recipient.address,
      name: recipient.name,
      socketId: recipient.socketId
    };
    this.callType = callType; // 'voice' | 'video'
    this.status = 'ringing'; // 'ringing', 'accepted', 'declined', 'ended', 'disconnected'
    this.startTime = new Date().toISOString();
    this.endTime = null;
    this.acceptTime = null;
    this.createdAt = new Date();
  }

  /**
   * Accept the call
   */
  accept() {
    this.status = 'accepted';
    this.acceptTime = new Date().toISOString();
  }

  /**
   * Decline the call
   */
  decline() {
    this.status = 'declined';
    this.endTime = new Date().toISOString();
  }

  /**
   * End the call
   */
  end() {
    this.status = 'ended';
    this.endTime = new Date().toISOString();
  }

  /**
   * Mark as disconnected
   */
  disconnect() {
    this.status = 'disconnected';
    this.endTime = new Date().toISOString();
  }

  /**
   * Get call duration in seconds
   */
  getDuration() {
    if (!this.endTime || !this.acceptTime) {
      return 0;
    }
    
    const startTime = new Date(this.acceptTime);
    const endTime = new Date(this.endTime);
    return Math.floor((endTime - startTime) / 1000);
  }

  /**
   * Check if call is active
   */
  isActive() {
    return ['ringing', 'accepted'].includes(this.status);
  }

  /**
   * Get call data for client
   */
  toClientData() {
    return {
      id: this.id,
      caller: {
        address: this.caller.address,
        name: this.caller.name
      },
      recipient: {
        address: this.recipient.address,
        name: this.recipient.name
      },
      callType: this.callType,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration()
    };
  }

  /**
   * Get the other participant's socket ID
   */
  getOtherParticipantSocketId(currentSocketId) {
    return this.caller.socketId === currentSocketId 
      ? this.recipient.socketId 
      : this.caller.socketId;
  }

  /**
   * Check if user is participant in this call
   */
  isParticipant(userAddress) {
    return this.caller.address === userAddress || this.recipient.address === userAddress;
  }

  /**
   * Validate call data
   */
  static validate(callData) {
    const { caller, recipient, callType } = callData;

    if (!caller || !recipient) {
      throw new Error('Both caller and recipient are required');
    }

    if (!caller.address || !caller.name || !caller.socketId) {
      throw new Error('Caller must have address, name, and socketId');
    }

    if (!recipient.address || !recipient.name || !recipient.socketId) {
      throw new Error('Recipient must have address, name, and socketId');
    }

    if (!['voice', 'video'].includes(callType)) {
      throw new Error('Call type must be either "voice" or "video"');
    }

    if (caller.address === recipient.address) {
      throw new Error('Cannot call yourself');
    }

    return true;
  }
}

module.exports = Call;