export async function getRoomToken(params: {
  room: string;
  username: string;
  metadata?: { language?: string };
}) {
  const { room, username, metadata } = params;
  const queryParams = new URLSearchParams({
    room,
    username,
  });

  if (metadata) {
    queryParams.append("metadata", JSON.stringify(metadata));
  }

  const res = await fetch(`/api/generate-token?${queryParams.toString()}`);
  if (!res.ok) throw new Error("Failed to generate token");
  const { token } = await res.json();
  return token as string;
}
