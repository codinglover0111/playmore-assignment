"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveSession = any; // '@google/genai' 타입을 사용할 수 없을 때 임시 대체
type Language = "ko" | "en" | "ja" | "";

export default function Home() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>("ko");
  const [promptText, setPromptText] = useState<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  const appendMsg = useCallback((text: string) => {
    setMessages((prev) => [...prev, text]);
  }, []);

  const clearLogs = useCallback(() => {
    setMessages([]);
  }, []);

  const defaultPrompts: Record<"ko" | "en" | "ja", string> = {
    ko: "모든 입력을 한국어로 번역하시오.",
    en: "한국어로 들리는 모든 내용을 영어로 번역하시오.",
    ja: "한국어로 들리는 모든 내용을 일본어로 번역하시오.",
  };

  useEffect(() => {
    const key: "ko" | "en" | "ja" =
      language === "ko" || language === "en" || language === "ja"
        ? language
        : "ko";
    setPromptText(defaultPrompts[key]);
  }, [language]);

  const findFirstStringByKeys = (obj: any, keys: string[]): string | null => {
    if (obj == null) return null;
    if (typeof obj === "string") return obj;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const foundInItem = findFirstStringByKeys(item, keys);
        if (foundInItem) return foundInItem;
      }
      return null;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        if (keys.includes(k) && typeof v === "string" && v.trim().length > 0) {
          return v as string;
        }
        const nested = findFirstStringByKeys(v, keys);
        if (nested) return nested;
      }
    }
    return null;
  };

  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  };

  const downsampleTo16k = (
    input: Float32Array,
    inputSampleRate: number,
    outputSampleRate = 16000
  ) => {
    if (outputSampleRate === inputSampleRate) {
      return floatTo16BitPCM(input);
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(input.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      // 간단한 평균 다운샘플링
      let accum = 0;
      let count = 0;
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < input.length;
        i++
      ) {
        accum += input[i];
        count++;
      }
      const value = count > 0 ? accum / count : 0;
      result[offsetResult] = value < 0 ? value * 0x8000 : value * 0x7fff;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const toBase64 = (pcm: Int16Array) => {
    const u8 = new Uint8Array(pcm.buffer);
    let binary = "";
    for (let i = 0; i < u8.byteLength; i++)
      binary += String.fromCharCode(u8[i]);
    // eslint-disable-next-line no-undef
    return btoa(binary);
  };

  const start = useCallback(async () => {
    if (connecting || connected) return;
    setConnecting(true);
    try {
      // 1) 임시 토큰 요청 (Next.js API 라우트 프록시 '/api/token')
      const tokenRes = await fetch("/api/token", { method: "GET" });
      if (!tokenRes.ok) throw new Error("토큰 요청 실패");
      const tokenJson = await tokenRes.json();
      if (!tokenJson?.token) throw new Error("토큰이 없습니다");

      // 2) 동적 임포트로 클라이언트에서만 라이브러리 사용
      const { GoogleGenAI, Modality } = await import("@google/genai");

      // 3) Live API 연결
      const ai = new GoogleGenAI({
        apiKey: tokenJson.token,
        httpOptions: { apiVersion: "v1alpha" },
      });
      const model = "gemini-2.5-flash-live-preview";
      const key: "ko" | "en" | "ja" =
        language === "ko" || language === "en" || language === "ja"
          ? language
          : "ko";
      const config = {
        responseModalities: [Modality.TEXT],
        systemInstruction: promptText || defaultPrompts[key],
      };

      const session = await ai.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => appendMsg("세션 연결됨"),
          onmessage: (message: any) => {
            // 모델 출력 텍스트
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

            // 입력 음성 트랜스크립트
            const transcript =
              (message?.serverContent &&
                (message?.serverContent?.inputTranscription ||
                  message?.serverContent?.transcript ||
                  message?.serverContent?.transcription)) ||
              message?.inputTranscription ||
              message?.transcript ||
              message?.transcription;
            // Transcript 박스 제거에 따라 화면 표시는 생략
          },
          onerror: (e: any) => appendMsg(`에러: ${e?.message || e}`),
          onclose: () => appendMsg("세션 종료됨"),
        },
      });
      sessionRef.current = session;

      // 4) 마이크 캡처 및 오디오 스트리밍
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = media;

      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // AudioWorklet 모듈 로드 및 노드 연결
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
          } catch (e) {}
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
  }, [appendMsg, connected, connecting, language, promptText]);

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
          audioContextRef.current.close();
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
      // 언마운트 시 정리
      stop();
    };
  }, [stop]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Gemini Live API Mic Sample</h1>

      <div className="mb-4 grid gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">언어</label>
          <select
            className="px-2 py-1 border rounded text-sm bg-white text-black dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            disabled={connecting || connected}
          >
            <option value="" disabled>
              언어 선택
            </option>
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">
            연결 전 프롬프트
          </label>
          <textarea
            className="w-full border rounded p-2 text-sm h-24"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="역할/스타일/제약 등을 자유롭게 작성하세요"
            disabled={connecting || connected}
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          className="px-3 py-2 rounded bg-black text-white border border-gray-300 dark:bg-white dark:text-black dark:border-white disabled:opacity-50"
          onClick={start}
          disabled={connecting || connected}
        >
          {connecting ? "연결 중..." : "마이크 시작"}
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-200 text-black border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-500 disabled:opacity-50"
          onClick={endTurn}
          disabled={!connected}
        >
          턴 종료
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-200 text-black border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-500"
          onClick={stop}
          disabled={!connected}
        >
          연결 종료
        </button>
        <button
          className="px-3 py-2 rounded bg-transparent text-gray-700 border border-gray-300 dark:text-gray-200 dark:border-gray-600"
          onClick={clearLogs}
          disabled={messages.length === 0}
        >
          로그 지우기
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">로그</h2>
        <div className="border rounded p-3 h-40 overflow-auto text-sm whitespace-pre-wrap">
          {messages.length === 0 ? (
            <span className="text-gray-500">로그가 여기에 표시됩니다.</span>
          ) : (
            messages.map((m, i) => <div key={i}>{m}</div>)
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        참고: Live API 자바스크립트 가이드
        <a
          className="underline ml-1"
          href="https://ai.google.dev/gemini-api/docs/live?hl=ko#javascript"
          target="_blank"
          rel="noreferrer"
        >
          https://ai.google.dev/gemini-api/docs/live?hl=ko#javascript
        </a>
      </p>
    </div>
  );
}
