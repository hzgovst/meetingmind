import { motion } from 'framer-motion';

const BAR_COUNT = 20;

interface AudioVisualizerProps {
  audioLevel: number;
  isRecording: boolean;
  isPaused: boolean;
}

export function AudioVisualizer({ audioLevel, isRecording, isPaused }: AudioVisualizerProps) {
  const active = isRecording && !isPaused;

  return (
    <div className="flex items-center justify-center gap-0.5 h-8" aria-label="Audio level visualizer">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        // Create a wave-like distribution of heights
        const position = i / BAR_COUNT;
        const waveFactor = Math.sin(position * Math.PI);
        const noise = active ? (Math.random() * 0.4 + 0.6) : 1;
        const targetHeight = active
          ? Math.max(4, (audioLevel / 100) * 28 * waveFactor * noise)
          : 4;

        return (
          <motion.div
            key={i}
            className={`w-[3px] rounded-full ${active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            animate={{ height: targetHeight }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              delay: i * 0.01,
            }}
            style={{ minHeight: 4 }}
          />
        );
      })}
    </div>
  );
}
