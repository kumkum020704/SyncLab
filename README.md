# 🚀 SyncLab - Real-Time Collaborative Code Editor

SyncLab is a full-stack real-time collaborative code editor that allows multiple users to join a shared room and code together instantly. It supports live code synchronization, multi-language execution, chat, and persistent session storage.

---

## ✨ Key Features

- 👨‍💻 **Real-time collaboration**
  - Multiple users can edit code simultaneously
  - Instant updates across all connected clients

- 🧑‍🤝‍🧑 **Connected users tracking**
  - See all users present in the room

- 💬 **Built-in chat system**
  - Real-time messaging inside coding room

- ⚡ **Run code**
  - Supports:
    - C++
    - Java
    - Python
    - JavaScript
  - Integrated with Judge0 API

- 💾 **Save & load sessions**
  - Code persists using MongoDB
  - Reload same room to continue work

- 📂 **File upload**
  - Upload code files
  - Append or replace existing code

- 🎨 **Editor customization**
  - Multiple themes
  - Language switching with templates

- 🔗 **Room-based collaboration**
  - Unique Room ID for each session

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Recoil (State Management)
- CodeMirror (Editor)
- Socket.io-client

### Backend
- Node.js
- Express.js
- Socket.io (WebSockets)
- MongoDB (Mongoose)

### APIs
- Judge0 API (Code Execution)

---

## ⚙️ Installation & Setup

### Clone the repository

```bash
git clone https://github.com/kumkum020704/SyncLab.git
cd SyncLab