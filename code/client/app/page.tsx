"use client";

import { useRoomToken } from "@/features/livekit/hooks/useRoomToken";
import { LiveKitPanel } from "@/features/livekit/components/LiveKitPanel";

export default function Home() {
  const { token, isConnecting, error, connect, disconnect } = useRoomToken();

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {token ? (
        <LiveKitPanel token={token} onDisconnect={disconnect} />
      ) : (
        <button
          disabled={isConnecting}
          onClick={() =>
            connect({
              room: `room-${Math.random().toString(36).slice(2, 8)}`,
              username: "test",
            })
          }
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </button>
      )}
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
