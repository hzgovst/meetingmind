import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeetingStore } from '@/stores/meetingStore';
import type { WebSocketMessage, TranscriptSegment, AISuggestion, Task } from '@/types';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketReturn {
  sendAudioChunk: (chunk: Blob) => void;
  waitForConnection: (timeout?: number) => Promise<void>;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  disconnect: () => void;
}

function getWebSocketUrl(meetingId: string): string {
  if (import.meta.env.VITE_WS_URL) {
    return `${import.meta.env.VITE_WS_URL}/ws/${meetingId}`;
  }
  // Use relative WebSocket (works with both Vite proxy and nginx proxy)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/${meetingId}`;
}

export function useWebSocket(meetingId: string | null): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const meetingIdRef = useRef(meetingId);
  meetingIdRef.current = meetingId;

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as WebSocketMessage;
        const { addTranscriptSegment, addSuggestion, addTask } = useMeetingStore.getState();
        switch (message.type) {
          case 'transcript':
            addTranscriptSegment(message.data as TranscriptSegment);
            break;
          case 'suggestion':
            addSuggestion(message.data as AISuggestion);
            break;
          case 'task':
            addTask(message.data as Task);
            break;
          case 'status':
            console.info('[WS] Status:', (message.data as { message: string }).message);
            break;
          case 'error':
            console.error('[WS] Server error:', (message.data as { message: string }).message);
            break;
        }
      } catch {
        console.warn('[WS] Failed to parse message:', event.data);
      }
    },
    [] // Store methods accessed via getState() — no stale closure risk
  );

  const connect = useCallback(() => {
    const id = meetingIdRef.current;
    if (!id || !isMountedRef.current) return;

    setConnectionStatus('connecting');
    const url = getWebSocketUrl(id);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) { ws.close(); return; }
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Exponential backoff reconnect
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;
        console.error('[WS] Connection error:', event);
        setConnectionStatus('error');
      };
    } catch {
      setConnectionStatus('error');
    }
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      isMountedRef.current = false;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (meetingId) {
      connect();
    }
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [meetingId, connect]);

  const sendAudioChunk = useCallback((chunk: Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log(`[WS] Sending audio chunk: ${chunk.size} bytes`);
      chunk.arrayBuffer().then((buffer) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(buffer);
        }
      });
    }
  }, []);

  const waitForConnection = useCallback((timeout = 10000): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      const timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error('WebSocket connection timeout'));
      }, timeout);
      const pollInterval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 50);
    });
  }, []);

  return {
    sendAudioChunk,
    waitForConnection,
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    disconnect,
  };
}
