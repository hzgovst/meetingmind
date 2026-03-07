import type { Meeting, MeetingType, TranscriptSegment, Task, AISuggestion, MeetingSummary, UploadedFile } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API error ${response.status}: ${errorText}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  createMeeting: (title: string, meetingType: MeetingType): Promise<Meeting> =>
    request<Meeting>('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({ title, meeting_type: meetingType }),
    }),

  getMeetings: (): Promise<Meeting[]> =>
    request<Meeting[]>('/api/meetings'),

  getMeeting: (id: string): Promise<Meeting> =>
    request<Meeting>(`/api/meetings/${id}`),

  updateMeeting: (id: string, data: Partial<Meeting>): Promise<Meeting> =>
    request<Meeting>(`/api/meetings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getMeetingTranscript: (id: string): Promise<TranscriptSegment[]> =>
    request<TranscriptSegment[]>(`/api/meetings/${id}/transcript`),

  getMeetingTasks: (id: string): Promise<Task[]> =>
    request<Task[]>(`/api/meetings/${id}/tasks`),

  updateTask: (meetingId: string, taskId: string, completed: boolean): Promise<Task> =>
    request<Task>(`/api/meetings/${meetingId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  getMeetingSuggestions: (id: string): Promise<AISuggestion[]> =>
    request<AISuggestion[]>(`/api/meetings/${id}/suggestions`),

  dismissSuggestion: (meetingId: string, suggId: string): Promise<AISuggestion> =>
    request<AISuggestion>(`/api/meetings/${meetingId}/suggestions/${suggId}/dismiss`, {
      method: 'POST',
    }),

  generateSummary: (meetingId: string): Promise<MeetingSummary> =>
    request<MeetingSummary>(`/api/meetings/${meetingId}/summary`, {
      method: 'POST',
    }),

  uploadFile: async (meetingId: string, file: File): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/api/meetings/${meetingId}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Upload error ${response.status}: ${errorText}`);
    }
    return response.json() as Promise<UploadedFile>;
  },

  generateSuggestions: (meetingId: string): Promise<AISuggestion[]> =>
    request<AISuggestion[]>(`/api/meetings/${meetingId}/suggestions/generate`, {
      method: 'POST',
    }),
};
