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
        store: {
            // Connection line for the Keyv store
            // See: https://github.com/jaredwray/keyv#storage-adapters
            // So far, only sqlite is supported
            uri: env.get('STORE_URI').asString(),
            // Encryption secret
            // Should be a random string
            // You will have do delete the database when changing it
            secret: env.get('STORE_SECRET').default('').asString(),
        },
        source: {
            sns: env.get('FEDIVERSE_SNS').required().asEnum(['pleroma']),
            hostname: env.get('FEDIVERSE_BASE_URL').required().asUrlObject().hostname,
            clientId: env.get('FEDIVERSE_CLIENT_ID').required().asString(),
            clientSecret: env.get('FEDIVERSE_CLIENT_SECRET').required().asString(),
        },
        subscription: {
            roomId: env.get('SUBSCRIPTION_ROOM_ID').required().asString(),
            accessToken: env.get('SUBSCRIPTION_ACCESS_TOKEN').required().asString(),
        },
        matrix: {
            serverUrl: env.get('MATRIX_SERVER_URL').required().asUrlObject().origin,
            accessToken: env.get('MATRIX_ACCESS_TOKEN').required().asString(),
            fsStoragePath: `${dataDir}/matrix-bot.json`,
            cryptoStorageDir: `${dataDir}/matrix-bot-sled`,
        },
    };
    
    // Cleanup process.env for security
    process.env = {};

    return configs;
};


