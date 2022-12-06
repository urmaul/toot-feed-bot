import {
	MatrixClient,
	SimpleFsStorageProvider,
	AutojoinRoomsMixin,
	RichReply,
} from 'matrix-bot-sdk';
import { logger } from './logger';


export interface MatrixConfig {
    serverUrl: string;
    // see https://t2bot.io/docs/access_tokens
    accessToken: string;
    fsStoragePath: string;
}

export function initMatrixBot(config: MatrixConfig): MatrixClient {
	// We'll want to make sure the bot doesn't have to do an initial sync every
	// time it restarts, so we need to prepare a storage provider. Here we use
	// a simple JSON database.
	// TODO: specify dir better
	const storage = new SimpleFsStorageProvider('./data/matrix-bot.json');
	// const crypto = new RustSdkCryptoStorageProvider('./data/matrix-bot-sled');

	// Now we can create the client and set it up to automatically join rooms.
	const matrix = new MatrixClient(config.serverUrl, config.accessToken, storage);
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

	return matrix;
}
