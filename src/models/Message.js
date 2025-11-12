/**
 * Message Model
 * Represents a message in the system
 */

class Message {
  constructor({ fromAddress, toAddress, text, type = 'text', metadata = {} }) {
    this.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.text = text;
    this.type = type; // 'text', 'image', 'file', etc.
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    this.status = 'sent'; // 'sent', 'delivered', 'read'
    this.createdAt = new Date();
  }

  /**
   * Mark message as delivered
   */
  markAsDelivered() {
    this.status = 'delivered';
    this.deliveredAt = new Date();
  }

  /**
   * Mark message as read
   */
  markAsRead() {
    this.status = 'read';
    this.readAt = new Date();
  }

  /**
   * Get message data for client
   */
  toClientData() {
    return {
      id: this.id,
      fromAddress: this.fromAddress,
      toAddress: this.toAddress,
      text: this.text,
      type: this.type,
      metadata: this.metadata,
      timestamp: this.timestamp,
      status: this.status
    };
  }

  /**
   * Validate message content
   */
  static validate(messageData, maxLength = 1000) {
    const { fromAddress, toAddress, text, type } = messageData;

    if (!fromAddress || !toAddress) {
      throw new Error('Both fromAddress and toAddress are required');
    }

    if (!text || typeof text !== 'string') {
      throw new Error('Message text is required and must be a string');
    }

    if (text.length > maxLength) {
      throw new Error(`Message text cannot exceed ${maxLength} characters`);
    }

    if (type && !['text', 'image', 'file', 'system'].includes(type)) {
      throw new Error('Invalid message type');
    }

    return true;
  }
}

module.exports = Message;