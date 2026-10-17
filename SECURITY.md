# MeChat Security Architecture & RLS Verification Guide

## 1. Security Model Overview

MeChat is designed under the **Zero-Trust Client Principle**: the frontend client is completely untrusted. All authorization, data segregation, message immutability, and membership enforcement are guaranteed at the PostgreSQL database layer via **Row Level Security (RLS)** and atomic database functions.

- No client can forge `sender_id`.
- No client can read conversations they are not a member of.
- No client can read or write messages to private or group chats they do not belong to.
- No client can escalate permissions or add arbitrary users to conversations without authorization.
- Anonymous/public users have zero read or write access to messages, calls, or membership data.

---

## 2. Row Level Security (RLS) Policy Matrix

| Table | Operation | Policy Definition | Enforcement |
|---|---|---|---|
| `profiles` | SELECT | `TO authenticated USING (true)` | Allows discovering contacts and viewing chat partner details. |
| `profiles` | INSERT | `TO authenticated WITH CHECK (auth.uid() = id)` | Users can only create their own profile. |
| `profiles` | UPDATE | `TO authenticated USING (auth.uid() = id)` | Users can only modify their own name, username, bio, avatar. |
| `conversations` | SELECT | `EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = conversations.id AND user_id = auth.uid())` | Only members can view a conversation record. |
| `conversations` | INSERT | `WITH CHECK (auth.uid() = created_by)` | Authenticated users can create new conversations. |
| `conversation_members` | SELECT | `user_id = auth.uid() OR EXISTS (...)` | Only members can see who else belongs to the conversation. |
| `conversation_members` | INSERT | Authorized group admins or creators | Prevents unauthorized member injection. |
| `conversation_members` | DELETE | Member leaving or group admin removing | Prevents unauthorized member kicks. |
| `messages` | SELECT | `EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())` | Only conversation members can read messages. |
| `messages` | INSERT | `sender_id = auth.uid() AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())` | Prevents sender spoofing and ensures only active members can post. |
| `messages` | UPDATE | `sender_id = auth.uid()` | Only the original author can edit or soft-delete (`deleted_at`) a message. |
| `call_logs` | SELECT | `caller_id = auth.uid() OR receiver_id = auth.uid()` | Only call participants can access call metadata. |
| `call_logs` | INSERT | `caller_id = auth.uid()` | Callers can only log calls initiated by themselves. |
| `user_settings` | ALL | `user_id = auth.uid()` | Strictly isolated to each individual user. |

---

## 3. Storage Security Policies

Supabase Storage buckets (`avatars` and `chat-attachments`):
- `avatars`:
  - `SELECT`: Public access (enables fast caching of profile photos).
  - `INSERT` / `UPDATE`: Restricted to `storage.foldername(name)[1] = auth.uid()::text`. Users can only upload files into their own user folder.
- `chat-attachments`:
  - `SELECT` & `INSERT`: Restricted to authenticated conversation members.

---

## 4. How to Test RLS Policies

Run the following SQL queries in your Supabase SQL editor using different test role contexts:

### Test 1: Verify Message Isolation
```sql
-- Simulate User A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

-- Attempt to read messages from a conversation User A does NOT belong to:
SELECT * FROM public.messages WHERE conversation_id = '11111111-1111-1111-1111-111111111111';
-- Result: Returns 0 rows (Access Denied silently via RLS).
```

### Test 2: Prevent Sender Spoofing
```sql
-- Simulate User A attempting to insert a message with User B's sender_id:
INSERT INTO public.messages (conversation_id, sender_id, content)
VALUES ('00000000-1111-2222-3333-444444444444', '00000000-0000-0000-0000-000000000002', 'I am impersonating B');
-- Result: ERROR: new row violates row-level security policy for table "messages".
```

---

## 5. WebRTC Calling Privacy

- STUN servers are used for ICE candidate negotiation (`stun:stun.l.google.com:19302`).
- Media streams flow **directly peer-to-peer (P2P)** encrypted with DTLS-SRTP.
- No audio or video data passes through or gets saved to the database. Only metadata logs (duration, timestamp, participants) are stored.
