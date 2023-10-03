'use strict';

import { createFediverseApp, initFediverseClient, initStreamingClient, initSubscriptionClient, isMastodon, isPleroma, SourceClient } from './fediverse';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import loadConfigs from './config';
import { MegalodonInterface, WebSocketInterface } from 'megalodon';
import { Store } from './store';
import { RoomId } from './types';
import { Backoff } from './backoff';

const configs = loadConfigs();

async function run() {
    const store = new Store(configs.store);
    const backoff = new Backoff(configs.backoff);
    const ongoing: Map<string, WebSocketInterface> = new Map();

    // ----- Helper functions

    const stopOngoingStream = (roomId: RoomId) => {
        const ongoingStream = ongoing.get(roomId.value);
        if (ongoingStream) {
            ongoingStream.stop();
            ongoingStream.removeAllListeners();
            ongoing.delete(roomId.value);
        }
    };

    const retrieveFediverseClient = async (url: URL): Promise<SourceClient<MegalodonInterface>> => {
        const fediverseConfig = await store.fediverseConfigs.get(url.hostname);
        if (fediverseConfig) {
            return initFediverseClient(fediverseConfig);
        }

        // No fediverse config yet, create it
        const newConfig = await createFediverseApp(url, configs.app.name);
        await store.fediverseConfigs.add(newConfig);
        return initFediverseClient(newConfig);
    }

    const deleteSubscription = async (roomId: RoomId): Promise<void> => {
        const subscription = await store.getSubscription(roomId);

        await store.deleteSubscription(roomId);
        logger.info('Deleted subscription');

        stopOngoingStream(roomId);

        // Try to revoke access token
        if (subscription !== undefined) {
            const fediverseConfig = await store.fediverseConfigs.get(subscription.instanceRef.hostname);
            if (fediverseConfig !== undefined) {
                try {
                    const subscriptionCient = initSubscriptionClient(subscription.instanceRef, subscription.accessToken);
                    subscriptionCient.revokeToken(fediverseConfig.clientId, fediverseConfig.clientSecret, subscription.accessToken);
                } catch (error) {
                    logger.warn('Error while revoking a token', error)
                }
            }
        }
    }

    // ----- Matrix bot

    const matrix = await initMatrixBot(configs.matrix);

    matrix.onEvent('room.join', () => Promise.resolve(`
		<p>Hello! I am ${configs.app.name}. I can forward your Fediverse feed to this room.</p>
		<p>Start by posting a <code>!reg &lt;FediverseServerUrl&gt;</code> message where <code>&lt;FediverseServerUrl&gt;</code> is the URL of your fediverse instance.</p>
		<p>You can delete all your data anytime by posting a <code>!stop</code> message.</p>
	`));

    matrix.onEvent('room.leave', async (roomId: RoomId) => {
        await deleteSubscription(roomId);
        return undefined;
    });

    matrix.onCommand('reg', async (url: string, roomId: RoomId) => {
        try {
            const urlObject = new URL(url);

            try {
                const fediverse = await retrieveFediverseClient(urlObject);

                if (isMastodon(fediverse) || isPleroma(fediverse)) {
                    const authUrl = await fediverse.client.generateAuthUrl(
                        fediverse.config.clientId,
                        fediverse.config.clientSecret,
                        { scope: ['read'] }
                    );
		
                    store.addOngoingRegistration({
                        roomId,
                        instanceRef: fediverse.config.ref,
                    });
		
                    return `Login url: ${authUrl}<br>` +
						'Please copy the authorization token you get after logging in ' +
						'and run command: <pre>!auth &lt;token&gt;</pre>';
                }
	
                // Should never happen
                logger.error(`Trying to create a login url for unsupported SNS ${fediverse.config.ref.sns} of ${fediverse.config.ref.hostname}`);
                return `Error: Engine ${fediverse.config.ref.sns} of ${fediverse.config.ref.hostname} not supported.`;

            } catch (error) {
                return 'Error: Could not connect to the fediverse server';
            }

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

            return 'Subscription created succesfully';

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
        await deleteSubscription(roomId);
        return 'Subscription stopped. All data deleted.';
    });

    // ----- Subscriptions

    const reinit = async () => {
        const subscriptions = await store.getAllSubscriptions();

        for (const subscription of subscriptions) {
            if (ongoing.has(subscription.roomId.value)) {
                continue;
            }
            if (backoff.instanceBlocked(subscription.instanceRef)) {
                logger.debug(`Skipping subscription for ${subscription.roomId.value} because instance blocked`);
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
                try {
                    const since_id = await store.maxStatusIds.get(subscription.roomId);
                    const response = await subscriptionCient.getHomeTimeline({ since_id });

                    logger.debug(`${subscription.roomId.value}: Loaded ${response.data.length} statuses`);

                    await handleStatuses(response.data);
                } catch (error) {
                    logger.error(`${subscription.roomId.value}: Error during reloading statuses:`, (error as any).message ?? error);
                    backoff.blockInstance(subscription.instanceRef);
                }
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
                try {
                    const since_id = await store.maxNotificationIds.get(subscription.roomId);
                    const response = await subscriptionCient.getNotifications({ since_id });

                    logger.debug(`${subscription.roomId.value}: Loaded ${response.data.length} notifications`);

                    await handleNotifications(response.data);
                } catch (error) {
                    logger.error(`${subscription.roomId.value}: Error during reloading notifications:`, (error as any).message ?? error);
                    backoff.blockInstance(subscription.instanceRef);
                }
            };

            const startStreamingClient = () => {
                try {
                    const stream = initStreamingClient(subscription.instanceRef, subscription.accessToken);
                    ongoing.set(subscription.roomId.value, stream);
	
                    stream.on('connect', () => logger.debug(`Stream connected on ${subscription.roomId.value}`));
                    stream.on('update', (status: Entity.Status) => handleStatuses([status]));
                    stream.on('notification', (notification: Entity.Notification) => handleNotifications([notification]));
                    stream.on('error', (err: Error) => {
                        logger.error(`Stream error on ${subscription.roomId.value}`, err);
                        backoff.blockInstance(subscription.instanceRef);
                        stopOngoingStream(subscription.roomId);
                    });
                    stream.on('heartbeat', () => logger.debug(`Heartbeat on ${subscription.roomId.value}`));
                    stream.on('close', () => {
                        logger.info(`Stream closed on ${subscription.roomId.value}`);
                        stopOngoingStream(subscription.roomId);
                    });
                    stream.on('parser-error', (err: Error) => logger.warn(`Stream parser error on ${subscription.roomId.value}`, err.message));
                } catch (error) {
                    logger.error(`${subscription.roomId.value}: Error during streaming client initialization`, (error as any).message ?? error);
                    ongoing.delete(subscription.roomId.value);
                }
            };


            if (!backoff.instanceBlocked(subscription.instanceRef)) {
                await reloadStatuses();
            }
            if (!backoff.instanceBlocked(subscription.instanceRef)) {
                await reloadNotifications();
            }
			// If streaming blocked by config
			const streamingBlocked = configs.app.blockStreamingOn.includes(subscription.instanceRef.sns);
			if (!backoff.instanceBlocked(subscription.instanceRef) && !streamingBlocked) {
				startStreamingClient();
			}
        }
    }

    await reinit();
    setInterval(reinit, configs.app.interval * 1000);
}

run();
