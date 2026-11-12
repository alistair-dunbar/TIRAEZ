// Channel interfaces. v0 only has the web form; WhatsApp, Gmail and portal
// webhooks will implement these later without touching respond.ts.

export type ChannelName = "web" | "email" | "whatsapp" | "portal";

/** A raw enquiry as received from any channel, before parsing. */
export interface InboundEnquiry {
  channel: ChannelName;
  receivedAt: Date;
  rawText: string;
  /** Channel-specific id (email Message-ID, WhatsApp message id, ...) for threading replies. */
  externalId?: string;
  /** Where to send the reply, if the channel knows (email address, WhatsApp number). */
  replyTo?: string;
}

/** Sends the AI reply back to the buyer on the channel the enquiry came from. */
export interface OutboundChannel {
  readonly name: ChannelName;
  send(to: string, body: string, opts?: { inReplyTo?: string }): Promise<{ delivered: boolean; id?: string }>;
}
