"use client";

import { useRoomToken } from "@/features/livekit/hooks/useRoomToken";
import { LiveKitPanel } from "@/features/livekit/components/LiveKitPanel";
import { useState } from "react";

export default function Home() {
  const { token, isConnecting, error, connect, disconnect } = useRoomToken();
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {token ? (
        <LiveKitPanel token={token} onDisconnect={disconnect} />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold">LiveKit 에이전트 연결</h1>

          <div className="flex flex-col gap-2">
            <label htmlFor="language" className="text-sm font-medium">
              언어 선택:
            </label>
            <select
              id="language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">영어 (English)</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="ja">일본어 (Japanese)</option>
              <option value="zh">중국어 (Chinese)</option>
              <option value="es">스페인어 (Spanish)</option>
            </select>
          </div>

          <button
            disabled={isConnecting}
            onClick={() =>
              connect({
                room: `room-${Math.random().toString(36).slice(2, 8)}`,
                username: "test",
                metadata: {
                  language: selectedLanguage,
                },
              })
            }
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
          >
            {isConnecting ? "연결 중..." : "연결하기"}
          </button>
        </div>
      )}
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
