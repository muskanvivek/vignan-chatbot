# Vignan Support AI Assistant 🎓

An advanced, RAG-powered (Retrieval-Augmented Generation) AI Chatbot designed to assist students and staff at Vignan University. The system provides accurate, document-backed information regarding admissions, fees, programs, and campus life.

## 🚀 Key Features

- **Multi-Source Ingestion**: Automatically learns from PDFs, website URLs (with deep crawling), and manual FAQ entries.
- **Advanced RAG Pipeline**: Uses vector search combined with keyword fallback and AI-powered re-ranking for maximum accuracy.
- **AI-Powered OCR**: Automatically falls back to Gemini 1.5 Flash OCR for scanned or image-heavy PDFs.
- **Multilingual Support**: Real-time translation between English and other languages using high-speed AI translation.
- **University Persona**: Actively behaves as a Senior Academic Counselor with strict source fidelity.
- **Admin Dashboard**: Full management of the university knowledge base, contacts, and ingestion status.

## 🛠️ Tech Stack

- **Frontend**: React, Lucide Icons, Tailwind CSS (implied).
- **Backend**: Node.js, Express.
- **Database**: MongoDB Atlas (with Vector Search).
- **AI Models**:
  - **Groq (Llama 3.1)**: Primary LLM for fast responses.
  - **Gemini 1.5 Flash**: Fallback LLM, OCR, Translation, and Re-ranking.
  - **Xenova Transformers**: Local embedding generation (all-MiniLM-L6-v2).

## 📋 Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account (with Vector Search index enabled)
- API Keys for Groq and Google Gemini

### 1. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_uri
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```
Start the backend:
```bash
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 📂 Project Structure
- `backend/`: Node.js server, RAG logic, and AI services.
- `frontend/`: React-based student chat and admin dashboard.
- `models/`: Mongoose schemas for Sources, Chunks, and Contacts.
- `services/`: Core logic for embeddings, LLMs, and search.
- `utils/`: Helpers for PDF parsing, web scraping, and auth.

## 🔒 Security
- Basic authentication for admin routes.
- Sensitive keys managed via environment variables.
- Git ignored sensitive files (.env, node_modules).

---
*Developed for Vignan University's Student Support Initiative.*
