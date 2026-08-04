/**
 * Local chat message shape retained for FloatingLiveChat presentation.
 * Production attendee chat must use /api/live/chat + realtime (useLiveRoomChat).
 * This store no longer seeds or simulates messages.
 */

export type LiveChatMessageColor = "pink" | "cyan" | "purple" | "green" | "blue";

export type LiveChatMessage = {
  id: string;
  userName: string;
  initials: string;
  color: LiveChatMessageColor;
  text: string;
  createdAt: number;
  type: "message" | "seed" | "prayer";
  likeCount?: number;
  seedAmount?: number;
};

type Subscriber = (messages: LiveChatMessage[]) => void;

const MAX_MESSAGES = 50;

class LiveChatStore {
  private messages: LiveChatMessage[] = [];

  private subscribers = new Set<Subscriber>();

  subscribe(_streamId: string, listener: Subscriber): () => void {
    this.subscribers.add(listener);
    listener(this.messages);

    return () => {
      this.subscribers.delete(listener);
    };
  }

  getMessages(): LiveChatMessage[] {
    return this.messages;
  }

  /** Test / local helper — does not invent network traffic. */
  reset(): void {
    this.messages = [];
    this.notify();
  }

  addMessage(message: LiveChatMessage): void {
    this.messages = [...this.messages, message].slice(-MAX_MESSAGES);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.subscribers) {
      listener(this.messages);
    }
  }
}

export const liveChatStore = new LiveChatStore();
