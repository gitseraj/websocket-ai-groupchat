import "dotenv/config";

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI } from "@google/genai";

import { prisma } from "./prisma.js";

const app = express();

app.use(cors());
app.use(express.json());

const server = createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws"
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.get("/", (_req, res) => {
  res.send("AI Group Chat server is running!");
});

type IncomingMessage = {
  type: "chat";
  content: string;
};

function broadcast(data: object) {
  const message = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function saveAndBroadcast(
  username: string,
  content: string,
  type: "USER" | "AI"
) {
  const message = await prisma.message.create({
    data: {
      username,
      content,
      type
    }
  });

  broadcast({
    type: "message",
    message
  });

  return message;
}

wss.on("connection", async (socket, request) => {
  const url = new URL(
    request.url ?? "/ws",
    "http://localhost"
  );

  const username = (
    url.searchParams.get("username") ?? "Guest"
  )
    .trim()
    .slice(0, 20) || "Guest";

  console.log(`${username} connected`);

  try {
    const history = await prisma.message.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    socket.send(
      JSON.stringify({
        type: "history",
        messages: history.reverse()
      })
    );
  } catch (error) {
    console.error("Could not load history:", error);
  }

  socket.on("message", async (rawMessage) => {
    try {
      const data = JSON.parse(
        rawMessage.toString()
      ) as IncomingMessage;

      if (data.type !== "chat") return;

      if (typeof data.content !== "string") return;

      const content = data.content.trim();

      if (!content || content.length > 2000) return;

      
      await saveAndBroadcast(
        username,
        content,
        "USER"
      );

    
      if (!/@ai\b/i.test(content)) {
        return;
      }

      
      const question = content
        .replace(/@ai\b/gi, "")
        .trim();

      if (!question) {
        await saveAndBroadcast(
          "Gemini",
          "Hi! Add a question after @ai.",
          "AI"
        );

        return;
      }

      
      const response = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents: question
});

      const answer =
        response.text?.trim() ||
        "Sorry, I couldn't generate a response.";

      
      await saveAndBroadcast(
        "Gemini",
        answer.slice(0, 10000),
        "AI"
      );
    } catch (error) {
      console.error("Message processing failed:", error);

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Could not process your message."
          })
        );
      }
    }
  });

  socket.on("close", () => {
    console.log(`${username} disconnected`);
  });
});

const PORT = Number(process.env.PORT) || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
