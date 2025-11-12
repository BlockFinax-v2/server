/**
 * User Model
 * Represents a connected user in the system
 */

class User {
  constructor({ address, name, socketId }) {
    this.address = address;
    this.name = name;
    this.socketId = socketId;
    this.isOnline = true;
    this.lastSeen = new Date();
    this.connectedAt = new Date();
  }

  /**
   * Update user's online status
   */
  setOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    if (!isOnline) {
      this.lastSeen = new Date();
    }
  }

  /**
   * Update socket ID when user reconnects
   */
  updateSocketId(socketId) {
    this.socketId = socketId;
    this.isOnline = true;
    this.connectedAt = new Date();
  }

  /**
   * Get user data for client
   */
  toClientData() {
    return {
      address: this.address,
      name: this.name,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen
    };
  }

  /**
   * Get complete user data (internal use)
   */
  toJSON() {
    return {
      address: this.address,
      name: this.name,
      socketId: this.socketId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      connectedAt: this.connectedAt
    };
  }
}

module.exports = User;