import { runActor } from "../apify";
import type { AuctionVehicle } from "../types";
import {
  buildDefaultActorInput,
  fetchVehiclesFromUrls,
  normalizeVehicle,
  takeMax,
  type ProviderContext,
} from "./shared";

export async function fetchCopartVehicles({
  env,
}: ProviderContext): Promise<AuctionVehicle[]> {
  if (env.APIFY_TOKEN && env.APIFY_COPART_ACTOR_ID) {
    const items = await runActor<unknown>(
      env.APIFY_COPART_ACTOR_ID,
      buildDefaultActorInput(env),
      { token: env.APIFY_TOKEN },
    );

    return takeMax(
      items
        .map((item) => normalizeVehicle("copart", item))
        .filter((vehicle): vehicle is AuctionVehicle => vehicle !== null),
      env.MAX_RESULTS_PER_SOURCE,
    );
  }

  if (env.COPART_SEARCH_URLS.length === 0) {
    return [];
  }

  return fetchVehiclesFromUrls(
    "copart",
    env.COPART_SEARCH_URLS,
    env.MAX_RESULTS_PER_SOURCE,
  );
}
