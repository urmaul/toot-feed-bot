import {
	MatrixClient,
	SimpleFsStorageProvider,
	AutojoinRoomsMixin,
	RichReply,
	RustSdkCryptoStorageProvider,
} from 'matrix-bot-sdk';
import { logger } from './logger';
import { renderNotification, renderStatus } from './render';
import { newRoomId, RoomId } from './types';


export interface MatrixConfig {
    serverUrl: string;
    // see https://t2bot.io/docs/access_tokens
    accessToken: string;
    fsStoragePath: string;
    cryptoStorageDir: string;
}

type CommandHandler = (body: string, roomId: RoomId) => Promise<string | undefined>
type EventHandler = (roomId: RoomId) => Promise<string | undefined>

export class MatrixBot {
	readonly client: MatrixClient;
	commandHandlers: Map<string, CommandHandler>;

	constructor(client: MatrixClient) {
		this.client = client;
		this.commandHandlers = new Map();

		this.client.on('room.message', this.handleCommand.bind(this));
	}

	/** Handles retryAfterMs error thrown within `f`. */
	private async tryBackedOff(f: () => Promise<any>): Promise<void> {
		try {
			await f();
		} catch (error) {
			const retryAfterMs = (error as any).retryAfterMs;
			if (retryAfterMs) {
				// If error tells us to retry => wait and retry
				logger.debug(`Matrix backoff error. Waiting to retry after ${retryAfterMs}ms`);
				await this.sleep(retryAfterMs);
				await f();
			} else {
				throw error;
			}
		}
	}

	async sendStatus(roomId: RoomId, status: Entity.Status): Promise<void> {
		const message = renderStatus(status);
		return this.tryBackedOff(() => this.client.sendHtmlText(roomId.value, message));
	}

	async sendNotification(roomId: RoomId, notification: Entity.Notification): Promise<void> {
		const message = renderNotification(notification);
		if (message) {
			await this.tryBackedOff(() => this.client.sendHtmlText(roomId.value, message));
		}
	}

	private async sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private async handleCommand(roomId, event) {
		// Don't handle events that don't have contents (they were probably redacted)
		if (!event['content']) return;

		// Don't handle non-text events
		if (event['content']['msgtype'] !== 'm.text') return;

		// Filter out events sent by the bot itself.
		if (event['sender'] === await this.client.getUserId()) return;

		// Make sure that the event looks like a command we're expecting
		const body = event['content']['body'];
		if (!body) return;

		const matches = body.match(/^!([a-z]+)\b *(.*)/s);
		if (matches) {
			const commandName = matches[1];
			const commandBody = matches[2];
			const handler = this.commandHandlers.get(commandName);
			
			if (handler) {
				const replyBody = await handler(commandBody, newRoomId(roomId));
				if (replyBody) {
					const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
					reply['msgtype'] = 'm.notice';

					await this.tryBackedOff(() => this.client.sendMessage(roomId, reply));
				}
	
			} else {
				logger.debug(`Received unknown command ${commandName}`);
			}

		}
	}

	onCommand(command: string, handler: CommandHandler): void {
		this.commandHandlers.set(command, handler);
	}

	onEvent(event: string, handler: EventHandler): void {
		this.client.on(event, async (roomId: string, body: any) => {
			const message = await handler(newRoomId(roomId));
			if (message) {
				this.client.sendHtmlText(roomId, message);
			}
		});
	}
}

export async function initMatrixBot(config: MatrixConfig): Promise<MatrixBot> {
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

	return new MatrixBot(matrix);
}
