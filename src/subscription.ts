import { RoomId } from "./types";

export interface Subscription {
    // Matrix room id
    roomId: RoomId;
    // TODO: add a source reference
    accessToken: string | undefined;
}
