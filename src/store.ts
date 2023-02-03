import { logger } from './logger';
import Keyv from 'keyv';
import CryptoJS from 'crypto-js';
import { RoomId } from './types';
import { Subscription } from './subscription';
import { FediverseConfig } from './fediverse';

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
    readonly fediverse: FediverseConfig;

    constructor(config: StoreConfig, subscriptions: Subscription[], fediverse: FediverseConfig) {
        this.keyv = new Keyv(config.uri, {
            serialize: (data) => CryptoJS.AES.encrypt(JSON.stringify(data), config.secret).toString(),
            deserialize: (text) => JSON.parse(CryptoJS.AES.decrypt(text, config.secret).toString(CryptoJS.enc.Utf8))
        });
        this.keyv.on('error', err => logger.error('Store Error', err));

        this.subscriptions = subscriptions;
        this.fediverse = fediverse;
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

    private maxNotificationIdKey(roomId: RoomId): string {
        return `maxNotificationId:${roomId.value}`;
    }
    async getMaxNotificationId(roomId: RoomId): Promise<string | undefined> {
        try {
            return await this.keyv.get(this.maxNotificationIdKey(roomId));
        } catch (error) {
            logger.error(`Error while getting maxNotificationId for ${roomId.value}`, error);
            // Fallback to no maxNotificationId
            return undefined;
        }
    }
    async setMaxNotificationId(roomId: RoomId, newValue: string | undefined): Promise<void> {
        await this.keyv.set(this.maxNotificationIdKey(roomId), newValue);
    }

    async getAllSubscriptions(): Promise<Subscription[]> {
        return Promise.resolve(this.subscriptions);
    }

    async getSubscription(roomId: RoomId): Promise<Subscription | undefined> {
        const subscription = this.subscriptions.find(s => s.roomId.value == roomId.value);
        return Promise.resolve(subscription);
    }

    async getFediverseConfig(hostname: string): Promise<FediverseConfig | undefined> {
        return Promise.resolve(hostname == this.fediverse.ref.hostname ? this.fediverse : undefined);
    }
}
