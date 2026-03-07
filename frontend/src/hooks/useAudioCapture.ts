import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioCaptureReturn {
  startRecording: (onChunk: (chunk: Blob) => void) => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  audioLevel: number;
  isSupported: boolean;
  error: string | null;
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const onChunkRef = useRef<((chunk: Blob) => void) | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    setAudioLevel(Math.round((average / 255) * 100));
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = useCallback(
    async (onChunk: (chunk: Blob) => void) => {
      setError(null);
      onChunkRef.current = onChunk;

      if (!isSupported) {
        setError('Audio recording is not supported in this browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        });
        streamRef.current = stream;

        // Set up audio analyser for visualisation
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && onChunkRef.current) {
            onChunkRef.current(event.data);
          }
        };

        recorder.start(1000);
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone permission denied. Please allow microphone access.'
            : err instanceof Error
            ? err.message
            : 'Failed to start audio capture.';
        setError(message);
      }
    },
    [isSupported, updateAudioLevel]
  );

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [updateAudioLevel]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return { startRecording, stopRecording, pauseRecording, resumeRecording, audioLevel, isSupported, error };
}
