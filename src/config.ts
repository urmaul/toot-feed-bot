import env from 'env-var';

export default () => {
    const dataDir = env.get('APP_DATA_DIR').default('./data').asString();

    let configs = {
        app: {
            name: env.get('APP_NAME').default('TootFeedBot').asString(),
            dataDir,
            // Number of seconds between refresh requests
            interval: env.get('APP_INTERVAL_SECONDS').default(5 * 60).asIntPositive(),
            // Maximum number of statuses that can be requested from the source at once
            statusLimit: env.get('APP_STATUS_LIMIT').asInt(),
        },
        source: {
            baseUrl: env.get('FEDIVERSE_BASE_URL').required().asUrlObject().origin,
            clientId: env.get('FEDIVERSE_CLIENT_ID').required().asString(),
            clientSecret: env.get('FEDIVERSE_CLIENT_SECRET').required().asString(),
        },
        subscription: {
            roomId: env.get('SUBSCRIPTION_ROOM_ID').required().asString(),
            accessToken: env.get('SUBSCRIPTION_ACCESS_TOKEN').required().asString(),
            maxStatusId: undefined,
        },
        matrix: {
            serverUrl: env.get('MATRIX_SERVER_URL').required().asUrlObject().origin,
            accessToken: env.get('MATRIX_ACCESS_TOKEN').required().asString(),
            fsStoragePath: `${dataDir}/matrix-bot.json`,
        },
    };
    
    // Cleanup process.env for security
    process.env = {};

    return configs;
};


