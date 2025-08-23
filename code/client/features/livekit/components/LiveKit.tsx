"use client";

import * as React from "react";
import {
  RoomAudioRenderer,
  RoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import { Room } from "livekit-client";
import { useEffect, useMemo, useCallback } from "react";
import MicrophoneVisual from "./MicrophoneVisual";
import Transcripts from "./Transcripts";
import "@livekit/components-styles";
export default function LiveKit({
  token,
  onDisconnect,
}: {
  token: string;
  onDisconnect: () => void;
}) {
  const room = useMemo(() => new Room(), []);
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_SERVER_URL || "";

  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant({
    room,
  });

  const handleToggleMicrophone = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (error) {
      console.error("Error toggling microphone:", error);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  useEffect(() => {
    const doConnect = async () => {
      try {
        await room.connect(serverUrl, token);
        await room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: true,
        });
      } catch (error) {
        console.error("Error connecting to agent:", error);
      }
    };

    doConnect();
  }, [room, serverUrl, token]);

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
      <div className="w-full h-40">
        <MicrophoneVisual />
      </div>
      <div className="flex flex-col gap-2">
        <Transcripts />
      </div>
      <button onClick={handleToggleMicrophone}>
        {isMicrophoneEnabled ? "Mute mic" : "Unmute mic"}
      </button>
      <button
        onClick={async () => {
          await room.disconnect();
          onDisconnect();
        }}
      >
        Disconnect
      </button>
    </RoomContext.Provider>
  );
}
