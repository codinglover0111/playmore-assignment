"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// AudioWorklet로 대체하므로 기존 변환 유틸은 사용하지 않음

type LiveSession = any; // 런타임 전용 라이브러리로 타입 단순화

export type SupportedLanguage = "ko" | "en" | "ja";

export interface UseGeminiLiveMicOptions {
  language: SupportedLanguage;
  systemInstruction?: string;
}

export function useGeminiLiveMic(options: UseGeminiLiveMicOptions) {
  const { language, systemInstruction } = options;

  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  const appendMsg = useCallback((text: string) => {
    setMessages((prev) => [...prev, text]);
  }, []);

  const clearLogs = useCallback(() => setMessages([]), []);

  const prompts: Record<SupportedLanguage, string> = {
    ko: "모든 입력을 한국어로 번역하시오.",
    en: "한국어로 들리는 모든 내용을 영어로 번역하시오.",
    ja: "한국어로 들리는 모든 내용을 일본어로 번역하시오.",
  };

  const start = useCallback(async () => {
    if (connecting || connected) return;
    setConnecting(true);
    try {
      const tokenRes = await fetch("/api/token");
      if (!tokenRes.ok) throw new Error("토큰 요청 실패");
      const tokenJson = await tokenRes.json();
      if (!tokenJson?.token) throw new Error("토큰이 없습니다");

      const { GoogleGenAI, Modality } = await import("@google/genai");

      const ai = new GoogleGenAI({
        apiKey: tokenJson.token,
        httpOptions: { apiVersion: "v1alpha" },
      });
      const model = "gemini-2.5-flash-live-preview";
      const config: any = {
        responseModalities: [Modality.TEXT],
        systemInstruction: systemInstruction || prompts[language],
      };

      const session = await ai.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => appendMsg("세션 연결됨"),
          onmessage: (message: any) => {
            const text =
              message?.text ||
              message?.serverContent?.modelTurn?.text ||
              (Array.isArray(message?.serverContent?.modelTurn?.parts)
                ? message?.serverContent?.modelTurn?.parts
                    ?.map((p: any) => p?.text || "")
                    ?.join("") || undefined
                : undefined);
            if (typeof text === "string" && text.trim().length > 0) {
              appendMsg(`모델: ${text}`);
            }
          },
          onerror: (e: any) => appendMsg(`에러: ${e?.message || e}`),
          onclose: () => appendMsg("세션 종료됨"),
        },
      });

      sessionRef.current = session;

      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = media;

      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // AudioWorklet 모듈 추가 후 노드 생성
      try {
        await audioContext.audioWorklet.addModule("/mic-worklet.js");
      } catch (e) {
        throw new Error("AudioWorklet 모듈 로드 실패");
      }

      const workletNode = new AudioWorkletNode(audioContext, "mic-processor");
      workletNode.port.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { type: string; pcm16?: ArrayBuffer };
        if (msg?.type === "audio-chunk" && msg.pcm16) {
          const pcm = new Int16Array(msg.pcm16);
          const view = new Uint8Array(pcm.buffer);
          let binary = "";
          for (let i = 0; i < view.byteLength; i++)
            binary += String.fromCharCode(view[i]);
          // eslint-disable-next-line no-undef
          const base64 = btoa(binary);
          try {
            session.sendRealtimeInput({
              audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
            });
          } catch {}
        }
      };
      workletNodeRef.current = workletNode;

      const source = audioContext.createMediaStreamSource(media);
      source.connect(workletNode);
      setConnected(true);
    } catch (e: any) {
      appendMsg(`시작 실패: ${e?.message || e}`);
      await stop();
    } finally {
      setConnecting(false);
    }
  }, [appendMsg, connected, connecting, language, systemInstruction]);

  const endTurn = useCallback(() => {
    try {
      sessionRef.current?.sendRealtimeInput({ turnComplete: true } as any);
      appendMsg("턴 종료 신호 전송");
    } catch (e: any) {
      appendMsg(`턴 종료 실패: ${e?.message || e}`);
    }
  }, [appendMsg]);

  const stop = useCallback(async () => {
    try {
      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.disconnect();
        } catch {}
      }
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch {}
      }
    } finally {
      workletNodeRef.current = null;
      audioContextRef.current = null;
      mediaStreamRef.current = null;
      sessionRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    connecting,
    connected,
    messages,
    start,
    stop,
    endTurn,
    clearLogs,
  } as const;
}
