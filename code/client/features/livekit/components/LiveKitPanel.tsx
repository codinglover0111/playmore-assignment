"use client";

import LiveKit from "./LiveKit";

export function LiveKitPanel({
  token,
  onDisconnect,
}: {
  token: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <LiveKit token={token} onDisconnect={onDisconnect} />
    </div>
  );
}
