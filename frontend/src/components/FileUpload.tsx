import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { useMeetingStore } from '@/stores/meetingStore';
import { api } from '@/services/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ACCEPTED_EXTENSIONS = '.pdf,.txt,.md,.doc,.docx';

interface FileUploadProps {
  meetingId?: string;
}

export function FileUpload({ meetingId }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadedFiles, addUploadedFile, removeUploadedFile } = useMeetingStore();

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }
      if (!ACCEPTED_TYPES.includes(file.type) && file.type !== '') {
        setError(`File type "${file.type}" is not supported.`);
        return;
      }
      if (!meetingId) {
        setError('Start a meeting before uploading context files.');
        return;
      }

      setError(null);
      setUploading(true);
      try {
        const uploaded = await api.uploadFile(meetingId, file);
        addUploadedFile(uploaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [meetingId, addUploadedFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      files.forEach(uploadFile);
    },
    [uploadFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(uploadFile);
      if (inputRef.current) inputRef.current.value = '';
    },
    [uploadFile]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg px-4 py-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all select-none ${
          isDragOver
            ? 'border-primary/60 bg-primary/10'
            : 'border-border/40 hover:border-border/70 hover:bg-white/5'
        }`}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        ) : (
          <Upload className={`w-6 h-6 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        )}
        <div className="text-center">
          <p className="text-sm text-foreground/70">
            {uploading ? 'Uploading...' : 'Drop context files here or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">PDF, TXT, MD, DOC up to 10MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {uploadedFiles.map((file) => (
              <motion.div
                key={file.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 bg-secondary/60 border border-border/50 rounded-full px-3 py-1 text-xs text-foreground/80 group"
              >
                <FileText className="w-3 h-3 text-primary shrink-0" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <span className="text-muted-foreground">({formatSize(file.size)})</span>
                <button
                  onClick={() => removeUploadedFile(file.name)}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
