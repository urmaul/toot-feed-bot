import env from 'env-var';

export default () => {
    const dataDir = env.get('APP_DATA_DIR').default('./data').asString();

    const configs = {
        app: {
            name: env.get('APP_NAME').default('TootFeedBot').asString(),
            dataDir,
            // Number of seconds between refresh requests
            interval: env.get('APP_INTERVAL_SECONDS').default(15 * 60).asIntPositive(),
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
        matrix: {
            serverUrl: env.get('MATRIX_SERVER_URL').required().asUrlObject().origin,
            accessToken: env.get('MATRIX_ACCESS_TOKEN').required().asString(),
            cryptoDisabled: env.get('MATRIX_CRYPTO_DISABLED').default('false').asBool(),
            fsStoragePath: `${dataDir}/matrix-bot.json`,
            cryptoStorageDir: `${dataDir}/matrix-bot-sled`,
        },
        backoff: {
            // Cirquit breaker interval in seconds
            cirquitBreakerInterval: env.get('CIRQUIT_BREAKER_INTERVAL_SECONDS').default(30 * 60).asIntPositive(),
        }
    };
    
    // Cleanup process.env for security
    process.env = {};

    return configs;
};


