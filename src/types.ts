export interface SourceRef {
    sns: 'pleroma';
    hostname: string;
}

export interface RoomId {
    kind: 'roomId';
    value: string;
}

export const newRoomId = (value: string): RoomId => ({ kind: 'roomId', value });
