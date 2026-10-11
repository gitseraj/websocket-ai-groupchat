import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type ChatMessage = {
  id: number;
  username: string;
  content: string;
  type: "USER" | "AI";
  createdAt: string;
};

type ServerEvent =
  | {
      type: "history";
      messages: ChatMessage[];
    }
  | {
      type: "message";
      message: ChatMessage;
    }
  | {
      type: "error";
      message: string;
    };

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  "ws://localhost:5000/ws";

function App() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!joined) return;

    const socket = new WebSocket(
      `${WS_URL}?username=${encodeURIComponent(username)}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setError("");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(
        event.data
      ) as ServerEvent;

      if (data.type === "history") {
        setMessages(data.messages);
      }

      if (data.type === "message") {
        setMessages((previous) => [
          ...previous,
          data.message
        ]);
      }

      if (data.type === "error") {
        setError(data.message);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    socket.onerror = () => {
      setError("Connection failed. Check the server.");
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [joined, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  function joinChat(event: FormEvent) {
    event.preventDefault();

    const cleanName = username.trim().slice(0, 20);

    if (!cleanName) return;

    setUsername(cleanName);
    setJoined(true);
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();

    const content = input.trim();
    const socket = socketRef.current;

    if (
      !content ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "chat",
        content
      })
    );

    setInput("");
    setError("");
  }

  if (!joined) {
    return (
      <main className="join-page">
        <form className="join-card" onSubmit={joinChat}>
          

          <h1>Group Chat</h1>

          <p>
            Chat with everyone. Mention @ai when
            you need an AI answer.
          </p>

          <input
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="Enter your username"
            maxLength={20}
            required
          />

          <button type="submit">
            Join chat
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <header className="chat-header">
        

        <div>
          <h1>Group Chat</h1>
          <p>
            {connected
              ? "Connected · Everyone is here"
              : "Connecting..."}
          </p>
        </div>

        <span className="current-user">
          {username}
        </span>
      </header>

      <section className="messages">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`message ${
              message.type === "AI"
                ? "ai-message"
                : message.username === username
                ? "own-message"
                : ""
            }`}
          >
            <div className="message-meta">
              <strong>
                {message.type === "AI"
                  ? "🤖 Gemini"
                  : message.username}
              </strong>

              <span>
                {new Date(
                  message.createdAt
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>

            <p>{message.content}</p>
          </article>
        ))}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </section>

      <form className="message-form" onSubmit={sendMessage}>
        <input
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          placeholder="Message everyone... Use @ai to ask AI"
          maxLength={2000}
          disabled={!connected}
        />

        <button
          type="submit"
          disabled={!connected || !input.trim()}
        >
          Send
        </button>
      </form>

      <footer className="chat-footer">
        Messages are shared with everyone in this room.
      </footer>
    </main>
  );
}

export default App;