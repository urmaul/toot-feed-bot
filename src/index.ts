'use strict';

import { initSourceClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import loadConfigs from './config';
import generator, { Pleroma, WebSocketInterface } from 'megalodon';
import { Store } from './store';

const configs = loadConfigs();

async function run() {
	const source = initSourceClient(configs.source, null);

	// ----- Matrix bot

	const matrix = await initMatrixBot(configs.matrix, {
		reg: (url: string) => {
			try {
				const urlObject = new URL(url);
				if (urlObject.hostname === configs.source.hostname) {
					const pleromaClient = source.client as Pleroma
					return pleromaClient.generateAuthUrl(
						source.config.clientId,
						source.config.clientSecret,
						{scope: ['read']}
					)
				} else {
					return Promise.resolve(`Currently only https://${configs.source.hostname} is supported`);
				}
			} catch (error) {
				return Promise.resolve('Usage: <pre>!reg &lt;FediverseServerUrl&gt;</pre>');
			}
		},
		auth: (code: string) => {
			return source.client.fetchAccessToken(
				source.config.clientId,
				source.config.clientSecret,
				code
			).then(JSON.stringify)
		}
	});

	let subscription: Subscription = configs.subscription;

	const store = new Store(configs.store);

	if (subscription.accessToken) {
		const subscriptionCient = initSourceClient(configs.source, subscription.accessToken);

		// const response = await subscriptionCient.client.getStatus('ARdDMjgx0bADtilSam')
		// logger.debug(response.data)
		// await matrix.sendStatus(subscription.roomId, response.data);

		const handleStatuses = async (statuses: Entity.Status[]) => {
			let newMaxStatusId: string | undefined = undefined;
			try {
				for (const status of statuses) {
					const shouldSkip = 
						(status.in_reply_to_account_id && status.in_reply_to_account_id !== status.account.id);
						// || !status.reblog?.in_reply_to_id
						// || status.reblog
					
					if (!shouldSkip) {
						await matrix.sendStatus(subscription.roomId, status);
					} else {
						logger.debug(`Skipping ${status.content}`);
					}

					if (newMaxStatusId === undefined || status.id > newMaxStatusId) {
						newMaxStatusId = status.id;
					}
				}					
			} catch (error) {
				logger.error('Status Sending error', error);
			}

			if (newMaxStatusId !== undefined) {
				await store.setMaxStatusId(subscription.roomId, newMaxStatusId);
			}
		}

		const reload = async () => {
			const since_id = await store.getMaxStatusId(subscription.roomId);

			const response = await subscriptionCient.client.getHomeTimeline({
				limit: configs.app.statusLimit,
				since_id,
			})

			logger.debug(`${subscription.roomId}: Loaded ${response.data.length} statuses`);

			await handleStatuses(response.data);
		};

		const streamingClient = generator(configs.source.sns, `wss://${configs.source.hostname}`, subscription.accessToken);
		const stream: WebSocketInterface = streamingClient.userSocket()

		stream.on('connect', () => logger.debug(`Stream connected on ${subscription.roomId.value}`));
		stream.on('update', (status: Entity.Status) => handleStatuses([status]));
		stream.on('notification', (notification: Entity.Notification) => logger.debug(notification));
		stream.on('error', (err: Error) => logger.error(`Stream error on ${subscription.roomId.value}`, err));
		stream.on('heartbeat', () => logger.debug('heartbeat'));
		stream.on('close', () => logger.warn('Stream closed'));
		stream.on('parser-error', (err: Error) => logger.error(`Stream parser error on ${subscription.roomId.value}`, err));

		await reload();
	}
}

run();
