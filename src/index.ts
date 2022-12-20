'use strict';

import { initPleromaClient } from './source';
import { initMatrixBot } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import { renderMessage } from './render';
import loadConfigs from './config';

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

	if (subscription.accessToken) {
		const subscriptionCient = initPleromaClient(configs.source, subscription.accessToken);

		const reload = () => {
			subscriptionCient.client.getHomeTimeline({
				limit: configs.app.statusLimit,
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
					// .filter((status) => !status.in_reply_to_id && !status.reblog?.in_reply_to_id)
					// .filter((status) => status.reblog)
					.forEach((status) => {
						matrix.sendHtmlText(subscription.roomId, renderMessage(status));
					});
			});
		};

		reload();
		setInterval(reload, configs.app.interval * 1000);
	}

}

run();
