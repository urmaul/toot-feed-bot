'use strict';

import { initPleromaClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import { renderMessage } from './render';
import { appConfig, matrixConfig, sourceConfig, subscriptionConfig } from './config';

async function run() {
	// TODO: don't assume client type
	const source = initPleromaClient(sourceConfig, null);

	// ----- Matrix bot

	const matrix = await initMatrixBot(matrixConfig, {
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

	let subscription: Subscription = subscriptionConfig;

	if (subscription.accessToken) {
		const subscriptionCient = initPleromaClient(sourceConfig, subscription.accessToken);

		const reload = () => {
			subscriptionCient.client.getHomeTimeline({
				since_id: subscription.maxStatusId,
			}).then((response) => {
				logger.debug(`${subscription.roomId}: Loaded ${response.data.length} statuses`);

				// Update maxStatusId
				response.data.forEach((status) => {
					if (!subscription.maxStatusId || status.id > subscription.maxStatusId) {
						subscription.maxStatusId = status.id;
					}
				});

				response.data
					.filter((status) => !status.in_reply_to_id && !status.reblog?.in_reply_to_id)
					.forEach((status) => {
						logger.debug(status);
						matrix.sendHtmlText(subscription.roomId, renderMessage(status));
					});
			});
		};

		reload();
		setInterval(reload, appConfig.interval * 1000);
	}

}

run();
