"use client";

import { useTracks, TrackLoop, BarVisualizer } from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
export default function MicrophoneVisual() {
  const micTracks = useTracks([Track.Source.Microphone]);
  const localMicTracks = micTracks.filter(
    (trackRef) => trackRef.participant?.isLocal
  );

  if (localMicTracks.length === 0) {
    return null;
  }

  return (
    <TrackLoop tracks={localMicTracks}>
      <BarVisualizer />
    </TrackLoop>
  );
}
