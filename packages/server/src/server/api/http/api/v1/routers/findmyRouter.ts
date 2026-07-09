import { Next } from "koa";
import { RouterContext } from "koa-router";
import { Success } from "../responses/success";
import { ServerError } from "../responses/errors";
import { FindMyInterface } from "@server/api/interfaces/findMyInterface";
import { FindMyLocationItem } from "@server/api/lib/findmy/types";
import { NEW_FINDMY_LOCATION } from "@server/events";
import { Server } from "@server";

export class FindMyRouter {
    static async emitFriendLocations(locations: FindMyLocationItem[]) {
        if (!Array.isArray(locations)) return;
        for (const item of locations) {
            await Server().emitMessage(NEW_FINDMY_LOCATION, item, "normal", false, true);
        }

        Server().logger.debug(`Emitted ${locations.length} FindMy friend location update(s) to socket clients after refresh.`);
    }

    static async refreshDevices(ctx: RouterContext, _: Next) {
        try {
            const locations = await FindMyInterface.refreshDevices();
            return new Success(ctx, {
                message: "Successfully refreshed Find My device locations!",
                data: locations
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to refresh Find My device locations!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async debugDevicesDelayed(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.debugDevicesDelayed();
            return new Success(ctx, {
                message: "Successfully fetched delayed Find My device diagnostics!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch delayed Find My device diagnostics!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async debugDevicesFMIPCallbacks(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.debugDevicesFMIPCallbacks();
            return new Success(ctx, {
                message: "Successfully fetched Find My FMIP callback diagnostics!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My FMIP callback diagnostics!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async debugDevicesProviderRuntime(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.debugDevicesProviderRuntime();
            return new Success(ctx, {
                message: "Successfully fetched Find My provider runtime diagnostics!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My provider runtime diagnostics!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async refreshItems(ctx: RouterContext, _: Next) {
        try {
            const locations = await FindMyInterface.refreshItems();
            return new Success(ctx, {
                message: "Successfully refreshed Find My item locations!",
                data: locations
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to refresh Find My item locations!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async refreshFriends(ctx: RouterContext, _: Next) {
        try {
            const locations = await FindMyInterface.refreshFriends();
            await FindMyRouter.emitFriendLocations(locations);
            return new Success(ctx, {
                message: "Successfully refreshed Find My friends locations!",
                data: locations
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to refresh Find My friends locations!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async debugSearchParty(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.debugSearchParty();
            return new Success(ctx, {
                message: "Successfully fetched Find My SearchParty diagnostics!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My SearchParty diagnostics!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyBeaconProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyBeaconProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty beacon probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty beacon probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async searchPartyBeaconProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.getSearchPartyBeaconProbe();
            return new Success(ctx, {
                message: "Successfully fetched Find My SearchParty beacon probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My SearchParty beacon probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationLatestSingleProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationLatestSingleProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty latest single location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty latest single location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationSourceSubsetProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationSourceSubsetProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty source subset location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty source subset location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationProxyContextProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationProxyContextProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty proxy context location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty proxy context location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationLiveRequestProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationLiveRequestProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty live request location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty live request location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationResolveIdentifiersProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationResolveIdentifiersProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty identifier resolution probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty identifier resolution probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationResolveContextUuidProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationResolveContextUuidProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty context UUID identifier resolution probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty context UUID identifier resolution probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationResolveStableIdentifierProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationResolveStableIdentifierProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty stable identifier resolution probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty stable identifier resolution probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationResolvedBeaconLocationProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationResolvedBeaconLocationProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty resolved beacon location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty resolved beacon location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationContextSingleIdentifierProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationContextSingleIdentifierProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty single identifier context probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty single identifier context probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationLastOnlineIdentifiersProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationLastOnlineIdentifiersProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty last-online identifiers probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty last-online identifiers probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationCallbackWatchProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationCallbackWatchProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty callback watch probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty callback watch probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationCallbackWatchFullContextProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationCallbackWatchFullContextProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty full context callback watch probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty full context callback watch probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationDeviceEventWatchProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationDeviceEventWatchProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty device event watch probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty device event watch probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationDelegatedContextProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationDelegatedContextProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty delegated context probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty delegated context probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationDelegatedWatchProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.startSearchPartyLocationDelegatedWatchProbe();
            return new Success(ctx, {
                message: "Successfully started Find My SearchParty delegated watch probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty delegated watch probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async startSearchPartyLocationDelegatedCheckpointProbe(ctx: RouterContext, _: Next) {
        try {
            const checkpoint = ctx.params.checkpoint;
            const data = await FindMyInterface.startSearchPartyLocationDelegatedCheckpointProbe(checkpoint);
            return new Success(ctx, {
                message: `Successfully started Find My SearchParty delegated checkpoint probe (${checkpoint})!`,
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to start Find My SearchParty delegated checkpoint probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async searchPartyLocationProbe(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.getSearchPartyLocationProbe();
            return new Success(ctx, {
                message: "Successfully fetched Find My SearchParty location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My SearchParty location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async searchPartyLocationProbeCompact(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.getSearchPartyLocationProbeCompact();
            return new Success(ctx, {
                message: "Successfully fetched compact Find My SearchParty location probe!",
                data
            }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch compact Find My SearchParty location probe!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async devices(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.getDevices();
            return new Success(ctx, { message: "Successfully fetched Find My device locations!", data }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My device locations!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async items(ctx: RouterContext, _: Next) {
        try {
            const data = await FindMyInterface.getItems();
            return new Success(ctx, { message: "Successfully fetched Find My item locations!", data }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My item locations!",
                error: ex?.message ?? ex.toString()
            });
        }
    }

    static async friends(ctx: RouterContext, _: Next) {
        try {
            const data: any = await FindMyInterface.getFriends();
            return new Success(ctx, { message: "Successfully fetched Find My friends locations!", data }).send();
        } catch (ex: any) {
            throw new ServerError({
                message: "Failed to fetch Find My friends locations!",
                error: ex?.message ?? ex.toString()
            });
        }
    }
}
