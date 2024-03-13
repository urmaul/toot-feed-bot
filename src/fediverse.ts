import generator, { detector, Mastodon, MegalodonInterface, OAuth, Pleroma } from 'megalodon';
import { InstanceRef, SNS } from './types';
import { extractFromError } from './error';
import { logger } from './logger';

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

export async function detectSNS(hostname: string): Promise<SNS> {
    return detector(`https://${hostname}`)
        .catch(error => {
            logger.debug(`Failed detecting SNS for ${hostname}: ${error}`);
            // Fallback to mastodon as the most supported API
            return 'mastodon';
        });
}

export async function createFediverseApp(url: URL, botAppName: string): Promise<FediverseConfig> {
    logger.debug(`Creating fediverse app for ${url.hostname}...`);
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
