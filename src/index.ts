import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { PoeTokens } from './typed';
import { MessageChunk, WebSocketMessage } from './typed';


export class PoeApi extends EventEmitter {
  private client: AxiosInstance;
  private ws?: WebSocket;
  private wsConnected: boolean = false;
  private wsConnecting: boolean = false;
  private activeMessages: Map<number, string> = new Map();
  private messageQueues: Map<number, MessageChunk[]> = new Map();
  private baseUrl: string = 'https://poe.com';
  private formkey: string = '';
  private proxy?: Record<string, string>[];
  private autoProxy: boolean;

  constructor(config: {
    tokens: PoeTokens,
    autoProxy?: boolean,
    proxy?: Record<string, string>[]
  }) {
    super();
    const { tokens, autoProxy = false, proxy } = config;

    this.autoProxy = autoProxy;
    this.proxy = proxy;

    // Initialize axios client
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Set cookies
    this.client.defaults.headers.common['Cookie'] =
      `p-b=${tokens['p-b']}; p-lat=${tokens['p-lat']}`;

    if (tokens.formkey) {
      this.formkey = tokens.formkey;
      this.client.defaults.headers.common['Poe-Formkey'] = tokens.formkey;
    }

    if (tokens.__cf_bm && tokens.cf_clearance) {
      this.client.defaults.headers.common['Cookie'] +=
        `; __cf_bm=${tokens.__cf_bm}; cf_clearance=${tokens.cf_clearance}`;
    }
  }

  private async getChannelSettings() {
    const response = await this.client.get('/api/settings');
    const data = response.data;

    const wsDomain = `tch${Math.floor(Math.random() * 1000000)}`.slice(0, 11);
    const tchannelData = data.tchannelData;

    this.client.defaults.headers.common['Poe-Tchannel'] = tchannelData.channel;

    return {
      url: `ws://${wsDomain}.tch.${tchannelData.baseHost}/up/${tchannelData.boxName}/updates`,
      minSeq: tchannelData.minSeq,
      channel: tchannelData.channel,
      channelHash: tchannelData.channelHash
    };
  }

  private async connectWebSocket() {
    if (this.wsConnected || this.wsConnecting) return;

    this.wsConnecting = true;

    try {
      const settings = await this.getChannelSettings();

      const wsUrl = `${settings.url}?min_seq=${settings.minSeq}&channel=${settings.channel}&hash=${settings.channelHash}`;

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Origin': this.baseUrl
        }
      });

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.wsConnecting = false;
        this.emit('ws_connect');
      });

      this.ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data) as WebSocketMessage;
          this.handleWebSocketMessage(message);
        } catch (err) {
          console.error('Failed to parse websocket message:', err);
        }
      });

      this.ws.on('close', () => {
        this.wsConnected = false;
        this.wsConnecting = false;
        this.emit('ws_close');
      });

      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        this.emit('ws_error', err);
      });

    } catch (err) {
      this.wsConnecting = false;
      throw err;
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage) {
    for (const msg of message.messages) {
      try {
        const data = JSON.parse(msg);

        if (data.message_type === 'subscriptionUpdate') {
          const payload = data.payload;
          const chatId = parseInt(payload.unique_id.split(':')[1]);

          if (chatId && this.messageQueues.has(chatId)) {
            const queue = this.messageQueues.get(chatId)!;
            queue.push(payload.data.messageAdded);
            this.emit('message', payload.data.messageAdded);
          }
        }
      } catch (err) {
        console.error('Failed to handle websocket message:', err);
      }
    }
  }

  public async sendMessage(bot: string, message: string, options: {
    chatId?: number;
    chatCode?: string;
    suggest_replies?: boolean;
    file_path?: string[];
  } = {}): Promise<AsyncIterableIterator<MessageChunk>> {
    await this.connectWebSocket();

    const messageId = Math.floor(Math.random() * 1000000);
    this.activeMessages.set(messageId, '');
    this.messageQueues.set(messageId, []);

    const variables = {
      bot,
      message,
      chatId: options.chatId,
      chatCode: options.chatCode,
      clientNonce: crypto.randomBytes(16).toString('hex'),
      sdid: '',
      attachments: options.file_path ? options.file_path.map((_, i) => `file${i}`) : []
    };

    const response = await this.client.post('/api/gql_POST', {
      query: 'mutation SendMessage($bot: String!, $message: String!) {...}',
      variables
    });

    if (!response.data.data) {
      throw new Error('Failed to send message');
    }

    const queue = this.messageQueues.get(messageId)!;

    async function* generateChunks(): AsyncIterableIterator<MessageChunk> {
      let lastText = '';

      while (true) {
        if (queue.length > 0) {
          const chunk = queue.shift()!;

          const response = {
            text: chunk.text,
            response: chunk.text?.slice(lastText.length),
            chatCode: chunk.chatCode,
            chatId: chunk.chatId,
            messageId: chunk.messageId,
            state: chunk.state,
            suggestedReplies: chunk.suggestedReplies
          };

          yield response;

          if (chunk.state === 'complete') {
            break;
          }

          lastText = chunk.text || '';
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return generateChunks();
  }

  // Add other methods like purgeConversation, deleteChat, etc.
}