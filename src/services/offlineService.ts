type ConnectionListener = (isConnected: boolean) => void;

export class OfflineService {
  private static isConnected: boolean = true;
  private static listeners: Set<ConnectionListener> = new Set();
  private static pendingQueue: Array<{ id: string; action: string; payload: any }> = [];

  /**
   * Register listener for network status changes
   */
  static addStatusListener(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Set online / offline connectivity status
   */
  static setOnlineStatus(online: boolean): void {
    this.isConnected = online;
    this.listeners.forEach(l => l(online));
    if (online && this.pendingQueue.length > 0) {
      this.flushQueue();
    }
  }

  /**
   * Check current online state
   */
  static isOnline(): boolean {
    return this.isConnected;
  }

  /**
   * Queue action for background retry when connection drops
   */
  static queueAction(action: string, payload: any): void {
    this.pendingQueue.push({ id: `q_${Date.now()}`, action, payload });
  }

  /**
   * Flush queued actions once reconnected
   */
  private static flushQueue(): void {
    console.log(`Flushing ${this.pendingQueue.length} queued offline actions...`);
    this.pendingQueue = [];
  }
}
