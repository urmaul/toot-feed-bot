'use strict';

import { initSourceClient, initStreamingClient, initSubscriptionClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import loadConfigs from './config';
import { Pleroma, WebSocketInterface } from 'megalodon';
import { Store } from './store';
import { RoomId } from './types';

const configs = loadConfigs();

async function run() {
	// ----- Matrix bot

	const matrix = await initMatrixBot(configs.matrix, {
		reg: (url: string) => {
			try {
				const urlObject = new URL(url);
				if (urlObject.hostname === configs.source.ref.hostname) {
					const source = initSourceClient(configs.source);
					const pleromaClient = source.client as Pleroma
					return pleromaClient.generateAuthUrl(
						source.config.clientId,
						source.config.clientSecret,
						{scope: ['read']}
					)
				} else {
					return Promise.resolve(`Currently only https://${configs.source.ref.hostname} is supported`);
				}
			} catch (error) {
				return Promise.resolve('Usage: <pre>!reg &lt;FediverseServerUrl&gt;</pre>');
			}
		},
		auth: (code: string) => {
			const source = initSourceClient(configs.source);
			return source.client.fetchAccessToken(
				source.config.clientId,
				source.config.clientSecret,
				code
			).then(JSON.stringify)
		}
	});

	let configSubscriptions: Subscription[] = [];
	if (configs.subscription.accessToken) {
		configSubscriptions.push({
			roomId: configs.subscription.roomId,
			accessToken: configs.subscription.accessToken
		});
	}

	const store = new Store(configs.store, configSubscriptions);

	let ongoing: Map<RoomId, WebSocketInterface> = new Map();

	const reinit = async () => {
		const subscriptions = await store.getAllSubscriptions();

		for (const subscription of subscriptions) {
			if (ongoing.has(subscription.roomId)) {
				break;
			}
			logger.debug(`Starting subscription for ${subscription.roomId.value}`);

			const subscriptionCient = initSubscriptionClient(configs.source.ref, subscription.accessToken);

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
					logger.error('Status sending error', error);
				}

				if (newMaxStatusId !== undefined) {
					await store.setMaxStatusId(subscription.roomId, newMaxStatusId);
				}
			}

			const reload = async () => {
				const since_id = await store.getMaxStatusId(subscription.roomId);

				const response = await subscriptionCient.getHomeTimeline({
					limit: configs.app.statusLimit,
					since_id,
				})

				logger.debug(`${subscription.roomId}: Loaded ${response.data.length} statuses`);

				await handleStatuses(response.data);
			};

			const stream = initStreamingClient(configs.source.ref, subscription.accessToken);
			ongoing.set(subscription.roomId, stream);

			stream.on('connect', () => logger.debug(`Stream connected on ${subscription.roomId.value}`));
			stream.on('update', (status: Entity.Status) => handleStatuses([status]));
			stream.on('notification', (notification: Entity.Notification) => {
				// TODO: forward notifications
				logger.debug('Got notification', notification)
			});
			stream.on('error', (err: Error) => logger.error(`Stream error on ${subscription.roomId.value}`, err));
			stream.on('heartbeat', () => logger.debug(`Heartbeat on ${subscription.roomId.value}`));
			stream.on('close', () => {
				logger.info(`Stream closed on ${subscription.roomId.value}`)
				ongoing.delete(subscription.roomId);
			});
			stream.on('parser-error', (err: Error) => logger.warn(`Stream parser error on ${subscription.roomId.value}`, err));

			await reload();
			// TODO: reload notifications
		}
	}

	await reinit();
	setInterval(reinit, configs.app.interval * 1000);
}

run();
