'use strict';

// TODO: Do we need sitka
import { Logger } from 'sitka';
import generator, { Pleroma } from 'megalodon'

// TODO: Delete it
export class Example {
	/* Private Instance Fields */

	private _logger: Logger;

	/* Constructor */

	constructor() {
		this._logger = Logger.getLogger({ name: this.constructor.name });
	}

	/* Public Instance Methods */

	public exampleMethod(param: string): string {
		this._logger.debug('Received: ' + param);
		return param;
	}
}

// TODO: panic on missing env variables
const baseUrl: string = process.env.FEDIVERSE_BASE_URL || ''
const clientId: string = process.env.FEDIVERSE_CLIENT_ID || ''
const clientSecret: string = process.env.FEDIVERSE_CLIENT_SECRET || ''

// TODO: Use app config type
console.log('Got config', {baseUrl, clientId, clientSecret})

// TODO: don't assume client type
const client: Pleroma = generator('pleroma', baseUrl) as Pleroma

client.generateAuthUrl(clientId, clientSecret, {scope: ['read']})
	.then(url => console.log('Got url', url))

// TODO: accept auth code
