import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Square, User, ClipboardList } from 'lucide-react';
import { useMeetingStore } from '@/stores/meetingStore';
import { api } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function TaskBoard() {
  const tasks = useMeetingStore((s) => s.tasks);
  const currentMeeting = useMeetingStore((s) => s.currentMeeting);
  const { updateTask } = useMeetingStore();

  const handleToggle = async (taskId: string, currentCompleted: boolean) => {
    updateTask(taskId, !currentCompleted);
    if (currentMeeting) {
      await api.updateTask(currentMeeting.id, taskId, !currentCompleted).catch((err) => {
        // Revert optimistic update
        updateTask(taskId, currentCompleted);
        console.error('Failed to update task:', err);
      });
    }
  };

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
            Action Items
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{pending.length} pending</span>
          {completed.length > 0 && <span>· {completed.length} done</span>}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-center gap-2">
          <p className="text-sm">No action items extracted yet</p>
          <p className="text-xs opacity-70">Tasks mentioned in the meeting will appear here</p>
        </div>
      ) : (
        <ScrollArea className="max-h-48">
          <div className="p-3 space-y-1">
            <AnimatePresence initial={false}>
              {[...pending, ...completed].map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-white/5 transition-colors group cursor-pointer"
                  onClick={() => handleToggle(task.id, task.completed)}
                >
                  <div className="mt-0.5 shrink-0">
                    {task.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <span
                    className={`text-sm flex-1 leading-relaxed ${
                      task.completed ? 'line-through text-muted-foreground' : 'text-foreground/90'
                    }`}
                  >
                    {task.description}
                  </span>
                  {task.assignee && (
                    <Badge
                      variant="outline"
                      className="shrink-0 text-xs gap-1 border-border/50 text-muted-foreground"
                    >
                      <User className="w-3 h-3" />
                      {task.assignee}
                    </Badge>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
