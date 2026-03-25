import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import Client from "../components/Client";
import Editor from "../components/Editor";
import FilePreview from "../components/FilePreview";
import { language, cmtheme } from "../atoms";
import { useRecoilState } from "recoil";
import ACTIONS from "../actions/Actions";
import { initSocket } from "../socket";
import {
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from "react-router-dom";

const STARTER_CODES = {
  javascript: `console.log("Hello World");`,

  python: `print("Hello World")`,

  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello World";
    return 0;
}`,

  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}`,
};

const EditorPage = () => {
  const [lang, setLang] = useRecoilState(language);
  const [them, setThem] = useRecoilState(cmtheme);
  const [clients, setClients] = useState([]);
  const [runInput, setRunInput] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [runStatus, setRunStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [socketReady, setSocketReady] = useState(false);

  const socketRef = useRef(null);
  const codeRef = useRef(STARTER_CODES[lang] || STARTER_CODES.javascript);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();

  const [filePreview, setFilePreview] = useState(false);
  const [fileContent, setFileContent] = useState("");
  const fileInputRef = useRef(null);
  const editorInstanceRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      setSocketReady(true);

      const handleErrors = (e) => {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator("/");
      };

      socketRef.current.on("connect_error", handleErrors);
      socketRef.current.on("connect_failed", handleErrors);

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
          }

          setClients(clients);

          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });

      socketRef.current.on(ACTIONS.CHAT_MESSAGE, (messageData) => {
        setMessages((prev) => [...prev, messageData]);
      });
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.CHAT_MESSAGE);
        socketRef.current.disconnect();
      }
    };
  }, [roomId, location.state?.username, reactNavigator]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentEditorCode = editorInstanceRef.current?.getCode?.() || "";

      if (!currentEditorCode.trim()) {
        const defaultCode = STARTER_CODES[lang] || STARTER_CODES.javascript;
        editorInstanceRef.current?.setCode(defaultCode);
        codeRef.current = defaultCode;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [lang]);

  useEffect(() => {
    const loadSavedCode = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/load/${roomId}`);
        const data = await res.json();

        if (data.success && data.data?.code) {
          editorInstanceRef.current?.setCode(data.data.code);
          codeRef.current = data.data.code;

          if (data.data.language) {
            setLang(data.data.language);
          }

          toast.success("Saved code loaded");
        }
      } catch (err) {
        console.log("Load failed", err);
      }
    };

    loadSavedCode();
  }, [roomId, setLang]);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy the Room ID");
      console.error(err);
    }
  }

  function leaveRoom() {
    reactNavigator("/");
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const uploadedContent = e.target.result;
        setFileContent(uploadedContent);
        setFilePreview(true);
      };
      reader.readAsText(file);
    }
  }

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updateEditorCode = (newCode) => {
    editorInstanceRef.current?.setCode(newCode);
    codeRef.current = newCode;

    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.CODE_CHANGE, {
        roomId,
        code: newCode,
      });
    }
  };

  const handleAppendCode = () => {
    const currentCode = codeRef.current || "";
    const appendedCode = currentCode
      ? `${currentCode}\n\n${fileContent}`
      : fileContent;

    updateEditorCode(appendedCode);
    setFilePreview(false);
    resetFileInput();
  };

  const handleReplaceCode = () => {
    updateEditorCode(fileContent);
    setFilePreview(false);
    resetFileInput();
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLang(newLang);

    const newCode = STARTER_CODES[newLang] || "";
    updateEditorCode(newCode);

    toast.success(`${newLang.toUpperCase()} template loaded`);
  };

  const handleRunCode = async () => {
    try {
      setIsRunning(true);
      setRunOutput("");
      setRunStatus("Running...");

      const currentCode =
        editorInstanceRef.current?.getCode?.() || codeRef.current || "";

      const response = await fetch("http://localhost:5000/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: currentCode,
          language: lang,
          stdin: runInput,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setRunStatus("Execution Failed");
        setRunOutput(
          `${data.error || "Failed to run code"}\n\n${data.details || ""}`
        );
        return;
      }

      const result = data.result;

      setRunStatus(result.status || "Completed");

      const finalOutput =
        result.stdout ||
        result.stderr ||
        result.compile_output ||
        result.message ||
        "No output";

      setRunOutput(finalOutput);
    } catch (error) {
      console.error("Frontend run error:", error);
      setRunStatus("Execution Failed");
      setRunOutput(
        error.message || "Something went wrong while running the code."
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveCode = async () => {
    try {
      const currentCode =
        editorInstanceRef.current?.getCode?.() || codeRef.current || "";

      const response = await fetch("http://localhost:5000/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          code: currentCode,
          language: lang,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Code saved successfully 🚀");
      } else {
        toast.error("Save failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const messageData = {
      username: location.state?.username,
      message: chatInput,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    socketRef.current.emit(ACTIONS.CHAT_MESSAGE, {
      roomId,
      messageData,
    });

    setChatInput("");
  };

  const handleChatEnter = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  if (!location.state) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <h2
              style={{
                color: "#4AED88",
                margin: "0 0 8px 0",
                fontSize: "28px",
                fontWeight: "700",
              }}
            >
              SyncLab
            </h2>
            <p style={{ color: "#aaa", margin: 0, fontSize: "13px" }}>
              Real-time collaborative coding
            </p>
          </div>

          <h3>Connected Users</h3>

          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>

          <div
            style={{
              marginTop: "20px",
              background: "#111827",
              borderRadius: "10px",
              padding: "12px",
              maxHeight: "280px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Room Chat</h3>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: "180px",
                marginBottom: "10px",
                paddingRight: "4px",
              }}
            >
              {messages.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                  No messages yet
                </p>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: "10px",
                      padding: "8px",
                      background: "#1f2937",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#4AED88",
                        marginBottom: "4px",
                      }}
                    >
                      {msg.username} • {msg.time}
                    </div>
                    <div style={{ fontSize: "14px", color: "#fff" }}>
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatEnter}
              placeholder="Type a message..."
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                outline: "none",
                background: "#1f2937",
                color: "#fff",
                marginBottom: "8px",
              }}
            />

            <button
              className="btn"
              onClick={handleSendMessage}
              style={{
                background: "#facc15",
                color: "#000",
                fontWeight: "600",
              }}
            >
              Send
            </button>
          </div>
        </div>

        <input
          type="file"
          accept=".js,.py,.java,.cpp,.c,.txt,.html,.css"
          style={{ display: "none" }}
          id="fileUpload"
          onChange={handleFileUpload}
          ref={fileInputRef}
        />

        <button
          className="uploadFileBtn"
          onClick={() => document.getElementById("fileUpload").click()}
        >
          Upload File
        </button>

        {filePreview && (
          <FilePreview
            setFilePreview={setFilePreview}
            fileContent={fileContent}
            resetFileInput={resetFileInput}
            onAppend={handleAppendCode}
            onReplace={handleReplaceCode}
          />
        )}

        <label>
          Select Language:
          <select
            value={lang}
            onChange={handleLanguageChange}
            className="seLang"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
        </label>

        <label>
          Select Theme:
          <select
            value={them}
            onChange={(e) => setThem(e.target.value)}
            className="seLang"
          >
            <option value="default">default</option>
            <option value="dracula">dracula</option>
            <option value="material">material</option>
            <option value="monokai">monokai</option>
            <option value="nord">nord</option>
            <option value="zenburn">zenburn</option>
          </select>
        </label>

        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy Room ID
        </button>

        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      <div
        className="editorWrap"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "10px 14px",
            background: "#111827",
            borderBottom: "1px solid #2d3748",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn copyBtn"
            onClick={handleRunCode}
            disabled={isRunning}
            style={{
              background: "#4AED88",
              color: "#000",
              minWidth: "120px",
            }}
          >
            {isRunning ? "Running..." : "Run Code"}
          </button>

          <button
            className="btn"
            onClick={handleSaveCode}
            style={{
              background: "#60a5fa",
              color: "#000",
              minWidth: "120px",
            }}
          >
            Save Code
          </button>

          <input
            type="text"
            value={runInput}
            onChange={(e) => setRunInput(e.target.value)}
            placeholder="Optional input"
            style={{
              flex: 1,
              minWidth: "220px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "none",
              outline: "none",
              background: "#1f2937",
              color: "#fff",
            }}
          />
        </div>

        <Editor
          ref={editorInstanceRef}
          socketRef={socketRef}
          socketReady={socketReady}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />

        <div
          style={{
            background: "#0b1020",
            color: "#e5e7eb",
            borderTop: "1px solid #2d3748",
            padding: "14px",
            minHeight: "180px",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#4AED88" }}>Output</h3>
          <p style={{ margin: "0 0 10px 0", color: "#9ca3af" }}>
            Status: {runStatus || "Idle"}
          </p>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "Cascadia Code, monospace",
              fontSize: "14px",
              lineHeight: "1.5",
            }}
          >
            {runOutput || "Run your code to see output here..."}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;