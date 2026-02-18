# ✨ Echo Script - Advanced Audio-to-Text AI

A premium, full-stack AI transcription platform built with **Spring Boot**, **React**, and **OpenAI Whisper**. Designed for security, speed, and a world-class user experience.

## 🚀 Key Features
- **Smart Transcription**: High-accuracy fallback system using OpenAI's Whisper.
- **Link Processing**: Direct transcription from video/audio links (YouTube, etc.).
- **Multi-Format Export**: Download results in `.txt`, `.srt` (Subtitles), or `.vtt`.
- **Dynamic AI Insights**: Choose between different AI models (Tiny to Medium) based on your needs.
- **Secure Auth**: Built-in user registration and session management.
- **Glassmorphism UI**: Beautiful, responsive design with real-time SSE job tracking.

## 🛠️ Prerequisites
- **Java 17+** (JDK)
- **Node.js 18+** & npm
- **Python 3.9+**
- **FFmpeg** (Required for audio processing)

## 📁 Project Structure
```text
AudioToTextProject/
├── backend/         # Spring Boot (Security, H2 DB, Job Queue)
├── frontend/        # React + Vite (Glassmorphism UI, SSE Client)
├── whisper/         # Python Engine (Whisper + yt-dlp)
├── uploads/         # Temporary storage for audio
└── outputs/         # Generated transcription assets
```

## ⚙️ Quick Start

### 1. Python Environment
```bash
cd whisper
pip install -r requirements.txt
```

### 2. Launch Backend
```bash
cd backend
./mvnw spring-boot:run
```
*Port: 8080*

### 3. Launch Frontend
```bash
cd frontend
npm install
npm run dev
```
*Port: 5173*

## 💡 Presentation Tips
1. **First Transcription**: On the first start, the AI model downloads automatically (show the logs for this!).
2. **SSE Updates**: Highlight how the status changes in real-time without refreshing the page.
3. **History Tab**: Show how previous jobs are securely stored and accessible at any time.
4. **Copy Feature**: Use the "Copy Text" button for quick integration of scripts.

## 🤝 Project Status
Optimized for production-ready demonstration. Fully patched for security and performance.
