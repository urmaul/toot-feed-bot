import {
	MatrixClient,
	SimpleFsStorageProvider,
	AutojoinRoomsMixin,
	RichReply,
	RustSdkCryptoStorageProvider,
} from 'matrix-bot-sdk';
import { logger } from './logger';
import { renderMessage } from './render';
import { RoomId } from './types';


export interface MatrixConfig {
    serverUrl: string;
    // see https://t2bot.io/docs/access_tokens
    accessToken: string;
    fsStoragePath: string;
    cryptoStorageDir: string;
}

export class MatrixBot {
	readonly client: MatrixClient;
	readonly controller: MatrixController;

	constructor(client: MatrixClient, controller: MatrixController) {
		this.client = client;
		this.controller = controller

		// We also want to make sure we can receive events - this is where we will
		// handle our command.
		this.client.on('room.message', this.handleCommand.bind(this));
	}

	async sendStatus(roomId: RoomId, status: Entity.Status): Promise<void> {
		try {
			const message = renderMessage(status);
			await this.client.sendHtmlText(roomId.value, message);
		} catch (error) {
			const retryAfterMs = (error as any).retryAfterMs;
			if (retryAfterMs) {
				// If error tells us to retry => wait and retry
				logger.debug(`Sending status error. Waiting to retry after ${retryAfterMs}ms`);
				await this.sleep(retryAfterMs);
				return this.sendStatus(roomId, status);
			} else {
				throw error;
			}
		}
	}

	private async sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private async handleCommand(roomId, event) {
		logger.debug(`${roomId} ${JSON.stringify(event)}`)

		// Don't handle events that don't have contents (they were probably redacted)
		if (!event['content']) return;

		// Don't handle non-text events
		if (event['content']['msgtype'] !== 'm.text') return;

		// Filter out events sent by the bot itself.
		if (event['sender'] === await this.client.getUserId()) return;

		// Make sure that the event looks like a command we're expecting
		const body = event['content']['body'];
		if (!body) return;

		if (body.startsWith('!reg')) {
			const url = body.replace(/!reg +/, '')
			const replyBody = await this.controller.reg(url);
			logger.debug(`Replying with ${replyBody}`);
			const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
			reply['msgtype'] = 'm.notice';
			this.client.sendMessage(roomId, reply);
			return;
		}

		if (body.startsWith('!auth')) {
			const code = body.replace(/!auth +/, '')
			const replyBody = await this.controller.auth(code);
			logger.debug(`Replying with ${replyBody}`);
			const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
			reply['msgtype'] = 'm.notice';
			this.client.sendMessage(roomId, reply);
			return;
		}
	}
}

export interface MatrixController {
    reg: (url: string) => Promise<string>;
    auth: (code: string) => Promise<string>;
}

export async function initMatrixBot(config: MatrixConfig, controller: MatrixController): Promise<MatrixBot> {
	// We'll want to make sure the bot doesn't have to do an initial sync every
	// time it restarts, so we need to prepare a storage provider. Here we use
	// a simple JSON database.
	const storage = new SimpleFsStorageProvider(config.fsStoragePath);
	const crypto = new RustSdkCryptoStorageProvider(config.cryptoStorageDir);

	// Now we can create the client and set it up to automatically join rooms.
	const matrix = new MatrixClient(config.serverUrl, config.accessToken, storage, crypto);
	AutojoinRoomsMixin.setupOnClient(matrix);

	// Now that the client is all set up and the event handler is registered, start the
	// client up. This will start it syncing.
	await matrix.start().then(() => logger.info('Matrix client started!'));

	return new MatrixBot(matrix, controller);
}
