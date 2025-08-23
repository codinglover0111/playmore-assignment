export async function getRoomToken(params: { room: string; username: string }) {
  const { room, username } = params;
  const res = await fetch(
    `/api/generate-token?room=${encodeURIComponent(
      room
    )}&username=${encodeURIComponent(username)}`
  );
  if (!res.ok) throw new Error("Failed to generate token");
  const { token } = await res.json();
  return token as string;
}
