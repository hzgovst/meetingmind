import { create } from 'zustand';
import type { Meeting, MeetingType, TranscriptSegment, Task, AISuggestion, MeetingSummary, UploadedFile } from '@/types';

interface MeetingState {
  currentMeeting: Meeting | null;
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;

  transcriptSegments: TranscriptSegment[];
  tasks: Task[];
  suggestions: AISuggestion[];
  uploadedFiles: UploadedFile[];

  showSummary: boolean;
  summary: MeetingSummary | null;
  meetingType: MeetingType;

  setCurrentMeeting: (meeting: Meeting | null) => void;
  setIsRecording: (value: boolean) => void;
  setIsPaused: (value: boolean) => void;
  setRecordingDuration: (value: number) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  setTranscriptSegments: (segments: TranscriptSegment[]) => void;
  addTask: (task: Task) => void;
  setTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, completed: boolean) => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  setSuggestions: (suggestions: AISuggestion[]) => void;
  dismissSuggestion: (suggestionId: string) => void;
  addUploadedFile: (file: UploadedFile) => void;
  removeUploadedFile: (fileName: string) => void;
  setShowSummary: (value: boolean) => void;
  setSummary: (summary: MeetingSummary | null) => void;
  setMeetingType: (type: MeetingType) => void;
  resetMeeting: () => void;
}

const initialState = {
  currentMeeting: null,
  isRecording: false,
  isPaused: false,
  recordingDuration: 0,
  transcriptSegments: [],
  tasks: [],
  suggestions: [],
  uploadedFiles: [],
  showSummary: false,
  summary: null,
  meetingType: 'standup' as MeetingType,
};

export const useMeetingStore = create<MeetingState>((set) => ({
  ...initialState,

  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),
  setIsRecording: (value) => set({ isRecording: value }),
  setIsPaused: (value) => set({ isPaused: value }),
  setRecordingDuration: (value) => set({ recordingDuration: value }),

  addTranscriptSegment: (segment) =>
    set((state) => ({
      transcriptSegments: [...state.transcriptSegments, segment],
    })),
  setTranscriptSegments: (segments) => set({ transcriptSegments: segments }),

  addTask: (task) =>
    set((state) => {
      if (state.tasks.find((t) => t.id === task.id)) return state;
      return { tasks: [...state.tasks, task] };
    }),
  setTasks: (tasks) => set({ tasks }),

  updateTask: (taskId, completed) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
    })),

  addSuggestion: (suggestion) =>
    set((state) => {
      if (state.suggestions.find((s) => s.id === suggestion.id)) return state;
      return { suggestions: [...state.suggestions, suggestion] };
    }),
  setSuggestions: (suggestions) => set({ suggestions }),

  dismissSuggestion: (suggestionId) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === suggestionId ? { ...s, dismissed: true } : s
      ),
    })),

  addUploadedFile: (file) =>
    set((state) => ({
      uploadedFiles: [...state.uploadedFiles, file],
    })),

  removeUploadedFile: (fileName) =>
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter((f) => f.name !== fileName),
    })),

  setShowSummary: (value) => set({ showSummary: value }),
  setSummary: (summary) => set({ summary }),
  setMeetingType: (type) => set({ meetingType: type }),

  resetMeeting: () => set(initialState),
}));
