import generator, { MegalodonInterface, Pleroma } from 'megalodon';

export interface SourceConfig {
    baseUrl: string;
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

export function initPleromaClient(config: SourceConfig): PleromaClient {
	const client: Pleroma = generator('pleroma', config.baseUrl) as Pleroma;
	return { client, config };
}