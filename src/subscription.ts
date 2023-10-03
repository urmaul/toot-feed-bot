import { InstanceRef, RoomId } from './types';

export interface Subscription {
    // Matrix room id
    roomId: RoomId;
    // Fediverse instance ref
    instanceRef: InstanceRef,
    accessToken: string;
}
