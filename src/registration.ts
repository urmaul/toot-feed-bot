import { InstanceRef, RoomId } from "./types";

export interface OngoingRegistration {
    // Matrix room id
    roomId: RoomId;
    // Fediverse instance ref
    instanceRef: InstanceRef,
}
