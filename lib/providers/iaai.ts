import { runActor } from "../apify";
import { DEFAULT_IAAI_ACTOR_ID } from "../env";
import type { AuctionVehicle } from "../types";
import {
  buildIaaiActorInput,
  buildIaaiSearchUrls,
  fetchVehiclesFromUrls,
  IAAI_DETAIL_ACTOR_ID,
  normalizeVehicle,
  takeMax,
  type ProviderContext,
} from "./shared";

export async function fetchIaaiVehicles({
  env,
}: ProviderContext): Promise<AuctionVehicle[]> {
  let actorError: unknown;

  if (env.APIFY_TOKEN && env.APIFY_IAAI_ACTOR_ID) {
    for (const actorId of buildIaaiActorFallbackChain(env.APIFY_IAAI_ACTOR_ID)) {
      try {
        const vehicles = await fetchIaaiActorVehicles(actorId, env);

        if (vehicles.length > 0) {
          return vehicles;
        }
      } catch (error) {
        actorError = error;
      }
    }
  }

  try {
    return await fetchVehiclesFromUrls(
      "iaai",
      buildIaaiSearchUrls(env),
      env.MAX_RESULTS_PER_SOURCE,
    );
  } catch (error) {
    if (actorError) {
      throw actorError;
    }

    throw error;
  }
}

async function fetchIaaiActorVehicles(
  actorId: string,
  env: ProviderContext["env"],
): Promise<AuctionVehicle[]> {
  if (!env.APIFY_TOKEN) {
    return [];
  }

  const items = await runActor<unknown>(
    actorId,
    buildIaaiActorInput(env, actorId),
    { token: env.APIFY_TOKEN },
  );

  return takeMax(
    items
      .map((item) => normalizeVehicle("iaai", item))
      .filter((vehicle): vehicle is AuctionVehicle => vehicle !== null),
    env.MAX_RESULTS_PER_SOURCE,
  );
}

function buildIaaiActorFallbackChain(configuredActorId: string): string[] {
  const actorIds = [
    configuredActorId,
    DEFAULT_IAAI_ACTOR_ID,
    IAAI_DETAIL_ACTOR_ID,
  ];

  return [...new Set(actorIds)];
}
