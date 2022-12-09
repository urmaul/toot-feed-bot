export interface Subscription {
    // Matrix room id
    roomId: string;
    // TODO: add a source reference
    accessToken: string | undefined;
    maxStatusId: string | undefined;
}