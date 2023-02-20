'use strict';

import { initFediverseClient, initStreamingClient, initSubscriptionClient, isPleroma } from './fediverse';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import loadConfigs from './config';
import { Pleroma, WebSocketInterface } from 'megalodon';
import { Store } from './store';
import { InstanceRef, RoomId } from './types';

const configs = loadConfigs();

async function run() {
	const supportedInstance: InstanceRef = configs.fediverse.ref;
	const store = new Store(configs.store);
	let ongoing: Map<string, WebSocketInterface> = new Map();

	// Save FediverseConfig from configuration
	store.fediverseConfigs.add(configs.fediverse);

	// ----- Matrix bot

	const matrix = await initMatrixBot(configs.matrix);

	matrix.onCommand('reg', async (url: string, roomId: RoomId) => {
		try {
			const urlObject = new URL(url);
			const fediverseConfig = await store.fediverseConfigs.get(urlObject.hostname);
			if (fediverseConfig == undefined) {
				return `Error: Currently only https://${supportedInstance.hostname} is supported`;
			}

			const fediverse = initFediverseClient(fediverseConfig);

			if (isPleroma(fediverse)) {
				const authUrl = await fediverse.client.generateAuthUrl(
					fediverse.config.clientId,
					fediverse.config.clientSecret,
					{ scope: ['read'] }
				);
	
				store.addOngoingRegistration({
					roomId,
					instanceRef: fediverseConfig.ref,
				});
	
				return `Login url: ${authUrl}<br>` +
					'Please copy the authorization token you get after logging in ' +
					'and run command: <pre>!auth &lt;token&gt;</pre>';
			}

			// Should never happen
			logger.error(`Trying to create a login url for unsupported SNS ${fediverse.config.ref.sns} of ${fediverse.config.ref.hostname}`);
			return `Error: Engine ${fediverse.config.ref.sns} of ${fediverse.config.ref.hostname} not supported.`;

		} catch (error) {
			return 'Usage: <pre>!reg &lt;FediverseServerUrl&gt;</pre>';
		}
	});

	matrix.onCommand('auth', async (code: string, roomId: RoomId) => {
		const ongoingRegistration = await store.getOngoingRegistration(roomId);
		if (ongoingRegistration == undefined) {
			return Promise.resolve('First start the authorization with <pre>!reg &lt;FediverseServerUrl&gt;</pre>');
		}
		const instanceRef = ongoingRegistration.instanceRef;
		const fediverseConfig = await store.fediverseConfigs.get(instanceRef.hostname);
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
			await store.deleteOngoingRegistration(roomId);

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
		const subscription = await store.getSubscription(roomId);

		await store.deleteSubscription(roomId);
		logger.info('Deleted subscription');

		let ongoingStream = ongoing.get(roomId.value);
		if (ongoingStream) {
			ongoingStream.stop();
			ongoingStream.removeAllListeners();
			ongoing.delete(roomId.value);
		}

		// Try to revoke access token
		if (subscription !== undefined) {
			const fediverseConfig = await store.fediverseConfigs.get(subscription.instanceRef.hostname);
			if (fediverseConfig !== undefined) {
				try {
					const subscriptionCient = initSubscriptionClient(subscription.instanceRef, subscription.accessToken);
					subscriptionCient.revokeToken(fediverseConfig.clientId, fediverseConfig.clientSecret, subscription.accessToken);
				} catch (error) {
					logger.warn(`Error while revoking a token`, error)
				}
			}
		}

		return 'Subscription stopped. All data deleted.';
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
					await store.maxStatusIds.set(subscription.roomId, newMaxStatusId);
				}
			}

			const reloadStatuses = async () => {
				const since_id = await store.maxStatusIds.get(subscription.roomId);
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
					await store.maxNotificationIds.set(subscription.roomId, newMaxNotificationId);
				}
			}

			const reloadNotifications = async () => {
				const since_id = await store.maxNotificationIds.get(subscription.roomId);
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
