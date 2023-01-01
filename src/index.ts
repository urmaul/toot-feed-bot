'use strict';

import { initPleromaClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import { renderMessage } from './render';
import loadConfigs from './config';
import Keyv from 'keyv';
import CryptoJS from 'crypto-js';

const configs = loadConfigs();

async function run() {
	// TODO: don't assume client type
	const source = initPleromaClient(configs.source, null);

	// ----- Matrix bot

	const matrix = await initMatrixBot(configs.matrix, {
		reg: () => {
			return source.client.generateAuthUrl(
				source.config.clientId,
				source.config.clientSecret,
				{scope: ['read']}
			)
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
		const subscriptionCient = initPleromaClient(configs.source, subscription.accessToken);

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
