"use client";

import { useState } from "react";
import { getRoomToken } from "../services/token";

export function useRoomToken() {
  const [token, setToken] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async (params: {
    room: string;
    username: string;
    metadata?: { language?: string };
  }) => {
    try {
      setIsConnecting(true);
      setError(null);
      const t = await getRoomToken(params);
      setToken(t);
    } catch (e) {
      setError((e as Error).message);
      setToken("");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => setToken("");

  return { token, isConnecting, error, connect, disconnect };
}
