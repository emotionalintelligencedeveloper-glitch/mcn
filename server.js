const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors({
  origin: "https://emotionalintelligencedeveloper-glitch.github.io"
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://emotionalintelligencedeveloper-glitch.github.io",
    methods: ["GET", "POST"]
  }
});

const API_KEY = process.env.MY_SECRET_API_KEY;
const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_PW = process.env.ADMIN_PW;

let currentMessages = [];
let fullMessage = "";
let roundActive = true;

io.on("connection", (socket) => {

  socket.emit("gameState", { fullMessage, currentMessages });

  socket.on("submitMessage", (data) => {

    if (!roundActive) return;

    const username = data.username?.trim();
    const text = data.text?.trim();

    if (!username || username.length > 31) return;

    const newMessage = {
      id: Date.now(),
      username,
      text,
      votes: 0
    };

    currentMessages.push(newMessage);

    io.emit("newMessage", newMessage);

  });

  socket.on("castVote", (messageId) => {

    const msg = currentMessages.find(m => m.id === messageId);

    if (!msg) return;

    msg.votes++;

    io.emit("updateVotes", {
      id: messageId,
      votes: msg.votes
    });

  });

  socket.on("adminDelete", (data) => {

    if (data.adminId !== ADMIN_ID) return;
    if (data.adminPw !== ADMIN_PW) return;

    currentMessages = currentMessages.filter(m => m.id !== data.messageId);

    io.emit("messageRemoved", data.messageId);

  });

  socket.on("finalizeRound", (data) => {

    if (data.adminId !== ADMIN_ID) return;
    if (data.adminPw !== ADMIN_PW) return;

    if (currentMessages.length === 0) return;

    const winner = currentMessages.reduce((prev, current) =>
      prev.votes > current.votes ? prev : current
    );

    fullMessage += " " + winner.text;

    currentMessages = [];

    io.emit("nextSection", { fullMessage });

  });

});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Game server running on port", PORT);
});
