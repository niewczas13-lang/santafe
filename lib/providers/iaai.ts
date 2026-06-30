import { runActor } from "../apify";
import type { AuctionVehicle } from "../types";
import {
  buildDefaultActorInput,
  fetchVehiclesFromUrls,
  normalizeVehicle,
  takeMax,
  type ProviderContext,
} from "./shared";

export async function fetchIaaiVehicles({
  env,
}: ProviderContext): Promise<AuctionVehicle[]> {
  if (env.APIFY_TOKEN && env.APIFY_IAAI_ACTOR_ID) {
    const items = await runActor<unknown>(
      env.APIFY_IAAI_ACTOR_ID,
      buildDefaultActorInput(env),
      { token: env.APIFY_TOKEN },
    );

    return takeMax(
      items
        .map((item) => normalizeVehicle("iaai", item))
        .filter((vehicle): vehicle is AuctionVehicle => vehicle !== null),
      env.MAX_RESULTS_PER_SOURCE,
    );
  }

  if (env.IAAI_SEARCH_URLS.length === 0) {
    return [];
  }

  return fetchVehiclesFromUrls(
    "iaai",
    env.IAAI_SEARCH_URLS,
    env.MAX_RESULTS_PER_SOURCE,
  );
}
