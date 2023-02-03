import generator, { MegalodonInterface, WebSocketInterface } from 'megalodon';
import { InstanceRef } from './types';

export interface FediverseConfig {
    ref: InstanceRef;
    clientId: string;
    clientSecret: string;
}

export interface SourceClient {
    client: MegalodonInterface;
    config: FediverseConfig;
}

export function initFediverseClient(config: FediverseConfig): SourceClient {
	const client = generator(config.ref.sns, `https://${config.ref.hostname}`);
	return { client, config };
}

export function initSubscriptionClient(config: InstanceRef, accessToken: string): MegalodonInterface {
	return generator(config.sns, `https://${config.hostname}`, accessToken);
}

export function initStreamingClient(config: InstanceRef, accessToken: string): WebSocketInterface {
    const streamingClient = generator(config.sns, `wss://${config.hostname}`, accessToken);
    return streamingClient.userSocket();
}