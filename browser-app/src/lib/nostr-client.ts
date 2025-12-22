import { createRxNostr, createRxForwardReq, uniq } from 'rx-nostr';
import { verifier } from 'rx-nostr-crypto';
import { type NostrEvent } from 'nostr-tools/core';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

// Extend Window type for NIP-07 support
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: {
        kind: number;
        created_at: number;
        tags: string[][];
        content: string;
      }): Promise<NostrEvent>;
    };
  }
}

const RELAY_URL = 'wss://relay.damus.io/';

type MessageCallback = (event: NostrEvent) => void;

/**
 * Nostr client for managing connections, subscriptions, and event publishing
 */
export class NostrClient {
  private rxNostr: ReturnType<typeof createRxNostr>;
  private sk: Uint8Array | null = null;
  private npub = '';
  private onMessageCallbacks: MessageCallback[] = [];

  constructor() {
    this.rxNostr = createRxNostr({
      verifier
    });
  }

  /**
   * Initialize the Nostr client with key management
   * Generates a new key pair or loads from localStorage
   */
  async init(): Promise<void> {
    // Load or generate secret key
    const storedSk = localStorage.getItem('nostr_sk');
    if (storedSk) {
      this.sk = new Uint8Array(JSON.parse(storedSk));
    } else if (window.nostr) {
      // NIP-07 support
      const pk = await window.nostr.getPublicKey();
      this.npub = nip19.npubEncode(pk);
      return;
    } else {
      // Generate new key
      this.sk = generateSecretKey();
      localStorage.setItem('nostr_sk', JSON.stringify(Array.from(this.sk)));
    }

    const pk = getPublicKey(this.sk);
    this.npub = nip19.npubEncode(pk);

    // Connect to relay
    this.rxNostr.setDefaultRelays([RELAY_URL]);
  }

  /**
   * Subscribe to relevant Nostr events
   */
  subscribe(): void {
    const pk = this.sk ? getPublicKey(this.sk) : null;
    if (!pk && !window.nostr) return;

    const req = createRxForwardReq();
    const observable = this.rxNostr.use(req).pipe(uniq());

    observable.subscribe({
      next: (packet) => {
        this.onMessageCallbacks.forEach(cb => cb(packet.event));
      },
      error: (error) => {
        console.error('Subscription error:', error);
      }
    });

    req.emit([
      {
        kinds: [30102, 30104],
        '#p': [pk ?? '']
      }
    ]);
  }

  /**
   * Register a callback for incoming messages
   */
  onMessage(callback: MessageCallback): void {
    this.onMessageCallbacks.push(callback);
  }

  /**
   * Send AI instruction event to Nostr relay
   */
  async sendInstruction(
    repo: string,
    branch: string,
    instruction: string,
    requestId: string
  ): Promise<void> {
    const event = {
      kind: 30101,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['repo', repo],
        ['branch', branch],
        ['request_id', requestId]
      ],
      content: instruction
    };

    const signedEvent = await this.signEvent(event);
    await this.rxNostr.send(signedEvent);
  }

  /**
   * Send answer to AI question
   */
  async sendAnswer(
    repo: string,
    branch: string,
    requestId: string,
    questionEventId: string,
    answer: string
  ): Promise<void> {
    const event = {
      kind: 30103,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['repo', repo],
        ['branch', branch],
        ['request_id', requestId],
        ['e', questionEventId]
      ],
      content: answer
    };

    const signedEvent = await this.signEvent(event);
    await this.rxNostr.send(signedEvent);
  }

  /**
   * Sign a Nostr event using stored key or NIP-07
   */
  private async signEvent(event: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
  }): Promise<NostrEvent> {
    if (window.nostr && !this.sk) {
      return await window.nostr.signEvent(event);
    } else if (this.sk) {
      return finalizeEvent(event, this.sk) as NostrEvent;
    } else {
      throw new Error('No signing method available');
    }
  }

  /**
   * Get the current user's npub
   */
  getNpub(): string {
    return this.npub;
  }
}
