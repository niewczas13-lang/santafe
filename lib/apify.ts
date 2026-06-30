type RunActorOptions = {
  token: string;
  timeoutMs?: number;
};

export async function runActor<TItem>(
  actorId: string,
  input: unknown,
  options: RunActorOptions,
): Promise<TItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 90_000,
  );

  const encodedActorId = actorId.replace(/\//g, "~");
  const url = new URL(
    `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items`,
  );
  url.searchParams.set("token", options.token);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Apify actor ${actorId} returned ${response.status}: ${body.slice(
          0,
          300,
        )}`,
      );
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new Error(`Apify actor ${actorId} returned an unexpected format`);
    }

    return data as TItem[];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Apify actor ${actorId} timed out`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
