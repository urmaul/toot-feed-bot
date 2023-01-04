'use strict';

import { initSourceClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import { renderMessage } from './render';
import loadConfigs from './config';
import Keyv from 'keyv';
import CryptoJS from 'crypto-js';
import { Pleroma } from 'megalodon';

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

	const keyv = new Keyv(configs.store.uri, {
		serialize: (data) => CryptoJS.AES.encrypt(JSON.stringify(data), configs.store.secret).toString(),
		deserialize: (text) => JSON.parse(CryptoJS.AES.decrypt(text, configs.store.secret).toString(CryptoJS.enc.Utf8))
	});
	keyv.on('error', err => logger.error('Connection Error', err));

	if (subscription.accessToken) {
		const subscriptionCient = initSourceClient(configs.source, subscription.accessToken);

		const maxStatusIdKey = `maxStatusId:${subscription.roomId}`;

		const getMaxStatusId = async () => {
			try {
				return await keyv.get(maxStatusIdKey);
			} catch (error) {
				logger.error(error);
				// Fallback to no maxStatusId
				return undefined;
			}
		}

		const reload = async () => {
			const maxStatusId = await getMaxStatusId();

			const response = await subscriptionCient.client.getHomeTimeline({
				limit: configs.app.statusLimit,
				since_id: maxStatusId,
			})

			logger.debug(`${subscription.roomId}: Loaded ${response.data.length} statuses`);

			let newMaxStatusId = maxStatusId;
			try {
				for (const status of response.data) {
					const shouldSkip = status.in_reply_to_id;
						// || !status.reblog?.in_reply_to_id
						// || status.reblog
					
					if (!shouldSkip) {
						await matrix.sendHtmlText(subscription.roomId, renderMessage(status));
					} else {
						logger.debug(`Skipping ${status.content}`);
					}

					if (newMaxStatusId === undefined || status.id > newMaxStatusId) {
						newMaxStatusId = status.id;
					}
				}					
			} catch (error) {
				logger.error(error);
			}

			// Update maxStatusId
			if (newMaxStatusId !== maxStatusId) {
				await keyv.set(maxStatusIdKey, newMaxStatusId);
			}
		};

		await reload();
		setInterval(reload, configs.app.interval * 1000);
	}

}

run();
