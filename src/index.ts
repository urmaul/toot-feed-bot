'use strict';

import { initFediverseClient, initStreamingClient, initSubscriptionClient } from './fediverse';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import loadConfigs from './config';
import { Pleroma, WebSocketInterface } from 'megalodon';
import { Store } from './store';
import { InstanceRef, RoomId } from './types';

const configs = loadConfigs();

async function run() {
	const supportedInstance: InstanceRef = configs.fediverse.ref;
	const store = new Store(configs.store, configs.fediverse);
	let ongoing: Map<string, WebSocketInterface> = new Map();

	// ----- Matrix bot

	const matrix = await initMatrixBot(configs.matrix);

	matrix.onCommand('reg', async (url: string) => {
		try {
			const urlObject = new URL(url);
			const fediverseConfig = await store.getFediverseConfig(urlObject.hostname);
			if (fediverseConfig) {
				const fediverse = initFediverseClient(fediverseConfig);
				const pleromaClient = fediverse.client as Pleroma
				const authUrl = await pleromaClient.generateAuthUrl(
					fediverse.config.clientId,
					fediverse.config.clientSecret,
					{ scope: ['read'] }
				);
				return `Login url: ${authUrl}<br>` +
					'Please copy the authorization token you get after logging in ' +
					'and run command: <pre>!auth &lt;token&gt;</pre>';
			} else {
				return Promise.resolve(`Currently only https://${supportedInstance.hostname} is supported`);
			}
		} catch (error) {
			return Promise.resolve('Usage: <pre>!reg &lt;FediverseServerUrl&gt;</pre>');
		}
	});

	matrix.onCommand('auth', async (code: string, roomId: RoomId) => {
		const instanceRef = supportedInstance;
		const fediverseConfig = await store.getFediverseConfig(instanceRef.hostname);
		if (fediverseConfig == undefined) {
			return Promise.resolve('First start the authorization with <pre>!reg &lt;FediverseServerUrl&gt;</pre>');
		}
		const fediverse = initFediverseClient(fediverseConfig);
		try {
			const tokenData = await fediverse.client.fetchAccessToken(
				fediverse.config.clientId,
				fediverse.config.clientSecret,
				code
			);
			await store.addSubscription({
				roomId,
				instanceRef,
				accessToken: tokenData.access_token
			});
			return "Subscription created succesfully";

		} catch (error) {
			const responseError = (error as any).response.data.error;
			return responseError ? `${responseError}` : `${error}`;
		}
	});

	matrix.onCommand('retrieve', async (statusId: string, roomId: RoomId) => {
		const subscription = await store.getSubscription(roomId);

		if (subscription) {
			try {
				const fediverse = initSubscriptionClient(subscription.instanceRef, subscription.accessToken);
				const response = await fediverse.getStatus(statusId)
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

	matrix.onCommand('stop', async (_: string, roomId: RoomId) => {
		await store.deleteSubscription(roomId);
		logger.info('Deleted subscripion');

		let ongoingStream = ongoing.get(roomId.value);
		if (ongoingStream) {
			ongoingStream.stop();
			ongoingStream.removeAllListeners();
			ongoing.delete(roomId.value);
		}

		return 'Subscripton stopped. All data deleted.';
	});

	// ----- Subscriptions

	const reinit = async () => {
		const subscriptions = await store.getAllSubscriptions();

		for (const subscription of subscriptions) {
			if (ongoing.has(subscription.roomId.value)) {
				continue;
			}
			logger.debug(`Starting subscription for ${subscription.roomId.value}`);

			const subscriptionCient = initSubscriptionClient(subscription.instanceRef, subscription.accessToken);


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
				const response = await subscriptionCient.getHomeTimeline({ since_id });

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

			const stream = initStreamingClient(subscription.instanceRef, subscription.accessToken);
			ongoing.set(subscription.roomId.value, stream);

			stream.on('connect', () => logger.debug(`Stream connected on ${subscription.roomId.value}`));
			stream.on('update', (status: Entity.Status) => handleStatuses([status]));
			stream.on('notification', (notification: Entity.Notification) => handleNotifications([notification]));
			stream.on('error', (err: Error) => logger.error(`Stream error on ${subscription.roomId.value}`, err));
			stream.on('heartbeat', () => logger.debug(`Heartbeat on ${subscription.roomId.value}`));
			stream.on('close', () => {
				logger.info(`Stream closed on ${subscription.roomId.value}`)
				ongoing.delete(subscription.roomId.value);
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
