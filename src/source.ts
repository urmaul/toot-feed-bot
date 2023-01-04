import generator, { MegalodonInterface, Pleroma } from 'megalodon';

export interface SourceConfig {
    hostname: string;
    clientId: string;
    clientSecret: string;
}

export interface SourceClient {
    client: MegalodonInterface;
    config: SourceConfig;
}
export interface PleromaClient extends SourceClient {
    client: Pleroma;
    config: SourceConfig;
}

export function initPleromaClient(config: SourceConfig, accessToken: string | null): PleromaClient {
	const client: Pleroma = generator('pleroma', `https://${config.hostname}`, accessToken) as Pleroma;
	return { client, config };
}