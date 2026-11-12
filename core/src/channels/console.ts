import type { ChannelName, OutboundChannel } from "./types.ts";

/**
 * Stub outbound channel: logs instead of sending. Replace with a Gmail or
 * WhatsApp Business implementation of OutboundChannel later.
 */
export class ConsoleOutbound implements OutboundChannel {
  constructor(readonly name: ChannelName = "web") {}

  async send(to: string, body: string): Promise<{ delivered: boolean; id?: string }> {
    console.log(`[stub ${this.name}] would send to ${to || "(no address)"}: ${body.slice(0, 80)}...`);
    return { delivered: false };
  }
}
