const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();

const FRONTEND_ORIGIN = "https://emotionalintelligencedeveloper-glitch.github.io";

app.use(cors({
  origin: FRONTEND_ORIGIN
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const API_KEY = process.env.MY_SECRET_API_KEY;
const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_PW = process.env.ADMIN_PW;

let roundNumber = 1;
let roundActive = true;
let fullMessage = "";
let currentMessages = [];
let activeUsers = new Map();        // socket.id -> username
let submittedUsers = new Set();     // username per round
let votedUsers = new Set();         // socket.id per round

function sanitizeUsername(value) {
  return String(value || "").trim().slice(0, 31);
}

function sanitizeMessage(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 220);
}

function validUsername(username) {
  return /^[A-Za-z0-9._\- ]{1,31}$/.test(username);
}

function validMessage(text) {
  return text.length >= 2 && text.length <= 220;
}

function publicState() {
  return {
    roundNumber,
    roundActive,
    fullMessage,
    currentMessages: currentMessages.map((m) => ({
      id: m.id,
      username: m.username,
      text: m.text,
      votes: m.votes
    })),
    playerCount: activeUsers.size
  };
}

function emitState() {
  io.emit("gameState", publicState());
  io.emit("playerCount", { count: activeUsers.size });
}

io.on("connection", (socket) => {
  socket.emit("gameState", publicState());

  socket.on("registerUser", (data = {}) => {
    const username = sanitizeUsername(data.username);

    if (!validUsername(username)) {
      socket.emit("gameError", {
        message: "Username must be 1 to 31 characters and use only letters, numbers, spaces, dots, hyphens, or underscores."
      });
      return;
    }

    const usernameTaken = Array.from(activeUsers.entries()).some(
      ([socketId, existingUsername]) =>
        socketId !== socket.id &&
        existingUsername.toLowerCase() === username.toLowerCase()
    );

    if (usernameTaken) {
      socket.emit("gameError", {
        message: "That username is already in use. Please choose another one."
      });
      return;
    }

    activeUsers.set(socket.id, username);

    socket.emit("registered", {
      ok: true,
      username
    });

    io.emit("playerCount", { count: activeUsers.size });
  });

  socket.on("submitMessage", (data = {}) => {
    if (!roundActive) {
      socket.emit("gameError", { message: "This round is closed." });
      return;
    }

    const username = activeUsers.get(socket.id);
    if (!username) {
      socket.emit("gameError", { message: "Register your username first." });
      return;
    }

    const text = sanitizeMessage(data.text);

    if (!validMessage(text)) {
      socket.emit("gameError", { message: "Message must be 2 to 220 characters." });
      return;
    }

    if (submittedUsers.has(username.toLowerCase())) {
      socket.emit("gameError", { message: "You already submitted one message this round." });
      return;
    }

    const newMessage = {
      id: crypto.randomUUID(),
      username,
      text,
      votes: 0,
      createdAt: Date.now()
    };

    currentMessages.push(newMessage);
    submittedUsers.add(username.toLowerCase());

    io.emit("newMessage", {
      id: newMessage.id,
      username: newMessage.username,
      text: newMessage.text,
      votes: newMessage.votes
    });

    io.emit("gameState", publicState());
  });

  socket.on("castVote", (data = {}) => {
    if (!roundActive) {
      socket.emit("gameError", { message: "Voting is closed." });
      return;
    }

    const messageId = String(data.messageId || "").trim();
    const msg = currentMessages.find((m) => m.id === messageId);

    if (!msg) {
      socket.emit("gameError", { message: "Message not found." });
      return;
    }

    if (votedUsers.has(socket.id)) {
      socket.emit("gameError", { message: "You already voted this round." });
      return;
    }

    msg.votes += 1;
    votedUsers.add(socket.id);

    io.emit("updateVotes", {
      id: msg.id,
      votes: msg.votes
    });
  });

  socket.on("adminDelete", (data = {}) => {
    if (data.adminId !== ADMIN_ID || data.adminPw !== ADMIN_PW) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    const messageId = String(data.messageId || "").trim();
    const removed = currentMessages.find((m) => m.id === messageId);

    currentMessages = currentMessages.filter((m) => m.id !== messageId);

    if (removed) {
      submittedUsers.delete(removed.username.toLowerCase());
      io.emit("messageRemoved", { id: messageId });
      io.emit("gameState", publicState());
    }
  });

  socket.on("finalizeRound", (data = {}) => {
    if (data.adminId !== ADMIN_ID || data.adminPw !== ADMIN_PW) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    roundActive = false;

    let winner = null;

    if (currentMessages.length > 0) {
      winner = currentMessages.reduce((best, current) => {
        if (current.votes > best.votes) return current;
        if (current.votes === best.votes && current.createdAt < best.createdAt) return current;
        return best;
      });

      fullMessage = fullMessage
        ? `${fullMessage} ${winner.text}`.trim()
        : winner.text.trim();
    }

    io.emit("roundFinalized", {
      fullMessage,
      winningMessage: winner
        ? {
            id: winner.id,
            username: winner.username,
            text: winner.text,
            votes: winner.votes
          }
        : null
    });

    roundNumber += 1;
    roundActive = true;
    currentMessages = [];
    submittedUsers = new Set();
    votedUsers = new Set();

    io.emit("nextSection", {
      roundNumber,
      fullMessage,
      currentMessages: []
    });

    emitState();
  });

  socket.on("disconnect", () => {
    const username = activeUsers.get(socket.id);

    activeUsers.delete(socket.id);
    votedUsers.delete(socket.id);

    if (username) {
      const usernameLower = username.toLowerCase();
      const stillConnectedWithSameName = Array.from(activeUsers.values()).some(
        (name) => name.toLowerCase() === usernameLower
      );

      if (!stillConnectedWithSameName) {
        const stillHasMessageThisRound = currentMessages.some(
          (msg) => msg.username.toLowerCase() === usernameLower
        );

        if (!stillHasMessageThisRound) {
          submittedUsers.delete(usernameLower);
        }
      }
    }

    io.emit("playerCount", { count: activeUsers.size });
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
