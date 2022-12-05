'use strict';

// TODO: Do we need sitka
import { Logger } from 'sitka';
import generator, { Pleroma } from 'megalodon'
import {
	MatrixClient,
	SimpleFsStorageProvider,
	AutojoinRoomsMixin,
	RichReply,
} from 'matrix-bot-sdk';

// TODO: use app name
const logger = Logger.getLogger('MyLogger');

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
console.log('Got fediverse config', {baseUrl, clientId, clientSecret})

// TODO: don't assume client type
const client: Pleroma = generator('pleroma', baseUrl) as Pleroma

client.generateAuthUrl(clientId, clientSecret, {scope: ['read']})
	.then(url => console.log('Got url', url))

// TODO: accept auth code

// ----- Matrix bot

// where you would point a client to talk to a homeserver
const homeserverUrl = 'https://matrix.org';

// see https://t2bot.io/docs/access_tokens
const accessToken = process.env.MATRIX_ACCESS_TOKEN || '';

console.log('Got matrix config', {homeserverUrl, accessToken})



// We'll want to make sure the bot doesn't have to do an initial sync every
// time it restarts, so we need to prepare a storage provider. Here we use
// a simple JSON database.
// TODO: specify dir better
const storage = new SimpleFsStorageProvider('./data/matrix-bot.json');
// const crypto = new RustSdkCryptoStorageProvider('./data/matrix-bot-sled');

// Now we can create the client and set it up to automatically join rooms.
const matrix = new MatrixClient(homeserverUrl, accessToken, storage);
AutojoinRoomsMixin.setupOnClient(matrix);

// We also want to make sure we can receive events - this is where we will
// handle our command.
matrix.on('room.message', handleCommand);

// Now that the client is all set up and the event handler is registered, start the
// client up. This will start it syncing.
matrix.start().then(() => console.log('Client started!'));
matrix.dms.update().then(() => console.log('Updated dms'));

// This is our event handler for dealing with the `!hello` command.
async function handleCommand(roomId, event) {
	logger.info(`${roomId} ${JSON.stringify(event)}`)

	// Don't handle events that don't have contents (they were probably redacted)
	if (!event['content']) return;

	// Don't handle non-text events
	if (event['content']['msgtype'] !== 'm.text') return;

	// We never send `m.text` messages so this isn't required, however this is
	// how you would filter out events sent by the bot itself.
	if (event['sender'] === await matrix.getUserId()) return;

	// Make sure that the event looks like a command we're expecting
	const body = event['content']['body'];
	if (!body || !body.startsWith('!hello')) return;

	// If we've reached this point, we can safely execute the command. We'll
	// send a reply to the user's command saying "Hello World!".
	const replyBody = 'Hello World!'; // we don't have any special styling to do.
	const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
	reply['msgtype'] = 'm.notice';
	matrix.sendMessage(roomId, reply);
}

// const roomId = process.env.MATRIX_ROOM_ID || ''
// matrix.sendText(roomId, 'I am a robot');
