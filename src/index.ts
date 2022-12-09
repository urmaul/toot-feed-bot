'use strict';

import { initPleromaClient, SourceConfig } from './source';
import { initMatrixBot, MatrixConfig } from './matrix';
import { logger } from './logger';
import { Subscription } from './subscription';
import { renderMessage } from './render';

// TODO: panic on missing env variables
const sourceConfig: SourceConfig = {
	baseUrl: process.env.FEDIVERSE_BASE_URL || '',
	clientId: process.env.FEDIVERSE_CLIENT_ID || '',
	clientSecret: process.env.FEDIVERSE_CLIENT_SECRET || '',
};

logger.debug('Got source config', sourceConfig);

// TODO: don't assume client type
const source = initPleromaClient(sourceConfig, null);

// --- Subscription

const subscription: Subscription = {
	roomId: process.env.SUBSCRIPTION_ROOM_ID || '',
	accessToken: process.env.SUBSCRIPTION_ACCESS_TOKEN || '',
};

logger.debug('Got subscription data', subscription);

// ----- Matrix bot

const matrixConfig: MatrixConfig = {
	serverUrl: process.env.MATRIX_SERVER_URL || '',
	accessToken: process.env.MATRIX_ACCESS_TOKEN || '',
	fsStoragePath: './data/matrix-bot.json',
}

logger.debug('Got matrix config', matrixConfig)

const matrix = initMatrixBot(matrixConfig, {
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

if (subscription.accessToken) {
	let subscriptionCient = initPleromaClient(sourceConfig, subscription.accessToken);
	subscriptionCient.client.getHomeTimeline({
		limit: 10,
	}).then((response) => {
		// logger.debug(response);
		response.data
			.filter((status) => !status.in_reply_to_id)
			.forEach((status) => {
				logger.debug(status);
				matrix.sendHtmlText(subscription.roomId, renderMessage(status));
			});
	});

	// logger.debug(`Sending message to ${subscription.roomId}`);
	// matrix.sendText(subscription.roomId, 'Oh hi.');
}
