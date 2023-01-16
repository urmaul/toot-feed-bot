import { logger } from './logger';
import Keyv from 'keyv';
import CryptoJS from 'crypto-js';
import { RoomId } from './types';
import { Subscription } from './subscription';

// Data store

export interface StoreConfig {
    // Connection line for the Keyv store
    // See: https://github.com/jaredwray/keyv#storage-adapters
    // So far, only sqlite is supported
    uri: string | undefined;
    // Encryption secret
    secret: string;
}

export class Store {
    readonly keyv: Keyv;
    readonly subscriptions: Subscription[];

    constructor(config: StoreConfig, subscriptions: Subscription[]) {
        this.keyv = new Keyv(config.uri, {
            serialize: (data) => CryptoJS.AES.encrypt(JSON.stringify(data), config.secret).toString(),
            deserialize: (text) => JSON.parse(CryptoJS.AES.decrypt(text, config.secret).toString(CryptoJS.enc.Utf8))
        });
        this.keyv.on('error', err => logger.error('Store Error', err));

        this.subscriptions = subscriptions;
    }

    private maxStatusIdKey(roomId: RoomId): string {
        return `maxStatusId:${roomId.value}`;
    }
    async getMaxStatusId(roomId: RoomId): Promise<string | undefined> {
        try {
            return await this.keyv.get(this.maxStatusIdKey(roomId));
        } catch (error) {
            logger.error(`Error while getting maxStatusId for ${roomId.value}`, error);
            // Fallback to no maxStatusId
            return undefined;
        }
    }
    async setMaxStatusId(roomId: RoomId, newValue: string | undefined): Promise<void> {
        await this.keyv.set(this.maxStatusIdKey(roomId), newValue);
    }

    async getAllSubscriptions(): Promise<Subscription[]> {
        return Promise.resolve(this.subscriptions);
    }
}
