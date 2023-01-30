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
	let configSubscriptions: Subscription[] = [];
	if (configs.subscription.accessToken) {
		configSubscriptions.push({
			roomId: configs.subscription.roomId,
			accessToken: configs.subscription.accessToken
		});
	}

	const store = new Store(configs.store, configSubscriptions);

	// ----- Matrix bot

	const matrix = await initMatrixBot(configs.matrix);

	matrix.onCommand('reg', (url: string) => {
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
	});

	matrix.onCommand('auth', async (code: string) => {
		const source = initSourceClient(configs.source);
		try {
			const accessToken = await source.client.fetchAccessToken(
				source.config.clientId,
				source.config.clientSecret,
				code
			);
			return JSON.stringify(accessToken);
		} catch (error) {
			const responseError = (error as any).response.data.error;
			return responseError ? `${responseError}` : `${error}`;
		}
	});

	matrix.onCommand('retrieve', async (statusId: string, roomId: RoomId) => {
		const subscription = await store.getSubscription(roomId);

		if (subscription) {
			try {
				const source = initSubscriptionClient(configs.source.ref, subscription.accessToken);
				const response = await source.getStatus(statusId)
				logger.debug('Retrieved status', response.data)
				await matrix.sendStatus(roomId, response.data);

				return undefined;

			} catch (error) {
				const responseError = (error as any).response.data.error;
				return responseError ? `${responseError}` : `${error}`;
			}

		} else {
			return 'Error: you need to log in first';
		}
	});

	let ongoing: Map<RoomId, WebSocketInterface> = new Map();

	const reinit = async () => {
		const subscriptions = await store.getAllSubscriptions();

		for (const subscription of subscriptions) {
			if (ongoing.has(subscription.roomId)) {
				break;
			}
			logger.debug(`Starting subscription for ${subscription.roomId.value}`);

			const subscriptionCient = initSubscriptionClient(configs.source.ref, subscription.accessToken);


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

			const reloadStatuses = async () => {
				const since_id = await store.getMaxStatusId(subscription.roomId);

				const response = await subscriptionCient.getHomeTimeline({
					limit: configs.app.statusLimit,
					since_id,
				})

				logger.debug(`${subscription.roomId.value}: Loaded ${response.data.length} statuses`);

				await handleStatuses(response.data);
			};

			const handleNotifications = async (notifications: Entity.Notification[]) => {
				let newMaxNotificationId: string | undefined = undefined;
				try {
					for (const notification of notifications) {
						await matrix.sendNotification(subscription.roomId, notification);

						if (newMaxNotificationId === undefined || notification.id > newMaxNotificationId) {
							newMaxNotificationId = notification.id;
						}
					}
				} catch (error) {
					logger.error('Notification sending error', error);
				}

				if (newMaxNotificationId !== undefined) {
					await store.setMaxNotificationId(subscription.roomId, newMaxNotificationId);
				}
			}

			const reloadNotifications = async () => {
				const since_id = await store.getMaxNotificationId(subscription.roomId);
				const response = await subscriptionCient.getNotifications({ since_id });

				logger.debug(`${subscription.roomId.value}: Loaded ${response.data.length} notifications`);

				await handleNotifications(response.data);
			};

			const stream = initStreamingClient(configs.source.ref, subscription.accessToken);
			ongoing.set(subscription.roomId, stream);

			stream.on('connect', () => logger.debug(`Stream connected on ${subscription.roomId.value}`));
			stream.on('update', (status: Entity.Status) => handleStatuses([status]));
			stream.on('notification', (notification: Entity.Notification) => handleNotifications([notification]));
			stream.on('error', (err: Error) => logger.error(`Stream error on ${subscription.roomId.value}`, err));
			stream.on('heartbeat', () => logger.debug(`Heartbeat on ${subscription.roomId.value}`));
			stream.on('close', () => {
				logger.info(`Stream closed on ${subscription.roomId.value}`)
				ongoing.delete(subscription.roomId);
			});
			stream.on('parser-error', (err: Error) => logger.warn(`Stream parser error on ${subscription.roomId.value}`, err));

			await reloadStatuses();
			await reloadNotifications();
		}
	}

	await reinit();
	setInterval(reinit, configs.app.interval * 1000);
}

run();
