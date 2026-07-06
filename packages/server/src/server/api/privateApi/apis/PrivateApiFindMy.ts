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
}
