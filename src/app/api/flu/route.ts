import { NextResponse } from "next/server";
import { stateMap } from "../../../lib/states";

const CDC_FLU_URL =
  "https://data.cdc.gov/api/v3/views/f3zz-zga5/query.json";

type FluRecord = {
  geography?: string;
  label?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stateAbbreviation = searchParams.get("state")?.trim().toUpperCase();

  if (!stateAbbreviation) {
    return NextResponse.json(
      { activity: "Unknown", error: "State is required." },
      { status: 400 }
    );
  }

  const stateName = stateMap[stateAbbreviation];

  if (!stateName) {
    return NextResponse.json({ activity: "Unknown" });
  }

  try {
    const response = await fetch(CDC_FLU_URL, {
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { activity: "Unknown", error: "CDC flu data is unavailable." },
        { status: 200 }
      );
    }

    const data = (await response.json()) as FluRecord[];
    const record = data.find((item) => item.geography === stateName);

    return NextResponse.json({ activity: record?.label ?? "Unknown" });
  } catch {
    return NextResponse.json(
      { activity: "Unknown", error: "CDC flu data is unavailable." },
      { status: 200 }
    );
  }
}
