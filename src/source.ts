import generator, { MegalodonInterface, Pleroma } from 'megalodon';

export interface SourceConfig {
    sns: 'pleroma';
    hostname: string;
    clientId: string;
    clientSecret: string;
}

export interface SourceClient {
    client: MegalodonInterface;
    config: SourceConfig;
}
export function initSourceClient(config: SourceConfig, accessToken: string | null): SourceClient {
	const client = generator(config.sns, `https://${config.hostname}`, accessToken);
	return { client, config };
}