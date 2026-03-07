import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Settings, ChevronDown, ChevronUp, History, Wifi, WifiOff } from 'lucide-react';
import './App.css';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { SuggestionPanel } from '@/components/SuggestionPanel';
import { TaskBoard } from '@/components/TaskBoard';
import { FileUpload } from '@/components/FileUpload';
import { MeetingControls } from '@/components/MeetingControls';
import { MeetingTypeSelector } from '@/components/MeetingTypeSelector';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { MeetingSummary } from '@/components/MeetingSummary';
import { useMeetingStore } from '@/stores/meetingStore';
import { useMeeting } from '@/hooks/useMeeting';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
      {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{isConnected ? 'Connected' : 'Offline'}</span>
    </div>
  );
}

function App() {
  const [showContext, setShowContext] = useState(false);
  const { currentMeeting, showSummary, isRecording, isPaused } = useMeetingStore();
  const { audioLevel, isConnected } = useMeeting();

  return (
    <ToastProvider>
      <div className="app-gradient min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="glass-panel border-b border-border/50 px-4 py-3 sticky top-0 z-40">
          <div className="max-w-screen-2xl mx-auto flex items-center gap-3">
            {/* Brand */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight">MeetingMind</h1>
                <p className="text-[10px] text-muted-foreground leading-none">AI</p>
              </div>
            </div>

            {/* Current meeting info */}
            {currentMeeting && (
              <div className="flex items-center gap-2 flex-1 min-w-0 ml-2">
                <Badge variant="outline" className="text-xs border-border/50 shrink-0">
                  {currentMeeting.meeting_type.replace(/_/g, ' ')}
                </Badge>
                <span className="text-sm text-foreground/70 truncate hidden md:block">
                  {currentMeeting.title}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 ml-auto">
              {/* Audio visualizer - only show when recording */}
              {isRecording && (
                <div className="hidden sm:block">
                  <AudioVisualizer
                    audioLevel={audioLevel}
                    isRecording={isRecording}
                    isPaused={isPaused}
                  />
                </div>
              )}

              <ConnectionStatus isConnected={isConnected} />
              <MeetingTypeSelector />

              {/* Context toggle */}
              <button
                onClick={() => setShowContext((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-white/5"
              >
                Context {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Context file upload — collapsible */}
          <AnimatePresence>
            {showContext && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden max-w-screen-2xl mx-auto"
              >
                <div className="pt-3 border-t border-border/30 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Context Files
                    </span>
                    <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground">
                      Optional
                    </Badge>
                  </div>
                  <FileUpload meetingId={currentMeeting?.id} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Main content */}
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-4 flex flex-col gap-4 overflow-hidden">
          {/* Two-column panel layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0" style={{ minHeight: '400px' }}>
            <TranscriptPanel />
            <SuggestionPanel />
          </div>

          {/* Task board */}
          <TaskBoard />
        </main>

        {/* Sticky bottom controls */}
        <div className="sticky bottom-0 z-30 max-w-screen-2xl mx-auto w-full">
          <MeetingControls />
        </div>

        {/* Meeting summary modal */}
        <AnimatePresence>
          {showSummary && <MeetingSummary />}
        </AnimatePresence>
      </div>

      <ToastViewport />
    </ToastProvider>
  );
}

export default App;
