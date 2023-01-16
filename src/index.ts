'use strict';

import { initSourceClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import loadConfigs from './config';
import { Pleroma } from 'megalodon';
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

	let configSubscriptions: Subscription[] = [];
	if (configs.subscription.accessToken) {
		configSubscriptions.push({
			roomId: configs.subscription.roomId,
			accessToken: configs.subscription.accessToken
		});
	}

	const store = new Store(configs.store, configSubscriptions);

	const subscriptions = await store.getAllSubscriptions();

	for (const subscription of subscriptions) {
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
				logger.error('Status sending error', error);
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

		await reload();
		setInterval(reload, configs.app.interval * 1000);
	}

}

run();
