export type MeetingType = 'standup' | 'production_review' | 'incident_support' | 'knowledge_transfer';
export type MeetingStatus = 'active' | 'paused' | 'completed';
export type SuggestionType = 'ask_about' | 'suggest' | 'alert';

export interface Meeting {
  id: string;
  title: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
  summary?: string;
  file_context?: string;
}

export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker: string;
  content: string;
  timestamp: number;
  created_at: string;
}

export interface Task {
  id: string;
  meeting_id: string;
  description: string;
  assignee?: string;
  completed: boolean;
  created_at: string;
}

export interface AISuggestion {
  id: string;
  meeting_id: string;
  suggestion_type: SuggestionType;
  content: string;
  dismissed: boolean;
  created_at: string;
}

export interface MeetingSummary {
  executive_summary: string;
  key_decisions: string[];
  action_items: { description: string; owner?: string }[];
  follow_up_questions: string[];
}

export interface WebSocketMessage {
  type: 'transcript' | 'suggestion' | 'task' | 'status' | 'error';
  data: TranscriptSegment | AISuggestion | Task | { message: string };
}

export interface UploadedFile {
  name: string;
  summary: string;
  size: number;
}
