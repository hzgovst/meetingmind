import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Lightbulb, AlertTriangle, Copy, X, Check } from 'lucide-react';
import { useMeetingStore } from '@/stores/meetingStore';
import { api } from '@/services/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AISuggestion, SuggestionType } from '@/types';

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onDismiss: (id: string) => void;
}

const TYPE_CONFIG: Record<
  SuggestionType,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }
> = {
  ask_about: {
    icon: MessageCircle,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  suggest: {
    icon: Lightbulb,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  alert: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
};

function SuggestionCard({ suggestion, onDismiss }: SuggestionCardProps) {
  const [copied, setCopied] = useState(false);
  const config = TYPE_CONFIG[suggestion.suggestion_type];
  const Icon = config.icon;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(suggestion.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`rounded-lg border p-3 ${config.bg} ${config.border} group`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
        <p className="text-sm text-foreground/90 leading-relaxed flex-1">{suggestion.content}</p>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => onDismiss(suggestion.id)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function SuggestionPanel() {
  const suggestions = useMeetingStore((s) => s.suggestions);
  const currentMeeting = useMeetingStore((s) => s.currentMeeting);
  const { dismissSuggestion } = useMeetingStore();

  const active = suggestions.filter((s) => !s.dismissed);
  const questions = active.filter((s) => s.suggestion_type === 'ask_about');
  const ideas = active.filter((s) => s.suggestion_type === 'suggest');
  const alerts = active.filter((s) => s.suggestion_type === 'alert');

  const handleDismiss = async (id: string) => {
    dismissSuggestion(id);
    if (currentMeeting) {
      await api.dismissSuggestion(currentMeeting.id, id).catch(console.error);
    }
  };

  const renderList = (items: AISuggestion[], emptyMsg: string) => (
    <ScrollArea className="h-full">
      <div className="space-y-2 px-1 py-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-muted-foreground text-center">
            <p className="text-sm">{emptyMsg}</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {items.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} onDismiss={handleDismiss} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-full glass-panel rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
          AI Suggestions
        </h2>
      </div>

      <Tabs defaultValue="questions" className="flex flex-col flex-1 overflow-hidden px-3 pt-2">
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="questions" className="flex-1 gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            Questions
            {questions.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                {questions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ideas" className="flex-1 gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />
            Ideas
            {ideas.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                {ideas.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1 gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden mt-2">
          <TabsContent value="questions" className="h-full m-0">
            {renderList(questions, 'No questions suggested yet')}
          </TabsContent>
          <TabsContent value="ideas" className="h-full m-0">
            {renderList(ideas, 'No ideas suggested yet')}
          </TabsContent>
          <TabsContent value="alerts" className="h-full m-0">
            {renderList(alerts, 'No alerts raised')}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
