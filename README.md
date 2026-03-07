# 🧠 MeetingMind AI

> Real-time AI-powered meeting assistant for Senior Big Data Engineers

MeetingMind AI is a locally-deployed meeting assistant that listens, transcribes, takes smart notes, extracts action items, and suggests impressive questions — all powered by **Gemini 2.0 Flash (100% free tier)**.

---

## ✨ Features

- 🎤 **Real-time transcription** with speaker identification via WebSocket streaming
- 🤖 **AI-powered suggestions** — smart questions to ask, ideas to propose, and alerts about important moments
- ✅ **Automatic task extraction** — detects and tracks action items with assignees
- 📋 **4 specialized meeting modes** tailored for Big Data Engineering at Circana
- 🔄 **Smart rate-limit management** — batches API calls to stay under 15 RPM free tier
- 📊 **Post-meeting summaries** with executive summary, key decisions, and follow-up questions
- 📁 **Optional file uploads** — add scripts/configs for deeper AI context
- 💾 **Persistent history** via SQLite (zero configuration)
- 🌙 **Beautiful dark theme** with smooth Framer Motion animations
- 🐳 **Single command Docker deploy** — `docker compose up`

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                         │
│  ┌──────────────────┐     ┌──────────────────────────┐  │
│  │  Frontend        │     │  Backend                 │  │
│  │  React + Vite    │────▶│  Python FastAPI          │  │
│  │  Port 3000       │ WS  │  Port 8000               │  │
│  │  Tailwind CSS    │◀────│  SQLite + SQLAlchemy     │  │
│  │  Framer Motion   │     │  Gemini 2.0 Flash API    │  │
│  │  Zustand         │     │                          │  │
│  └──────────────────┘     └──────────────┬───────────┘  │
│                                          │               │
│                           ┌──────────────▼───────────┐  │
│                           │  SQLite Volume           │  │
│                           │  (meetings.db)           │  │
│                           └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │  Gemini 2.0 Flash│
                         │  (Free Tier API) │
                         └──────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Docker Compose)
- A free [Gemini API key](https://aistudio.google.com/app/apikey) (no credit card required)

### 3-Step Setup

**1. Clone the repository**
```bash
git clone https://github.com/hzgovst/meetingmind.git
cd meetingmind
```

**2. Add your Gemini API key**
```bash
cp .env.example .env
# Edit .env and replace 'your_gemini_api_key_here' with your actual key
```

**3. Launch the app**
```bash
docker compose up
```

Open your browser at **http://localhost:3000** 🎉

---

## 🔑 Getting Your Free Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API key"**
4. Copy the key and paste it into your `.env` file

**Free tier limits:**
- Gemini 2.0 Flash: 15 requests/minute, 1 million tokens/day
- Gemini 2.0 Flash Lite (fallback): 30 requests/minute

MeetingMind AI automatically stays under these limits with smart batching.

---

## 📋 Meeting Types

### 1. 🏃 Daily Standup
Optimized for quick 15-minute standups:
- Tracks what was done, what's in progress, and blockers
- Auto-flags impediments
- Suggests time estimates for new tasks
- Generates prioritized task list

### 2. 🔍 Production Review (Monthly)
For Circana's Complete Store pipeline reviews:
- Analyzes ETL pipeline upgrade requirements
- Suggests Spark/Hadoop architecture patterns
- Flags SLA risks and data volume concerns
- Tracks Q&A between ops, product, and engineering teams

### 3. 🚨 Incident Support (Friday Production Support)
For real-time incident troubleshooting:
- Parses error descriptions in real-time
- Suggests root causes (Spark OOM, partition skew, YARN starvation, Hive metastore issues)
- Recommends resolutions based on common big data failure patterns
- Auto-drafts runbook entries
- Flags similar issue patterns

### 4. 📚 Knowledge Transfer / Ad-Hoc
For comprehensive capture sessions:
- Captures everything comprehensively
- Identifies explanation gaps and suggests clarifying questions
- Auto-creates structured documentation
- Maps concepts to the existing tech stack (Spark, Hadoop, Hive, ADLS, SQL Server)

---

## 🎯 Usage Guide

### Starting a Meeting

1. Select your **meeting type** from the dropdown in the top bar
2. Click the **"Start Recording"** button (turns red when active)
3. Allow microphone access when prompted
4. The AI will automatically:
   - Transcribe speech with speaker labels
   - Generate smart suggestions in the right panel
   - Extract action items in the task board

### During the Meeting

- **Left panel**: Live transcript with speaker colors and timestamps
- **Right panel**: AI suggestions organized as:
  - 💬 **Questions** — Smart questions to ask right now
  - 💡 **Ideas** — Technical suggestions relevant to the discussion
  - ⚠️ **Alerts** — Important points to note or follow up on
- **Bottom**: Extracted action items with assignees
- Click **Copy** on any suggestion to copy to clipboard
- Click **✕** to dismiss suggestions you've already addressed
- Click checkboxes in the task board to mark items complete

### Adding Context Files (Optional)

Click **"Add context files"** to expand the file upload area. Upload:
- PySpark/Scala scripts (`.py`, `.scala`)
- SQL/HQL queries (`.sql`, `.hql`)
- Configuration files (`.yaml`, `.json`, `.xml`)
- Documentation (`.md`, `.txt`, `.pdf`)
- Logs (`.log`)

The AI will reference these files when generating suggestions.

### Generating a Summary

Click **"Generate Summary"** at any time or after stopping the recording. The summary includes:
- Executive summary
- Key decisions made
- Action items with owners
- Follow-up questions

### Exporting Results

Use the **Export** button in the control bar:
- **Copy Markdown** — copies formatted markdown to clipboard
- **Download MD** — downloads as a `.md` file
- **Download PDF** — prints to PDF via browser

---

## 📁 File Upload Guide (Optional Enhancement)

The app works fully without any uploads. Files add deeper context for more specific AI suggestions.

**Supported formats:**
| Category | Extensions |
|----------|-----------|
| Code | `.py`, `.scala`, `.sql`, `.hql`, `.sh` |
| Config | `.yaml`, `.json`, `.xml` |
| Docs | `.pdf`, `.txt`, `.md` |
| Data | `.csv`, `.log` |
| Images | `.png`, `.jpg` |

**Limits:** 10MB per file

---

## 🛠 Tech Stack

### Backend
- **Python 3.11** with FastAPI (async)
- **Gemini 2.0 Flash** — transcription, suggestions, task extraction, summaries
- **SQLite + SQLAlchemy** (async) — meeting history persistence
- **WebSocket** — real-time audio streaming

### Frontend
- **React 18 + TypeScript** — component framework
- **Vite** — build tool and dev server
- **Tailwind CSS** — utility-first styling
- **shadcn/ui** — accessible UI components
- **Framer Motion** — smooth animations
- **Zustand** — lightweight state management
- **Web Audio API** — microphone capture and level metering

### Infrastructure
- **Docker + Docker Compose** — containerized deployment
- **nginx** — frontend production server with WebSocket proxy
- **SQLite** — zero-config persistent database

---

## 🔧 Configuration

Edit `.env` to customize behavior:

```env
# Required
GEMINI_API_KEY=your_key_here

# Optional
GEMINI_MODEL=gemini-2.0-flash-exp        # Primary model
GEMINI_FALLBACK_MODEL=gemini-2.0-flash-lite  # Fallback model  
MAX_RPM=14                                # Stay under 15 RPM limit
AUDIO_CHUNK_SECONDS=12                    # Buffer duration before processing
MAX_FILE_SIZE_MB=10                       # Max upload size
```

---

## 🔮 Future Enhancements

- [ ] **Anthropic Claude integration** — plug in via `.env` API key
- [ ] **RAG (Retrieval-Augmented Generation)** — query your entire meeting history
- [ ] **Mobile support** — React Native app for on-the-go meetings
- [ ] **Team mode** — multi-user meeting rooms
- [ ] **Calendar integration** — auto-import meeting titles and attendees
- [ ] **Slack/Teams notifications** — send summaries directly to channels
- [ ] **Custom speaker profiles** — learn voice signatures over time

---

## 📝 License

MIT

---

*Built for Senior Big Data Engineers at Circana — designed to make every meeting more productive.*
