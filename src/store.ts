import { logger } from './logger';
import Keyv from 'keyv';
import CryptoJS from 'crypto-js';
import { RoomId } from './types';
import { Subscription } from './subscription';
import { FediverseConfig } from './fediverse';
import KeyvSqlite from '@keyv/sqlite';
import { OngoingRegistration } from './registration';

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
    private keyv: Keyv;
    private subscriptions: Keyv;

    fediverseConfigs: FediverseConfigRepository;

    constructor(config: StoreConfig) {
        const serialize = (data) => CryptoJS.AES.encrypt(JSON.stringify(data), config.secret).toString();
        const deserialize = (text) => JSON.parse(CryptoJS.AES.decrypt(text, config.secret).toString(CryptoJS.enc.Utf8));
        const store = new KeyvSqlite({ uri: config.uri });

        this.keyv = new Keyv({ store, serialize, deserialize, namespace: 'bot' });
        this.keyv.on('error', err => logger.error('Store Error', err));
        this.subscriptions = new Keyv({ store, serialize, deserialize, namespace: 'subscription' });
        this.subscriptions.on('error', err => logger.error('Subscriptions store Error', err));

        const fediverseConfigKey = (hostname: string) => `fediverseConfig:${hostname}`;
        this.fediverseConfigs = {
            get: (hostname: string): Promise<FediverseConfig | undefined> =>
                this.tryGet(fediverseConfigKey(hostname)),
            add: async (fediverseConfig: FediverseConfig): Promise<void> => {
                await this.keyv.set(fediverseConfigKey(fediverseConfig.ref.hostname), fediverseConfig);
            }
        };
    }

    private hash(roomId: RoomId): string {
        return CryptoJS.SHA256(roomId.value).toString(CryptoJS.enc.Base64);
    }

    private async tryGet(key: string): Promise<any | undefined> {
        try {
            return await this.keyv.get(key);
        } catch (error) {
            logger.error(`Error while getting ${key}`, error);
            // Fallback to undefined
            return undefined;
        }
    }

    // -- Max status ids --

    private maxStatusIdKey(roomId: RoomId): string {
        return `maxStatusId:${this.hash(roomId)}`;
    }
    async getMaxStatusId(roomId: RoomId): Promise<string | undefined> {
        try {
            return await this.keyv.get(this.maxStatusIdKey(roomId));
        } catch (error) {
            logger.error(`Error while getting maxStatusId for ${this.hash(roomId)}`, error);
            // Fallback to undefined
            return undefined;
        }
    }
    async setMaxStatusId(roomId: RoomId, newValue: string | undefined): Promise<void> {
        await this.keyv.set(this.maxStatusIdKey(roomId), newValue);
    }

    // -- Max notification ids --

    private maxNotificationIdKey(roomId: RoomId): string {
        return `maxNotificationId:${this.hash(roomId)}`;
    }
    async getMaxNotificationId(roomId: RoomId): Promise<string | undefined> {
        try {
            return await this.keyv.get(this.maxNotificationIdKey(roomId));
        } catch (error) {
            logger.error(`Error while getting maxNotificationId for ${this.hash(roomId)}`, error);
            // Fallback to undefined
            return undefined;
        }
    }
    async setMaxNotificationId(roomId: RoomId, newValue: string | undefined): Promise<void> {
        await this.keyv.set(this.maxNotificationIdKey(roomId), newValue);
    }

    // -- Subscriptions --

    async addSubscription(subscription: Subscription): Promise<void> {
        await this.subscriptions.set(this.hash(subscription.roomId), subscription);
    }

    async getAllSubscriptions(): Promise<Subscription[]> {
        let subscriptions: Subscription[] = [];
        for await (const [_, subscription] of this.subscriptions.iterator()) {
            subscriptions.push(subscription);
        }
        return subscriptions;
    }

    async getSubscription(roomId: RoomId): Promise<Subscription | undefined> {
        try {
            return await this.subscriptions.get(this.hash(roomId));
        } catch (error) {
            logger.error(`Error while getting subscription for ${this.hash(roomId)}`, error);
            // Fallback to undefined
            return undefined;
        }
    }

    async deleteSubscription(roomId: RoomId): Promise<void> {
        await this.subscriptions.delete(this.hash(roomId));
        await this.keyv.delete(this.maxStatusIdKey(roomId));
        await this.keyv.delete(this.maxNotificationIdKey(roomId));
        await this.keyv.delete(this.ongoingRegistrationKey(roomId));
    }

    // -- Ongoing registrations --

    private ongoingRegistrationKey(roomId: RoomId): string {
        return `ongoingRegistration:${this.hash(roomId)}`;
    }

    async addOngoingRegistration(registration: OngoingRegistration): Promise<void> {
        await this.keyv.set(this.ongoingRegistrationKey(registration.roomId), registration);
    }

    async getOngoingRegistration(roomId: RoomId): Promise<OngoingRegistration | undefined> {
        try {
            return await this.keyv.get(this.ongoingRegistrationKey(roomId));
        } catch (error) {
            logger.error(`Error while getting OngoingRegistration for ${this.hash(roomId)}`, error);
            // Fallback to undefined
            return undefined;
        }
    }

    async deleteOngoingRegistration(roomId: RoomId): Promise<void> {
        await this.keyv.delete(this.ongoingRegistrationKey(roomId));
    }
}

export interface FediverseConfigRepository {
    get(hostname: string): Promise<FediverseConfig | undefined>;
    add(fediverseConfig: FediverseConfig): Promise<void>;
}
