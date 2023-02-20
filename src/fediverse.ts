import generator, { detector, Mastodon, MegalodonInterface, Pleroma, WebSocketInterface } from 'megalodon';
import { InstanceRef, SNS } from './types';

export interface FediverseConfig {
    ref: InstanceRef;
    clientId: string;
    clientSecret: string;
}

export interface SourceClient<Client extends MegalodonInterface> {
    client: Client;
    config: FediverseConfig;
}

export function initFediverseClient(config: FediverseConfig): SourceClient<MegalodonInterface> {
	const client = generator(config.ref.sns, `https://${config.ref.hostname}`);
	return { client, config };
}

export function isMastodon(client: SourceClient<MegalodonInterface>): client is SourceClient<Mastodon> {
    return client.config.ref.sns == "mastodon";
}

export function isPleroma(client: SourceClient<MegalodonInterface>): client is SourceClient<Pleroma> {
    return client.config.ref.sns == "pleroma";
}

export function initSubscriptionClient(config: InstanceRef, accessToken: string): MegalodonInterface {
	return generator(config.sns, `https://${config.hostname}`, accessToken);
}

export function initStreamingClient(config: InstanceRef, accessToken: string): WebSocketInterface {
    const streamingClient = generator(config.sns, `wss://${config.hostname}`, accessToken);
    return streamingClient.userSocket();
}

export async function detectSNS(hostname: string): Promise<SNS> {
    try {
        return detector(`https://${hostname}`);
    } catch (error) {
        // Fallback to mastodon as the most supported API
        return Promise.resolve('mastodon');
    }
}