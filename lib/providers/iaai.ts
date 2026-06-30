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

const IAAI_FAST_ACTOR_TIMEOUT_MS = 35_000;

export async function fetchIaaiVehicles({
  env,
}: ProviderContext): Promise<AuctionVehicle[]> {
  const actorErrors: string[] = [];

  if (env.APIFY_TOKEN && env.APIFY_IAAI_ACTOR_ID) {
    for (const actorId of buildIaaiActorFallbackChain(env.APIFY_IAAI_ACTOR_ID)) {
      try {
        const vehicles = await fetchIaaiActorVehicles(actorId, env);

        if (vehicles.length > 0) {
          return vehicles;
        }
      } catch (error) {
        actorErrors.push(formatActorError(actorId, error));
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
    if (actorErrors.length > 0) {
      throw new Error(
        `IAAI actor attempts failed: ${actorErrors.join(
          " | ",
        )}; direct fallback failed: ${formatError(error)}`,
      );
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
    {
      token: env.APIFY_TOKEN,
      timeoutMs: getIaaiActorTimeoutMs(actorId),
    },
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

function getIaaiActorTimeoutMs(actorId: string): number | undefined {
  return actorId === DEFAULT_IAAI_ACTOR_ID
    ? IAAI_FAST_ACTOR_TIMEOUT_MS
    : undefined;
}

function formatActorError(actorId: string, error: unknown): string {
  return `${actorId}: ${formatError(error)}`;
}

function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 300);
}
