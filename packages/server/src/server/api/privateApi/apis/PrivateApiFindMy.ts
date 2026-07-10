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

    async debugDevicesDelayed(): Promise<TransactionResult> {
        const action = "debug-findmy-devices-delayed";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async debugDevicesFMIPCallbacks(): Promise<TransactionResult> {
        const action = "debug-findmy-devices-fmip-callbacks";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async debugDevicesProviderRuntime(): Promise<TransactionResult> {
        const action = "debug-findmy-devices-provider-runtime";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async debugDevicesDataSource(): Promise<TransactionResult> {
        const action = "debug-findmy-devices-data-source";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async debugDevicesDataSourceMirror(): Promise<TransactionResult> {
        const action = "debug-findmy-devices-data-source-mirror";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async debugDevicesFMIPDataManager(): Promise<TransactionResult> {
        const action = "debug-findmy-devices-fmip-datamanager";
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

    async startSearchPartyLocationLatestSingleProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-latest-single";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationSourceSubsetProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-source-subset";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationProxyContextProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-proxy-context";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationLiveRequestProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-live-request";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationResolveIdentifiersProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-resolve-identifiers";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationResolveContextUuidProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-resolve-context-uuid";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationResolveStableIdentifierProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-resolve-stable-identifier";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationResolvedBeaconLocationProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-resolved-beacon-location";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationContextSingleIdentifierProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-context-single-identifier";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationLastOnlineIdentifiersProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-last-online-identifiers";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationCallbackWatchProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-callback-watch";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationCallbackWatchFullContextProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-callback-watch-full-context";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationDeviceEventWatchProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-device-event-watch";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationDelegatedContextProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-delegated-context";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationDelegatedWatchProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-delegated-watch";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async startSearchPartyLocationDelegatedCheckpointProbe(checkpoint: string): Promise<TransactionResult> {
        const action = `debug-findmy-searchparty-locations-delegated-checkpoint-${checkpoint}`;
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async getSearchPartyLocationProbe(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }

    async getSearchPartyLocationProbeCompact(): Promise<TransactionResult> {
        const action = "debug-findmy-searchparty-locations-compact";
        const request = new TransactionPromise(TransactionType.FIND_MY);
        return this.sendApiMessage(action, null, request, this.process);
    }
}
