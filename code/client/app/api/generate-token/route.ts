import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const room = searchParams.get("room");
  const username = searchParams.get("username");
  const metadataParam = searchParams.get("metadata");

  if (!room || !username) {
    return NextResponse.json(
      { error: "Missing 'room' or 'username' query parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  let metadata = "";
  if (metadataParam) {
    try {
      metadata = metadataParam;
    } catch (e) {
      console.error("Failed to parse metadata:", e);
    }
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    metadata: metadata,
  });

  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  const token = await at.toJwt();

  return NextResponse.json({ token });
}
