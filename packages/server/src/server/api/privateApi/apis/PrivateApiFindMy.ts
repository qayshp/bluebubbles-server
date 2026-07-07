import {
    TransactionPromise,
    TransactionResult,
    TransactionType
} from "@server/managers/transactionManager/transactionPromise";
import { PrivateApiAction } from ".";

export class PrivateApiFindMy extends PrivateApiAction {
    tag = "PrivateApiFindMy";

    process = "com.apple.findmy";

    async refreshFriends(): Promise<TransactionResult> {
        const action = "refresh-findmy-friends";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async refreshDevices(): Promise<TransactionResult> {
        const action = "refresh-findmy-devices";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async refreshItems(): Promise<TransactionResult> {
        const action = "refresh-findmy-items";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async debugSearchParty(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyBeaconProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-beacons-start";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async getSearchPartyBeaconProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-beacons";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-start";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async getSearchPartyLocationProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }
}
