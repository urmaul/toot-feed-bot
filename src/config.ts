import env from 'env-var';

export const appConfig = {
    name: env.get('APP_NAME').default('TootFeedBot').asString(),
    dataDir: env.get('APP_DATA_DIR').default('./data').asString(),
    // Number of seconds between refresh requests
    interval: env.get('APP_INTERVAL_SECONDS').default(5 * 60).asIntPositive(),
    // Maximum number of statuses that can be requested from the source at once
    statusLimit: env.get('APP_STATUS_LIMIT').asInt(),
}

export const sourceConfig = {
	baseUrl: env.get('FEDIVERSE_BASE_URL').required().asUrlObject().origin,
	clientId: env.get('FEDIVERSE_CLIENT_ID').required().asString(),
	clientSecret: env.get('FEDIVERSE_CLIENT_SECRET').required().asString(),
};

export const subscriptionConfig = {
	roomId: env.get('SUBSCRIPTION_ROOM_ID').required().asString(),
	accessToken: env.get('SUBSCRIPTION_ACCESS_TOKEN').required().asString(),
	maxStatusId: undefined,
};

export const matrixConfig = {
	serverUrl: env.get('MATRIX_SERVER_URL').required().asUrlObject().origin,
	accessToken: env.get('MATRIX_ACCESS_TOKEN').required().asString(),
	fsStoragePath: `${appConfig.dataDir}/matrix-bot.json`,
}

// Cleanup process.env for security
process.env = {};
