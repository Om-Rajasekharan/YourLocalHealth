import { NextResponse } from "next/server";
import { stateMap } from "../../../lib/states";
import type { LocalHealthNewsArticle } from "../../../services/localNews";

const GDELT_DOC_API_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc";
const GOOGLE_NEWS_RSS_URL =
  "https://news.google.com/rss/search";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
};

type GdeltResponse = {
  articles?: GdeltArticle[];
};

function formatGdeltDate(date: string | undefined) {
  if (!date) return "Date unavailable";

  const normalized = /^\d{8}T\d{6}Z$/.test(date)
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(
        6,
        8
      )}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(
        13,
        15
      )}Z`
    : date.includes("T")
    ? date
    : `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripHtml(value: string) {
  return decodeXml(value.replace(/<[^>]*>/g, "")).trim();
}

function getTagValue(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`)
  );

  return match ? decodeXml(match[1].trim()) : "";
}

function formatRssDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date || "Date unavailable";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseGoogleNewsRss(xml: string): LocalHealthNewsArticle[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items.slice(0, 6).map((item) => {
    const sourceMatch = item.match(
      /<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/
    );

    return {
      title: stripHtml(getTagValue(item, "title")),
      url: getTagValue(item, "link"),
      source: sourceMatch
        ? stripHtml(sourceMatch[1])
        : "Google News",
      publishedAt: formatRssDate(getTagValue(item, "pubDate")),
      language: "en-US",
    };
  }).filter((article) => article.title && article.url);
}

function isRelevantHealthArticle(
  article: LocalHealthNewsArticle,
  city: string,
  stateName: string
) {
  const text = `${article.title} ${article.source}`.toLowerCase();
  const cityText = city.toLowerCase();
  const stateText = stateName.toLowerCase();
  const hasHealthTerm =
    /health|hospital|outbreak|covid|flu|air quality|wildfire|heat|public health|virus|illness|medical|clinic|vaccine|wastewater/.test(
      text
    );
  const hasLocationTerm =
    text.includes(cityText) ||
    text.includes(stateText) ||
    text.includes("unc") ||
    text.includes("chapelboro") ||
    text.includes("wunc");

  return hasHealthTerm && hasLocationTerm;
}

function mergeArticles(
  articles: LocalHealthNewsArticle[]
): LocalHealthNewsArticle[] {
  const seenUrls = new Set<string>();

  return articles.filter((article) => {
    if (seenUrls.has(article.url)) {
      return false;
    }

    seenUrls.add(article.url);
    return true;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const stateAbbreviation = searchParams.get("state");

  if (!city || !stateAbbreviation) {
    return NextResponse.json({ articles: [] });
  }

  const stateName =
    stateMap[stateAbbreviation] ?? stateAbbreviation;
  const query = [
    `("${city}" OR "${stateName}")`,
    "(health OR hospital OR outbreak OR covid OR flu OR \"air quality\" OR wildfire OR \"heat advisory\" OR \"public health\")",
  ].join(" ");

  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    format: "json",
    maxrecords: "6",
    sort: "DateDesc",
    timespan: "30d",
  });

  async function fetchGdeltArticles() {
    const response = await fetch(
      `${GDELT_DOC_API_URL}?${params.toString()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return [];
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return [];
    }

    const data = (await response.json()) as GdeltResponse;

    return (data.articles ?? [])
      .filter((article) => article.title && article.url)
      .map((article) => ({
        title: article.title ?? "Untitled article",
        url: article.url ?? "#",
        source: article.domain ?? "Unknown source",
        publishedAt: formatGdeltDate(article.seendate),
        language: article.language ?? "Unknown",
      }));
  }

  async function fetchGoogleNewsArticles() {
    const googleQuery = [
      `"${city}"`,
      "(health OR hospital OR outbreak OR covid OR flu OR \"air quality\" OR wildfire OR \"heat advisory\" OR \"public health\")",
    ].join(" ");
    const googleParams = new URLSearchParams({
      q: googleQuery,
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    });
    const response = await fetch(
      `${GOOGLE_NEWS_RSS_URL}?${googleParams.toString()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return [];
    }

    return parseGoogleNewsRss(await response.text());
  }

  try {
    const [gdeltArticles, googleArticles] = await Promise.all([
      fetchGdeltArticles(),
      fetchGoogleNewsArticles(),
    ]);
    const relevantArticles = mergeArticles([
      ...gdeltArticles,
      ...googleArticles,
    ])
      .filter((article) =>
        isRelevantHealthArticle(article, city, stateName)
      )
      .slice(0, 6);

    return NextResponse.json({ articles: relevantArticles });
  } catch {
    return NextResponse.json(
      { articles: [], error: "Unable to retrieve local health news." },
      { status: 503 }
    );
  }
}
