const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const ACTIONS = require("./src/actions/Actions");

const app = express();
const server = http.createServer(app);

mongoose
  .connect("mongodb://127.0.0.1:27017/synclab")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const SessionSchema = new mongoose.Schema({
  roomId: String,
  code: String,
  language: String,
  updatedAt: { type: Date, default: Date.now },
});

const Session = mongoose.model("Session", SessionSchema);

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId) || new Set();

  return Array.from(room).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    try {
      userSocketMap[socket.id] = username;
      socket.join(roomId);

      const clients = getAllConnectedClients(roomId);

      clients.forEach(({ socketId }) => {
        io.to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username,
          socketId: socket.id,
        });
      });
    } catch (error) {
      console.error("JOIN error:", error);
    }
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    try {
      socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    } catch (error) {
      console.error("CODE_CHANGE error:", error);
    }
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    try {
      io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    } catch (error) {
      console.error("SYNC_CODE error:", error);
    }
  });

  socket.on(ACTIONS.CHAT_MESSAGE, ({ roomId, messageData }) => {
    try {
      io.to(roomId).emit(ACTIONS.CHAT_MESSAGE, messageData);
    } catch (error) {
      console.error("CHAT_MESSAGE error:", error);
    }
  });

  socket.on("disconnecting", () => {
    try {
      const rooms = [...socket.rooms];

      rooms.forEach((roomId) => {
        if (roomId !== socket.id) {
          socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
            socketId: socket.id,
            username: userSocketMap[socket.id],
          });
        }
      });

      delete userSocketMap[socket.id];
    } catch (error) {
      console.error("disconnecting error:", error);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("socket disconnected:", socket.id, reason);
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

const LANGUAGE_IDS = {
  javascript: 63,
  java: 62,
  python: 71,
  cpp: 54,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post("/api/run", async (req, res) => {
  try {
    const { code, language, stdin = "" } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        error: "Code and language are required",
      });
    }

    const languageId = LANGUAGE_IDS[language];

    if (!languageId) {
      return res.status(400).json({
        success: false,
        error: `Unsupported language: ${language}`,
      });
    }

    const judge0BaseUrl =
      process.env.JUDGE0_BASE_URL || "https://ce.judge0.com";

    const headers = {
      "Content-Type": "application/json",
    };

    if (process.env.JUDGE0_AUTH_TOKEN) {
      headers["X-Auth-Token"] = process.env.JUDGE0_AUTH_TOKEN;
    }

    const createResponse = await fetch(
      `${judge0BaseUrl}/submissions?base64_encoded=false&wait=false`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
          stdin,
        }),
      }
    );

    const createText = await createResponse.text();

    if (!createResponse.ok) {
      return res.status(500).json({
        success: false,
        error: `Judge0 submission failed with status ${createResponse.status}`,
        details: createText,
      });
    }

    let createData;
    try {
      createData = JSON.parse(createText);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Judge0 create response is not valid JSON",
        details: createText,
      });
    }

    const token = createData.token;

    if (!token) {
      return res.status(500).json({
        success: false,
        error: "Submission token not received",
        details: createData,
      });
    }

    let result = null;

    for (let i = 0; i < 15; i++) {
      await sleep(1200);

      const resultResponse = await fetch(
        `${judge0BaseUrl}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`,
        {
          method: "GET",
          headers,
        }
      );

      const resultText = await resultResponse.text();

      if (!resultResponse.ok) {
        return res.status(500).json({
          success: false,
          error: `Judge0 polling failed with status ${resultResponse.status}`,
          details: resultText,
        });
      }

      try {
        result = JSON.parse(resultText);
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: "Judge0 polling response is not valid JSON",
          details: resultText,
        });
      }

      if (result.status && result.status.id !== 1 && result.status.id !== 2) {
        break;
      }
    }

    return res.json({
      success: true,
      result: {
        stdout: result?.stdout || "",
        stderr: result?.stderr || "",
        compile_output: result?.compile_output || "",
        message: result?.message || "",
        status: result?.status?.description || "Unknown",
        time: result?.time || null,
        memory: result?.memory || null,
      },
    });
  } catch (error) {
    console.error("RUN_CODE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while running the code",
      details: String(error),
    });
  }
});

app.post("/api/save", async (req, res) => {
  try {
    const { roomId, code, language } = req.body;

    let session = await Session.findOne({ roomId });

    if (session) {
      session.code = code;
      session.language = language;
      session.updatedAt = Date.now();
    } else {
      session = new Session({
        roomId,
        code,
        language,
      });
    }

    await session.save();

    res.json({ success: true });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.json({ success: false });
  }
});

app.get("/api/load/:roomId", async (req, res) => {
  try {
    const session = await Session.findOne({ roomId: req.params.roomId });

    res.json({
      success: true,
      data: session,
    });
  } catch (err) {
    console.error("LOAD ERROR:", err);
    res.json({ success: false });
  }
});

const PORT = process.env.SERVER_PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});