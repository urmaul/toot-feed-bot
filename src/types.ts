// Social network system
export type SNS = 'pleroma' | 'mastodon' | 'misskey' | 'friendica';

export interface InstanceRef {
    sns: SNS;
    hostname: string;
}

export interface RoomId {
    kind: 'roomId';
    value: string;
}

export const newRoomId = (value: string): RoomId => ({ kind: 'roomId', value });
