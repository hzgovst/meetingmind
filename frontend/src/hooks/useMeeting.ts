import { useCallback, useEffect, useRef } from 'react';
import { useMeetingStore } from '@/stores/meetingStore';
import { useAudioCapture } from './useAudioCapture';
import { useWebSocket } from './useWebSocket';
import { api } from '@/services/api';

export function useMeeting() {
  const store = useMeetingStore();
  const { startRecording, stopRecording, pauseRecording, resumeRecording, audioLevel, error: audioError } =
    useAudioCapture();
  const { sendAudioChunk, waitForConnection, isConnected, connectionStatus, disconnect } = useWebSocket(
    store.currentMeeting?.id ?? null
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    store.setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      store.setRecordingDuration(useMeetingStore.getState().recordingDuration + 1);
    }, 1000);
  }, [store]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startMeeting = useCallback(
    async (title: string) => {
      try {
        const meeting = await api.createMeeting(title, store.meetingType);
        store.setCurrentMeeting(meeting);
        store.setIsRecording(true);
        store.setIsPaused(false);
        startTimer();
        await waitForConnection();
        await startRecording(sendAudioChunk);
      } catch (err) {
        console.error('Failed to start meeting:', err);
        throw err;
      }
    },
    [store, startTimer, startRecording, sendAudioChunk, waitForConnection]
  );

  const stopMeeting = useCallback(async () => {
    stopRecording();
    stopTimer();
    store.setIsRecording(false);
    store.setIsPaused(false);
    disconnect();

    if (store.currentMeeting) {
      try {
        await api.updateMeeting(store.currentMeeting.id, { status: 'completed' });
      } catch (err) {
        console.error('Failed to update meeting status:', err);
      }
    }
  }, [stopRecording, stopTimer, store, disconnect]);

  const pauseMeeting = useCallback(() => {
    pauseRecording();
    stopTimer();
    store.setIsPaused(true);
  }, [pauseRecording, stopTimer, store]);

  const resumeMeeting = useCallback(() => {
    resumeRecording();
    startTimer();
    store.setIsPaused(false);
  }, [resumeRecording, startTimer, store]);

  const generateSummary = useCallback(async () => {
    if (!store.currentMeeting) return;
    try {
      const summary = await api.generateSummary(store.currentMeeting.id);
      store.setSummary(summary);
      store.setShowSummary(true);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      throw err;
    }
  }, [store]);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  return {
    startMeeting,
    stopMeeting,
    pauseMeeting,
    resumeMeeting,
    generateSummary,
    audioLevel,
    audioError,
    isConnected,
    connectionStatus,
  };
}
