export type LocalHealthNewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  language: string;
};

type LocalHealthNewsResponse = {
  articles?: LocalHealthNewsArticle[];
  error?: string;
};

export async function getLocalHealthNews(
  city: string,
  stateAbbreviation: string
): Promise<LocalHealthNewsArticle[]> {
  const params = new URLSearchParams({
    city,
    state: stateAbbreviation,
  });

  const response = await fetch(`/api/local-news?${params.toString()}`);
  const data = (await response.json()) as LocalHealthNewsResponse;

  if (!response.ok) {
    throw new Error(
      data.error ?? "Unable to retrieve local health news."
    );
  }

  return data.articles ?? [];
}
