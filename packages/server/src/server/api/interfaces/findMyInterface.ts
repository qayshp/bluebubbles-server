import { Server } from "@server";
import path from "path";
import fs from "fs";
import { FileSystem } from "@server/fileSystem";
import { isMinSequoia } from "@server/env";
import { checkPrivateApiStatus, waitMs } from "@server/helpers/utils";
import {
    quitFindMyFriends,
    startFindMyFriends,
    showFindMyDevices,
    showFindMyFriends,
    showFindMyItems,
    hideFindMyFriends
} from "../apple/scripts";
import { FindMyDevice, FindMyItem, FindMyLocationItem } from "@server/api/lib/findmy/types";
import { normalizeFindMyLocationItems, transformFindMyItemToDevice } from "@server/api/lib/findmy/utils";

export class FindMyInterface {
    static async getFriends() {
        return normalizeFindMyLocationItems(Server().findMyCache.getAll());
    }

    static async getDevices(): Promise<Array<FindMyDevice> | null> {
        if (isMinSequoia) {
            Server().logger.debug('Cannot fetch FindMy devices on macOS Sequoia or later.');
            return null;
        }

        try {
            const [devices, items] = await Promise.all([
                FindMyInterface.readDataFile("Devices"),
                FindMyInterface.readDataFile("Items")
            ]);

            // Return null if neither of the files exist
            if (devices == null && items == null) return null;

            await FindMyInterface.addItemGroupNames(items ?? []);

            // Transform the items to match the same shape as devices
            const transformedItems = (items ?? []).map(transformFindMyItemToDevice);

            return [...(devices ?? []), ...transformedItems];
        } catch (ex: any) {
            Server().logger.debug('An error occurred while reading FindMy Device cache files.');
            Server().logger.debug(String(ex));
            return null;
        }
    }

    static async getItems(): Promise<Array<FindMyItem> | null> {
        if (isMinSequoia) {
            Server().logger.debug('Cannot fetch FindMy items on macOS Sequoia or later.');
            return null;
        }

        try {
            const items = await FindMyInterface.readDataFile("Items");
            if (items == null) return null;

            await FindMyInterface.addItemGroupNames(items);
            return items;
        } catch (ex: any) {
            Server().logger.debug('An error occurred while reading FindMy Item cache file.');
            Server().logger.debug(String(ex));
            return null;
        }
    }

    static async refreshDevices(): Promise<Array<FindMyDevice> | null> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (papiEnabled && isMinSequoia) {
            checkPrivateApiStatus();
            await this.selectFindMyView("Devices");
            const result = await Server().privateApi.findmy.refreshDevices();
            const diagnostics = result?.data?.diagnostics;
            if (diagnostics) {
                Server().logger.debug(`Find My device refresh diagnostics: ${JSON.stringify(diagnostics)}`);
            }
            return result?.data?.devices ?? [];
        }

        await this.refreshLocationsAccessibility();
        return await this.getDevices();
    }

    static async debugDevicesDelayed(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My delayed device diagnostics require the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        await this.selectFindMyView("Devices");
        const result = await Server().privateApi.findmy.debugDevicesDelayed();
        const diagnostics = result?.data?.diagnostics;
        if (diagnostics) {
            Server().logger.debug(`Find My delayed device diagnostics: ${JSON.stringify(diagnostics)}`);
        }
        return result?.data ?? {};
    }

    static async debugDevicesFMIPCallbacks(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My FMIP callback diagnostics require the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        await this.selectFindMyView("Devices");
        const result = await Server().privateApi.findmy.debugDevicesFMIPCallbacks();
        const diagnostics = result?.data?.diagnostics;
        if (diagnostics) {
            Server().logger.debug(`Find My FMIP callback diagnostics: ${JSON.stringify(diagnostics)}`);
        }
        return result?.data ?? {};
    }

    static async debugDevicesProviderRuntime(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My provider runtime diagnostics require the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        await this.selectFindMyView("Devices");
        const result = await Server().privateApi.findmy.debugDevicesProviderRuntime();
        const diagnostics = result?.data?.diagnostics;
        if (diagnostics) {
            Server().logger.debug(`Find My provider runtime diagnostics: ${JSON.stringify(diagnostics)}`);
        }
        return result?.data ?? {};
    }

    static async debugDevicesFMIPDataManager(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My FMIPDataManager diagnostics require the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        await this.selectFindMyView("Devices");
        const result = await Server().privateApi.findmy.debugDevicesFMIPDataManager();
        const diagnostics = result?.data?.diagnostics;
        if (diagnostics) {
            Server().logger.debug(`Find My FMIPDataManager diagnostics: ${JSON.stringify(diagnostics)}`);
        }
        return result?.data ?? {};
    }

    static async refreshItems(): Promise<Array<FindMyItem> | null> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (papiEnabled && isMinSequoia) {
            checkPrivateApiStatus();
            await this.selectFindMyView("Items");
            const result = await Server().privateApi.findmy.refreshItems();
            const diagnostics = result?.data?.diagnostics;
            if (diagnostics) {
                Server().logger.debug(`Find My item refresh diagnostics: ${JSON.stringify(diagnostics)}`);
            }
            return result?.data?.items ?? [];
        }

        await this.refreshLocationsAccessibility();
        return await this.getItems();
    }

    static async refreshFriends(openFindMyApp = true): Promise<FindMyLocationItem[]> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        let usedPrivateApi = false;
        if (papiEnabled && isMinSequoia) {
            checkPrivateApiStatus();
            const result = await Server().privateApi.findmy.refreshFriends();
            const refreshLocations = normalizeFindMyLocationItems(result?.data?.locations ?? []);
            usedPrivateApi = true;

            // Save the data to the cache
            // The cache will handle properly updating the data.
            Server().findMyCache.addAll(refreshLocations);
        }

        // Fallback path: open Find My so the app refreshes its own cache.
        // Don't await because it should update in the background.
        // Location updates get emitted as an event as they come in.
        if (openFindMyApp && !usedPrivateApi) {
            this.refreshLocationsAccessibility();
        }

        return normalizeFindMyLocationItems(Server().findMyCache.getAll());
    }

    static async debugSearchParty(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My SearchParty debug route requires the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        const result = await Server().privateApi.findmy.debugSearchParty();
        const searchParty = result?.data?.searchparty ?? {};
        Server().logger.debug(`Find My SearchParty debug diagnostics: ${JSON.stringify(searchParty)}`);
        return searchParty;
    }

    static async startSearchPartyBeaconProbe(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My SearchParty beacon probe requires the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        const result = await Server().privateApi.findmy.startSearchPartyBeaconProbe();
        const beaconProbe = result?.data?.beacon_probe ?? {};
        Server().logger.debug(`Find My SearchParty beacon probe start: ${JSON.stringify(beaconProbe)}`);
        return beaconProbe;
    }

    static async getSearchPartyBeaconProbe(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My SearchParty beacon probe requires the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        const result = await Server().privateApi.findmy.getSearchPartyBeaconProbe();
        const beaconProbe = result?.data?.beacon_probe ?? {};
        Server().logger.debug(`Find My SearchParty beacon probe status: ${JSON.stringify(beaconProbe)}`);
        return beaconProbe;
    }

    static async startSearchPartyLocationProbe(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My SearchParty location probe requires the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        const result = await Server().privateApi.findmy.startSearchPartyLocationProbe();
        const locationProbe = result?.data?.location_probe ?? {};
        Server().logger.debug(`Find My SearchParty location probe start: ${JSON.stringify(locationProbe)}`);
        return locationProbe;
    }

    static async startSearchPartyLocationLatestSingleProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "latest single identifier",
            () => Server().privateApi.findmy.startSearchPartyLocationLatestSingleProbe()
        );
    }

    static async startSearchPartyLocationSourceSubsetProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "source subset",
            () => Server().privateApi.findmy.startSearchPartyLocationSourceSubsetProbe()
        );
    }

    static async startSearchPartyLocationProxyContextProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "proxy context",
            () => Server().privateApi.findmy.startSearchPartyLocationProxyContextProbe()
        );
    }

    static async startSearchPartyLocationLiveRequestProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "live request",
            () => Server().privateApi.findmy.startSearchPartyLocationLiveRequestProbe()
        );
    }

    static async startSearchPartyLocationResolveIdentifiersProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "identifier resolution",
            () => Server().privateApi.findmy.startSearchPartyLocationResolveIdentifiersProbe()
        );
    }

    static async startSearchPartyLocationResolveContextUuidProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "context UUID identifier resolution",
            () => Server().privateApi.findmy.startSearchPartyLocationResolveContextUuidProbe()
        );
    }

    static async startSearchPartyLocationResolveStableIdentifierProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "stable identifier resolution",
            () => Server().privateApi.findmy.startSearchPartyLocationResolveStableIdentifierProbe()
        );
    }

    static async startSearchPartyLocationResolvedBeaconLocationProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "resolved beacon location",
            () => Server().privateApi.findmy.startSearchPartyLocationResolvedBeaconLocationProbe()
        );
    }

    static async startSearchPartyLocationContextSingleIdentifierProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "single identifier context",
            () => Server().privateApi.findmy.startSearchPartyLocationContextSingleIdentifierProbe()
        );
    }

    static async startSearchPartyLocationLastOnlineIdentifiersProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "last-online identifiers context",
            () => Server().privateApi.findmy.startSearchPartyLocationLastOnlineIdentifiersProbe()
        );
    }

    static async startSearchPartyLocationCallbackWatchProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "callback watch",
            () => Server().privateApi.findmy.startSearchPartyLocationCallbackWatchProbe()
        );
    }

    static async startSearchPartyLocationCallbackWatchFullContextProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "full context callback watch",
            () => Server().privateApi.findmy.startSearchPartyLocationCallbackWatchFullContextProbe()
        );
    }

    static async startSearchPartyLocationDeviceEventWatchProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "device event watch",
            () => Server().privateApi.findmy.startSearchPartyLocationDeviceEventWatchProbe()
        );
    }

    static async startSearchPartyLocationDelegatedContextProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "delegated context",
            () => Server().privateApi.findmy.startSearchPartyLocationDelegatedContextProbe()
        );
    }

    static async startSearchPartyLocationDelegatedWatchProbe(): Promise<any> {
        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            "delegated watch",
            () => Server().privateApi.findmy.startSearchPartyLocationDelegatedWatchProbe()
        );
    }

    static async startSearchPartyLocationDelegatedCheckpointProbe(checkpoint: string): Promise<any> {
        const allowedCheckpoints = [
            "session",
            "location-fetch",
            "proxy",
            "responds-owner",
            "responds-location-fetch",
            "responds-proxy",
            "signature-owner",
            "signature-location-fetch",
            "signature-proxy",
            "captured-context",
            "captured-context-detail",
            "owner-last-context",
            "location-fetch-last-context",
            "beacon-last-online-correlation",
            "owner-location-graph"
        ];
        if (!allowedCheckpoints.includes(checkpoint)) {
            return {
                enabled: false,
                reason: `Unknown delegated checkpoint: ${checkpoint}`
            };
        }

        return await FindMyInterface.startDedicatedSearchPartyLocationProbe(
            `delegated checkpoint ${checkpoint}`,
            () => Server().privateApi.findmy.startSearchPartyLocationDelegatedCheckpointProbe(checkpoint)
        );
    }

    private static async startDedicatedSearchPartyLocationProbe(label: string, startProbe: () => Promise<any>): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My SearchParty location probe requires the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        const result = await startProbe();
        const locationProbe = result?.data?.location_probe ?? {};
        Server().logger.debug(`Find My SearchParty ${label} location probe start: ${JSON.stringify(locationProbe)}`);
        return locationProbe;
    }

    static async getSearchPartyLocationProbe(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My SearchParty location probe requires the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        const result = await Server().privateApi.findmy.getSearchPartyLocationProbe();
        const locationProbe = result?.data?.location_probe ?? {};
        Server().logger.debug(`Find My SearchParty location probe status: ${JSON.stringify(locationProbe)}`);
        return locationProbe;
    }

    static async getSearchPartyLocationProbeCompact(): Promise<any> {
        const papiEnabled = Server().repo.getConfig("enable_private_api") as boolean;
        if (!papiEnabled || !isMinSequoia) {
            return {
                enabled: false,
                reason: "Find My SearchParty location probe requires the private API on macOS Sequoia or later."
            };
        }

        checkPrivateApiStatus();
        const result = await Server().privateApi.findmy.getSearchPartyLocationProbeCompact();
        const locationProbe = result?.data?.location_probe ?? {};
        Server().logger.debug(`Find My SearchParty compact location probe status: ${JSON.stringify(locationProbe)}`);
        return locationProbe;
    }

    static async selectFindMyView(view: "Devices" | "Items") {
        const url = view === "Devices" ? "findmy://devices" : "findmy://items";

        try {
            await FileSystem.execShellCommand(`/usr/bin/open '${url}'`);
            await waitMs(3000);
            return;
        } catch (ex: any) {
            Server().logger.warn(`Unable to select Find My ${view} view by URL! CLI Error: ${ex?.message ?? String(ex)}`);
        }

        try {
            await FileSystem.executeAppleScript(view === "Devices" ? showFindMyDevices() : showFindMyItems());
        } catch (ex: any) {
            Server().logger.warn(`Unable to select Find My ${view} view! CLI Error: ${ex?.message ?? String(ex)}`);
        }
    }

    static async refreshLocationsAccessibility() {
        await FileSystem.executeAppleScript(quitFindMyFriends());
        await waitMs(3000);

        // Make sure the Find My app is open.
        // Give it 5 seconds to open
        await FileSystem.executeAppleScript(startFindMyFriends());
        await waitMs(5000);

        // Bring the Find My app to the foreground so it refreshes the devices
        // Give it 15 seconods to refresh
        await FileSystem.executeAppleScript(showFindMyFriends());
        await waitMs(15000);

        // Re-hide the Find My App
        await FileSystem.executeAppleScript(hideFindMyFriends());
    }

    static async readItemGroups(): Promise<Array<any>> {
        const itemGroupsPath = path.join(FileSystem.findMyDir, "ItemGroups.data");
        if (!fs.existsSync(itemGroupsPath)) return [];

        return new Promise((resolve, reject) => {
            fs.readFile(itemGroupsPath, { encoding: "utf-8" }, (err, data) => {
                // Couldn't read the file
                if (err) return resolve(null);

                try {
                    const parsedData = JSON.parse(data.toString());
                    if (Array.isArray(parsedData)) {
                        return resolve(parsedData);
                    } else {
                        reject(new Error("Failed to read FindMy ItemGroups cache file! It is not an array!"));
                    }
                } catch {
                    reject(new Error("Failed to read FindMy ItemGroups cache file! It is not in the correct format!"));
                }
            });
        });
    }

    private static async addItemGroupNames(items: FindMyItem[]) {
        const itemsWithGroup = items.filter(item => item.groupIdentifier);
        if (itemsWithGroup.length === 0) return;

        try {
            const itemGroups = await FindMyInterface.readItemGroups();
            if (!itemGroups) return;

            const groupMap = itemGroups.reduce((acc, group) => {
                acc[group.identifier] = group.name;
                return acc;
            }, {} as Record<string, string>);

            for (const item of items) {
                if (item.groupIdentifier && groupMap[item.groupIdentifier]) {
                    item.groupName = groupMap[item.groupIdentifier];
                }
            }
        } catch (ex: any) {
            Server().logger.debug('An error occurred while reading FindMy ItemGroups cache file.');
            Server().logger.debug(String(ex));
        }
    }

    private static readDataFile<T extends "Devices" | "Items">(
        type: T
    ): Promise<Array<T extends "Devices" ? FindMyDevice : FindMyItem> | null> {
        const devicesPath = path.join(FileSystem.findMyDir, `${type}.data`);
        return new Promise((resolve, reject) => {
            fs.readFile(devicesPath, { encoding: "utf-8" }, (err, data) => {
                // Couldn't read the file
                if (err) return resolve(null);

                try {
                    const parsedData = JSON.parse(data.toString());
                    if (Array.isArray(parsedData)) {
                        return resolve(parsedData);
                    } else {
                        reject(new Error(`Failed to read FindMy ${type} cache file! It is not an array!`));
                    }
                } catch {
                    reject(new Error(`Failed to read FindMy ${type} cache file! It is not in the correct format!`));
                }
            });
        });
    }
}
