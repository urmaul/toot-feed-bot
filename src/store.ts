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
    maxStatusIds: MaxIdRepository;
    maxNotificationIds: MaxIdRepository;

    constructor(config: StoreConfig) {
        const serialize = (data) => CryptoJS.AES.encrypt(JSON.stringify(data), config.secret).toString();
        const deserialize = (text) => JSON.parse(CryptoJS.AES.decrypt(text, config.secret).toString(CryptoJS.enc.Utf8));
        const store = new KeyvSqlite({ uri: config.uri });

        this.keyv = new Keyv({ store, serialize, deserialize, namespace: 'bot' });
        this.keyv.on('error', err => logger.error('Store Error', err));
        this.subscriptions = new Keyv({ store, serialize, deserialize, namespace: 'subscription' });
        this.subscriptions.on('error', err => logger.error('Subscriptions store Error', err));

        const fediverseConfigKey = (hostname: string) => `fediverseConfig:${hostname}`;
        const maxStatusIdKey = (roomId: RoomId) => `maxStatusId:${this.hash(roomId)}`;
        const maxNotificationIdKey = (roomId: RoomId) => `maxNotificationId:${this.hash(roomId)}`;

        this.fediverseConfigs = {
            get: (hostname: string): Promise<FediverseConfig | undefined> =>
                this.tryGet(fediverseConfigKey(hostname)),
            add: (fediverseConfig: FediverseConfig): Promise<void> => 
                this.trySet(fediverseConfigKey(fediverseConfig.ref.hostname), fediverseConfig),
        };

        this.maxStatusIds = {
            get: (roomId: RoomId): Promise<string | undefined> =>
                this.tryGet(maxStatusIdKey(roomId)),
            set: (roomId: RoomId, newValue: string): Promise<void> =>
                this.trySet(maxStatusIdKey(roomId), newValue),
            delete: (roomId: RoomId): Promise<void> =>
                this.tryDelete(maxStatusIdKey(roomId)),
        };

        this.maxNotificationIds = {
            get: (roomId: RoomId): Promise<string | undefined> =>
                this.tryGet(maxNotificationIdKey(roomId)),
            set: (roomId: RoomId, newValue: string): Promise<void> =>
                this.trySet(maxNotificationIdKey(roomId), newValue),
            delete: (roomId: RoomId): Promise<void> =>
                this.tryDelete(maxNotificationIdKey(roomId)),
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

    private async trySet(key: string, value: any): Promise<void> {
        try {
            await this.keyv.set(key, value);
        } catch (error) {
            logger.error(`Error while setting ${key}`, error);
        }
    }

    private async tryDelete(key: string): Promise<void> {
        try {
            await this.keyv.delete(key);
        } catch (error) {
            logger.error(`Error while deleting ${key}`, error);
        }
    }

    // -- Subscriptions --

    async addSubscription(subscription: Subscription): Promise<void> {
        await this.subscriptions.set(this.hash(subscription.roomId), subscription);
    }

    async getAllSubscriptions(): Promise<Subscription[]> {
        const subscriptions: Subscription[] = [];
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
        await this.maxStatusIds.delete(roomId);
        await this.maxNotificationIds.delete(roomId);
        await this.keyv.delete(this.ongoingRegistrationKey(roomId));
    }

    // -- Ongoing registrations --

    private ongoingRegistrationKey(roomId: RoomId): string {
        return `ongoingRegistration:${this.hash(roomId)}`;
    }

    async addOngoingRegistration(registration: OngoingRegistration): Promise<void> {
        return this.trySet(this.ongoingRegistrationKey(registration.roomId), registration);
    }

    async getOngoingRegistration(roomId: RoomId): Promise<OngoingRegistration | undefined> {
        return this.tryGet(this.ongoingRegistrationKey(roomId));
    }

    async deleteOngoingRegistration(roomId: RoomId): Promise<void> {
        await this.keyv.delete(this.ongoingRegistrationKey(roomId));
    }
}

export interface FediverseConfigRepository {
    get(hostname: string): Promise<FediverseConfig | undefined>;
    add(fediverseConfig: FediverseConfig): Promise<void>;
}

export interface MaxIdRepository {
    get(roomId: RoomId): Promise<string | undefined>;
    set(roomId: RoomId, newValue: string): Promise<void>;
    delete(roomId: RoomId): Promise<void>;
}
