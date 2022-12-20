'use strict';

import { initPleromaClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import { renderMessage } from './render';
import loadConfigs from './config';
import Keyv from 'keyv';

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

	const keyv = new Keyv();
	keyv.on('error', err => logger.error('Connection Error', err));

	if (subscription.accessToken) {
		const subscriptionCient = initPleromaClient(configs.source, subscription.accessToken);

		const maxStatusIdKey = `${subscription.roomId}//maxStatusId`;

		const reload = async () => {
			const maxStatusId = await keyv.get(maxStatusIdKey);

			const response = await subscriptionCient.client.getHomeTimeline({
				limit: configs.app.statusLimit,
				since_id: maxStatusId,
			})

			logger.debug(`${subscription.roomId}: Loaded ${response.data.length} statuses`);

			response.data
				// .filter((status) => !status.in_reply_to_id && !status.reblog?.in_reply_to_id)
				// .filter((status) => status.reblog)
				.forEach((status) => {
					matrix.sendHtmlText(subscription.roomId, renderMessage(status));
				});

			// Update maxStatusId
			const newMaxStatusId: string | undefined = response.data.map(s => s.id)
				.reduce((a, b) => a > b ? a : b, maxStatusId);
			if (newMaxStatusId !== maxStatusId) {
				await keyv.set(maxStatusIdKey, newMaxStatusId);
			}
		};

		reload();
		setInterval(reload, configs.app.interval * 1000);
	}

}

run();
