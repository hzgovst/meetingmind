import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMeetingStore } from '@/stores/meetingStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranscriptSegment } from '@/types';

const SPEAKER_COLORS = [
  'text-blue-400',
  'text-emerald-400',
  'text-violet-400',
  'text-amber-400',
  'text-pink-400',
  'text-cyan-400',
];

function getSpeakerColor(speaker: string, speakerMap: Map<string, number>): string {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size % SPEAKER_COLORS.length);
  }
  return SPEAKER_COLORS[speakerMap.get(speaker)!];
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

interface TranscriptItemProps {
  segment: TranscriptSegment;
  colorClass: string;
}

function TranscriptItem({ segment, colorClass }: TranscriptItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex gap-3 py-2 px-1 rounded-md hover:bg-white/5 transition-colors group"
    >
      <span className="text-xs text-muted-foreground mt-0.5 w-10 shrink-0 font-mono">
        {formatTimestamp(segment.timestamp)}
      </span>
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-semibold uppercase tracking-wider ${colorClass} mr-2`}>
          {segment.speaker}
        </span>
        <span className="text-sm text-foreground/90 leading-relaxed">{segment.content}</span>
      </div>
    </motion.div>
  );
}

export function TranscriptPanel() {
  const transcriptSegments = useMeetingStore((s) => s.transcriptSegments);
  const isRecording = useMeetingStore((s) => s.isRecording);
  const isPaused = useMeetingStore((s) => s.isPaused);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const speakerColorMap = useRef(new Map<string, number>());

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptSegments, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
          Live Transcript
        </h2>
        <div className="flex items-center gap-2">
          {isRecording && !isPaused && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400 live-dot" />
              LIVE
            </div>
          )}
          {isPaused && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              PAUSED
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {transcriptSegments.length} segment{transcriptSegments.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="px-3 py-2 space-y-0.5"
          >
            {transcriptSegments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-3 text-muted-foreground">
                <div className="text-4xl">🎙️</div>
                <div>
                  <p className="text-sm font-medium">No transcript yet</p>
                  <p className="text-xs mt-1 opacity-70">
                    Start recording to see the live transcript
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {transcriptSegments.map((segment) => (
                  <TranscriptItem
                    key={segment.id}
                    segment={segment}
                    colorClass={getSpeakerColor(segment.speaker, speakerColorMap.current)}
                  />
                ))}
              </AnimatePresence>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && transcriptSegments.length > 0 && (
        <button
          className="absolute bottom-16 right-4 text-xs bg-primary/20 border border-primary/40 text-primary px-2 py-1 rounded-full hover:bg-primary/30 transition-colors"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          ↓ Jump to latest
        </button>
      )}
    </div>
  );
}
