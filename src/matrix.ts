import {
	MatrixClient,
	SimpleFsStorageProvider,
	AutojoinRoomsMixin,
	RichReply,
	RustSdkCryptoStorageProvider,
} from 'matrix-bot-sdk';
import { logger } from './logger';


export interface MatrixConfig {
    serverUrl: string;
    // see https://t2bot.io/docs/access_tokens
    accessToken: string;
    fsStoragePath: string;
    cryptoStorageDir: string;
}

export interface MatrixController {
    reg: (url: string) => Promise<string>;
    auth: (code: string) => Promise<string>;
}

export async function initMatrixBot(config: MatrixConfig, controller: MatrixController): Promise<MatrixClient> {
	// We'll want to make sure the bot doesn't have to do an initial sync every
	// time it restarts, so we need to prepare a storage provider. Here we use
	// a simple JSON database.
	const storage = new SimpleFsStorageProvider(config.fsStoragePath);
	const crypto = new RustSdkCryptoStorageProvider(config.cryptoStorageDir);

	// Now we can create the client and set it up to automatically join rooms.
	const matrix = new MatrixClient(config.serverUrl, config.accessToken, storage, crypto);
	AutojoinRoomsMixin.setupOnClient(matrix);

	// We also want to make sure we can receive events - this is where we will
	// handle our command.
	matrix.on('room.message', handleCommand);

	const botUserId = await matrix.getUserId();

	async function handleCommand(roomId, event) {
		logger.debug(`${roomId} ${JSON.stringify(event)}`)

		// Don't handle events that don't have contents (they were probably redacted)
		if (!event['content']) return;

		// Don't handle non-text events
		if (event['content']['msgtype'] !== 'm.text') return;

		// Filter out events sent by the bot itself.
		if (event['sender'] === botUserId) return;

		// Make sure that the event looks like a command we're expecting
		const body = event['content']['body'];
		if (!body) return;

		if (body.startsWith('!reg')) {
			const url = body.replace(/!reg +/, '')
			const replyBody = await controller.reg(url);
			logger.debug(`Replying with ${replyBody}`);
			const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
			reply['msgtype'] = 'm.notice';
			matrix.sendMessage(roomId, reply);
			return;
		}

		if (body.startsWith('!auth')) {
			const code = body.replace(/!auth +/, '')
			const replyBody = await controller.auth(code);
			logger.debug(`Replying with ${replyBody}`);
			const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
			reply['msgtype'] = 'm.notice';
			matrix.sendMessage(roomId, reply);
			return;
		}
	}

	// Now that the client is all set up and the event handler is registered, start the
	// client up. This will start it syncing.
	await matrix.start().then(() => logger.info('Matrix client started!'));

	return matrix;
}
