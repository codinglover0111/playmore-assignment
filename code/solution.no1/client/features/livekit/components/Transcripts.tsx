"use client";

import { useTranscriptions } from "@livekit/components-react";

export default function Transcripts() {
  const transcriptions = useTranscriptions();
  return (
    <div className="flex flex-col gap-2 w-full h-full overflow-auto p-2">
      {transcriptions.map((transcription, idx) => (
        <div key={`${transcription.participantInfo.identity}-${idx}`}>
          {transcription.participantInfo.identity}: {transcription.text}
        </div>
      ))}
    </div>
  );
}
