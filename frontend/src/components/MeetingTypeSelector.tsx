import { Users, Activity, Headphones, BookOpen, ChevronDown } from 'lucide-react';
import { useMeetingStore } from '@/stores/meetingStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { MeetingType } from '@/types';

const MEETING_TYPES: { value: MeetingType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  {
    value: 'standup',
    label: 'Daily Standup',
    icon: Users,
    description: 'Daily sync, blockers, progress',
  },
  {
    value: 'production_review',
    label: 'Production Review',
    icon: Activity,
    description: 'System health, deployments, metrics',
  },
  {
    value: 'incident_support',
    label: 'Incident Support',
    icon: Headphones,
    description: 'Live incident response & RCA',
  },
  {
    value: 'knowledge_transfer',
    label: 'Knowledge Transfer',
    icon: BookOpen,
    description: 'Onboarding & documentation',
  },
];

export function MeetingTypeSelector() {
  const meetingType = useMeetingStore((s) => s.meetingType);
  const isRecording = useMeetingStore((s) => s.isRecording);
  const { setMeetingType } = useMeetingStore();

  const current = MEETING_TYPES.find((t) => t.value === meetingType) ?? MEETING_TYPES[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isRecording}
          className="gap-2 border-border/50 bg-secondary/30 hover:bg-secondary/60"
        >
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">{current.label}</span>
          <span className="sm:hidden">Type</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Meeting Type</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MEETING_TYPES.map((type) => {
          const TypeIcon = type.icon;
          return (
            <DropdownMenuItem
              key={type.value}
              onClick={() => setMeetingType(type.value)}
              className="flex items-start gap-3 py-2.5 cursor-pointer"
            >
              <TypeIcon className={`w-4 h-4 mt-0.5 shrink-0 ${meetingType === type.value ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <div className={`text-sm font-medium ${meetingType === type.value ? 'text-primary' : ''}`}>
                  {type.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{type.description}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
