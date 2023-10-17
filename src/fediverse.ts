import generator, { detector, Mastodon, MegalodonInterface, OAuth, Pleroma, WebSocketInterface } from 'megalodon';
import { InstanceRef, SNS } from './types';
import { extractFromError } from './error';

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
    return client.config.ref.sns == 'mastodon';
}

export function isPleroma(client: SourceClient<MegalodonInterface>): client is SourceClient<Pleroma> {
    return client.config.ref.sns == 'pleroma';
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

export async function createFediverseApp(url: URL, botAppName: string): Promise<FediverseConfig> {
    const sns = await detectSNS(url.hostname);
    const regClient = generator(sns, `https://${url.hostname}`);
    const appData: OAuth.AppData = await regClient.createApp(botAppName, {
        scopes: ['read'],
        redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
    });
    return {
        ref: { sns, hostname: url.hostname },
        clientId: appData.client_id,
        clientSecret: appData.client_secret
    };
}

// Check if the error is an error response from the server.
// If yes, return this error.
export function extractResponseError(error: unknown): string|undefined {
    const inner = extractFromError(error, 'response', 'data', 'error');
    return inner !== undefined ? `${inner}` : undefined;
}
