import { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Copy,
  Download,
  CheckCircle,
  HelpCircle,
  Zap,
  X,
} from 'lucide-react';
import { useMeetingStore } from '@/stores/meetingStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export function MeetingSummary() {
  const summary = useMeetingStore((s) => s.summary);
  const currentMeeting = useMeetingStore((s) => s.currentMeeting);
  const { setShowSummary } = useMeetingStore();

  if (!summary) return null;

  const buildMarkdown = () => {
    const lines = [
      `# Meeting Summary — ${currentMeeting?.title ?? 'Meeting'}`,
      `_Generated ${new Date().toLocaleString()}_`,
      '',
      '## Executive Summary',
      summary.executive_summary,
      '',
    ];
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
    if (summary.follow_up_questions.length) {
      lines.push('## Follow-up Questions');
      summary.follow_up_questions.forEach((q) => lines.push(`- ${q}`));
    }
    return lines.join('\n');
  };

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(buildMarkdown());
  }, [summary]);

  const handleDownload = useCallback(() => {
    const md = buildMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [summary]);

  const handlePrint = () => window.print();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setShowSummary(false); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-background border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Meeting Summary</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy Markdown">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDownload} title="Download .md">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePrint} title="Print / Save as PDF">
              <FileText className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" onClick={() => setShowSummary(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            {/* Executive summary */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Executive Summary
              </h3>
              <p className="text-sm leading-relaxed text-foreground/90">{summary.executive_summary}</p>
            </section>

            {/* Key decisions */}
            {summary.key_decisions.length > 0 && (
              <>
                <Separator />
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Key Decisions
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {summary.key_decisions.map((decision, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                        {decision}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* Action items */}
            {summary.action_items.length > 0 && (
              <>
                <Separator />
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Action Items
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {summary.action_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                        <span className="text-foreground/90 flex-1">{item.description}</span>
                        {item.owner && (
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0">
                            {item.owner}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* Follow-up questions */}
            {summary.follow_up_questions.length > 0 && (
              <>
                <Separator />
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Follow-up Questions
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {summary.follow_up_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </motion.div>
  );
}
