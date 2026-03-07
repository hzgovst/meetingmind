import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  FileText,
  Download,
  Copy,
  ChevronDown,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useMeeting } from '@/hooks/useMeeting';
import { useMeetingStore } from '@/stores/meetingStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function buildMarkdown(store: ReturnType<typeof useMeetingStore.getState>): string {
  const { currentMeeting, transcriptSegments, tasks, summary } = store;
  const lines: string[] = [
    `# ${currentMeeting?.title ?? 'Meeting'} — ${currentMeeting?.meeting_type ?? ''}`,
    `_${new Date().toLocaleString()}_`,
    '',
  ];
  if (summary) {
    lines.push('## Executive Summary', summary.executive_summary, '');
    if (summary.key_decisions.length) {
      lines.push('## Key Decisions');
      summary.key_decisions.forEach((d) => lines.push(`- ${d}`));
      lines.push('');
    }
    if (summary.action_items.length) {
      lines.push('## Action Items');
      summary.action_items.forEach((a) =>
        lines.push(`- ${a.description}${a.owner ? ` _(${a.owner})_` : ''}`)
      );
      lines.push('');
    }
  }
  if (tasks.length) {
    lines.push('## Tasks');
    tasks.forEach((t) => lines.push(`- [${t.completed ? 'x' : ' '}] ${t.description}${t.assignee ? ` (@${t.assignee})` : ''}`));
    lines.push('');
  }
  if (transcriptSegments.length) {
    lines.push('## Transcript');
    transcriptSegments.forEach((seg) => {
      const mm = Math.floor(seg.timestamp / 60).toString().padStart(2, '0');
      const ss = Math.floor(seg.timestamp % 60).toString().padStart(2, '0');
      lines.push(`**[${mm}:${ss}] ${seg.speaker}:** ${seg.content}`);
    });
  }
  return lines.join('\n');
}

export function MeetingControls() {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(false);

  const { isRecording, isPaused, recordingDuration, currentMeeting } = useMeetingStore();
  const { startMeeting, stopMeeting, pauseMeeting, resumeMeeting, generateSummary, audioError } =
    useMeeting();

  const handleStart = useCallback(async () => {
    if (!meetingTitle.trim()) {
      setShowTitleInput(true);
      return;
    }
    setIsStarting(true);
    try {
      await startMeeting(meetingTitle.trim());
      setShowTitleInput(false);
    } catch {
      // error handled in hook
    } finally {
      setIsStarting(false);
    }
  }, [meetingTitle, startMeeting]);

  const handleStop = useCallback(async () => {
    setIsStopping(true);
    try {
      await stopMeeting();
    } finally {
      setIsStopping(false);
    }
  }, [stopMeeting]);

  const handleSummary = useCallback(async () => {
    setIsSummarizing(true);
    try {
      await generateSummary();
    } finally {
      setIsSummarizing(false);
    }
  }, [generateSummary]);

  const handleCopyMarkdown = useCallback(async () => {
    const md = buildMarkdown(useMeetingStore.getState());
    await navigator.clipboard.writeText(md);
  }, []);

  const handleDownloadMarkdown = useCallback(() => {
    const md = buildMarkdown(useMeetingStore.getState());
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="glass-panel border-t border-border/50 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Title input when not recording */}
        {!isRecording && showTitleInput && (
          <motion.input
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
            placeholder="Meeting title..."
            className="flex-1 min-w-0 bg-secondary/50 border border-border/50 rounded-md px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        )}

        {/* Start / Stop */}
        {!isRecording ? (
          <Button
            onClick={!showTitleInput ? () => setShowTitleInput(true) : handleStart}
            disabled={isStarting}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isStarting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            {showTitleInput ? 'Start Meeting' : 'New Meeting'}
          </Button>
        ) : (
          <Button
            onClick={handleStop}
            disabled={isStopping}
            variant="destructive"
            className="gap-2 recording-pulse"
          >
            {isStopping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Stop
          </Button>
        )}

        {/* Pause / Resume */}
        {isRecording && (
          <Button
            variant="outline"
            size="sm"
            onClick={isPaused ? resumeMeeting : pauseMeeting}
            className="gap-2"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        )}

        {/* Duration */}
        {isRecording && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/40 rounded-md">
            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-red-400 live-dot'}`} />
            <span className="text-sm font-mono font-medium text-foreground/90 tabular-nums">
              {formatDuration(recordingDuration)}
            </span>
          </div>
        )}

        {/* Generate Summary */}
        {currentMeeting && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSummary}
            disabled={isSummarizing}
            className="gap-2"
          >
            {isSummarizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Summary
          </Button>
        )}

        {/* Export */}
        {currentMeeting && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Meeting</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyMarkdown} className="gap-2">
                <Copy className="w-4 h-4" />
                Copy as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadMarkdown} className="gap-2">
                <FileText className="w-4 h-4" />
                Download .md
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} className="gap-2">
                <Download className="w-4 h-4" />
                Download PDF (Print)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Audio error */}
        {audioError && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 ml-auto">
            <MicOff className="w-3.5 h-3.5" />
            {audioError}
          </div>
        )}
      </div>
    </div>
  );
}
