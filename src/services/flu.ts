type FluResponse = {
  activity?: string;
};

export async function getFluData(
  stateAbbreviation: string
): Promise<string> {
  if (!stateAbbreviation) {
    return "Unknown";
  }

  try {
    const params = new URLSearchParams({
      state: stateAbbreviation,
    });
    const response = await fetch(`/api/flu?${params.toString()}`);

    if (!response.ok) {
      return "Unknown";
    }

    const data = (await response.json()) as FluResponse;

    return data.activity ?? "Unknown";
  } catch {
    return "Unknown";
  }
}
