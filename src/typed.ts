export interface PoeTokens {
  'p-b': string;
  'p-lat': string;
  formkey?: string;
  __cf_bm?: string;
  cf_clearance?: string;
}

export interface MessageChunk {
  text?: string;
  response?: string;
  chatCode?: string;
  chatId?: number;
  messageId?: number;
  state?: string;
  author?: string;
  suggestedReplies?: string[];
}

export interface WebSocketMessage {
  messages: string[];
}