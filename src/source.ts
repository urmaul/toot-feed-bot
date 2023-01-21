import generator, { MegalodonInterface, WebSocketInterface } from 'megalodon';
import { SourceRef } from './types';

export interface SourceConfig {
    ref: SourceRef;
    clientId: string;
    clientSecret: string;
}

export interface SourceClient {
    client: MegalodonInterface;
    config: SourceConfig;
}

export function initSourceClient(config: SourceConfig): SourceClient {
	const client = generator(config.ref.sns, `https://${config.ref.hostname}`);
	return { client, config };
}

export function initSubscriptionClient(config: SourceRef, accessToken: string): MegalodonInterface {
	return generator(config.sns, `https://${config.hostname}`, accessToken);
}

export function initStreamingClient(config: SourceRef, accessToken: string): WebSocketInterface {
    const streamingClient = generator(config.sns, `wss://${config.hostname}`, accessToken);
    return streamingClient.userSocket();
}