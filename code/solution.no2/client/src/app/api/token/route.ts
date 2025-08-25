import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const baseUrl = process.env.TOKEN_SERVER_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${baseUrl}/token`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { status_code: 500, message: "error", token: null },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { status_code: 500, message: "error", token: null },
      { status: 500 }
    );
  }
}
