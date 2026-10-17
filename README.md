# MeChat — Production-Ready Messaging PWA

<div align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="MeChat Logo" />
  <h3>Production-Ready Real-Time Messenger, Calling & Groups PWA</h3>
  <p>Crafted with a sleek near-black dark interface, bright lime green brand accents, and a zero-trust Supabase backend.</p>
</div>

---

## 📱 Visual Identity & Product Design

MeChat is designed based on the three-screen mobile UI reference:
- **Welcome / Auth Screen**: Energetic lime green gradient (`#A5E548` / `#8BCF32`), friendly avatar badge, quick Login & Sign Up, and instant Interactive Demo Account access.
- **Chat List Screen**: 3-dot options menu, instant search, bright lime green `+` action button, horizontal category pills (**All**, **Chats**, **Grups**, **Favorite**), contact avatars with online indicators, last message previews, timestamps, and bold unread count badges.
- **1-on-1 Conversation Screen**: Contact header with "Last seen" and direct Audio/Video call buttons, date divider ("Today"), charcoal incoming message bubbles (`#292F32`), lime green outgoing bubbles (`#A5E548`) with read checkmarks (`✓✓`), and full-featured message composer with voice note recording, photo/document attachments, and responsive keyboard controls.
- **Strict 4-Section Navigation**:
  1. 📞 **Calling**
  2. 💬 **Chat**
  3. 👥 **Groups**
  4. ⚙️ **Settings**
  *(Status has been completely removed across the entire application, routes, menus, and code).*

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons
- **State Management**: Zustand
- **Data Validation**: Zod
- **Notifications**: Sonner toasts
- **Audio & Video Calling**: WebRTC `RTCPeerConnection` with public STUN servers and `navigator.mediaDevices`
- **PWA**: Valid Web App Manifest, Service Worker with offline caching, maskable icons, and `offline.html` fallback
- **Backend & Database**: Supabase
  - Supabase Auth (Email/Password, session persistence)
  - Supabase PostgreSQL with strict Row Level Security (RLS) on all tables
  - Supabase Realtime (live message delivery, typing indicators, presence)
  - Supabase Storage (`avatars` and `chat-attachments` buckets)

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
# Using bun (recommended, blazingly fast)
bun install

# Or using npm
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and configure your Supabase project credentials:
```ini
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```
> **Note**: If you don't have Supabase credentials right now, MeChat includes a fully functional **Interactive Demo Mode**! The app will boot up gracefully and allow you to test all screens, send messages, record voice notes, and test calling right away.

### 3. Run Development Server
```bash
bun dev
# Application will run on http://localhost:5173
```

### 4. Build for Production
```bash
bun run build
# Outputs optimized assets with PWA service worker into dist/
```

### 5. Run Unit Tests
```bash
bun test
```

---

## 🗄️ Supabase Backend Setup Guide

### Step 1: Create a Supabase Project
1. Log in to [Supabase](https://supabase.com).
2. Click **New Project**, choose your region and database password.

### Step 2: Apply Database Schema & Migrations
1. In the Supabase Dashboard, go to the **SQL Editor**.
2. Open the file `supabase/migrations/20261017000000_mechat_schema.sql` from this repository.
3. Paste the entire SQL script and click **Run**.
4. This creates:
   - Tables: `profiles`, `conversations`, `conversation_members`, `messages`, `call_logs`, `user_settings`
   - Automated profile creation trigger on `auth.users`
   - Atomic direct conversation creator: `get_or_create_direct_conversation(target_user_id)`
   - Production Row Level Security (RLS) policies for every table
   - Realtime publication on `messages`, `conversations`, `conversation_members`, `call_logs`

### Step 3: Setup Storage Buckets
1. In the Supabase SQL Editor, run the script from `supabase/storage_setup.sql`.
2. This creates:
   - `avatars` bucket (public read, authenticated user write for their own files)
   - `chat-attachments` bucket (authenticated user read/write)

### Step 4: Configure Auth Redirect URLs
1. Navigate to **Authentication > URL Configuration**.
2. Set **Site URL** to your production domain (or `http://localhost:5173` for local testing).

---

## 🔒 Security & Trust Boundaries

Detailed security policies and verification steps are documented in [SECURITY.md](file:///home/kelvin/Documents/mechat/SECURITY.md).
- **Zero-Trust Client**: Client cannot spoof sender IDs or inject arbitrary members.
- **Strict RLS**: Users can only query messages from conversations where they hold an active membership.
- **P2P Encrypted Calls**: WebRTC audio and video media streams flow directly peer-to-peer using DTLS-SRTP.

---

## 🌐 Deploying to Production (Cloudflare Pages / Vercel / Netlify)

1. Connect your repository to your preferred host (e.g., Cloudflare Pages or Vercel).
2. Set Build Command: `npm run build` or `bun run build`.
3. Set Output Directory: `dist`.
4. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy! MeChat is configured with SPA fallback and PWA service worker caching out of the box.
