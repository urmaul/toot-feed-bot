import { logger } from './logger';
import Keyv from 'keyv';
import CryptoJS from 'crypto-js';

// Data store

export interface StoreConfig {
    // Connection line for the Keyv store
    // See: https://github.com/jaredwray/keyv#storage-adapters
    // So far, only sqlite is supported
    uri: string | undefined;
    // Encryption secret
    secret: string;
}

export function initStore(config: StoreConfig): Keyv {
    const keyv = new Keyv(config.uri, {
		serialize: (data) => CryptoJS.AES.encrypt(JSON.stringify(data), config.secret).toString(),
		deserialize: (text) => JSON.parse(CryptoJS.AES.decrypt(text, config.secret).toString(CryptoJS.enc.Utf8))
	});
	keyv.on('error', err => logger.error('Connection Error', err));

    return keyv;
}