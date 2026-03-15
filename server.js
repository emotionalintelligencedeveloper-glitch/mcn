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

/* DO NOT CHANGE — YOUR SECRETS */
const API_KEY = process.env.MY_SECRET_API_KEY;
const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_PW = process.env.ADMIN_PW;

/* GAME CONSTANTS */

const VOTE_TARGET = 10;
const WORD_TARGET = 396;

let roundNumber = 1;

/* GAME STATE */

let game = {
  phase: "headline",
  lockedHeadlineText: "",
  storyPieces: [],
  finalStory: "",
  currentHeadlines: [],
  currentMessages: [],
  currentConclusions: [],
  headlineSubmissions: new Set(),
  messageSubmissions: new Set(),
  conclusionSubmissions: new Set(),
  votedUsers: new Set()
};

let activeUsers = new Map();

/* HELPERS */

function sanitize(value, max) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validUsername(username) {
  return /^[A-Za-z0-9._\- ]{1,31}$/.test(username);
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function publicState() {
  return {
    phase: game.phase,
    roundNumber,
    lockedHeadlineText: game.lockedHeadlineText,
    storyPieces: game.storyPieces,
    finalStory: game.finalStory,
    currentHeadlines: game.currentHeadlines,
    currentMessages: game.currentMessages,
    currentConclusions: game.currentConclusions,
    playerCount: activeUsers.size,
    voteTarget: VOTE_TARGET,
    wordTarget: WORD_TARGET
  };
}

function emitState() {
  io.emit("gameState", publicState());
  io.emit("playerCount", { count: activeUsers.size });
}

function getWinner(list) {
  if (!list.length) return null;
  return list.reduce((best, item) => {
    if (item.votes > best.votes) return item;
    if (item.votes === best.votes && item.createdAt < best.createdAt) return item;
    return best;
  });
}

/* SOCKET CONNECTION */

io.on("connection", (socket) => {

  socket.emit("gameState", publicState());

  /* REGISTER USER */

  socket.on("registerUser", (data = {}) => {

    const username = sanitize(data.username, 31);

    if (!validUsername(username)) {
      socket.emit("gameError", { message: "Invalid username." });
      return;
    }

    activeUsers.set(socket.id, username);

    socket.emit("registered", { username });

    emitState();
  });

  /* SUBMIT HEADLINE */

  socket.on("submitHeadline", (data = {}) => {

    if (game.phase !== "headline") {
      socket.emit("gameError", { message: "Headline round closed." });
      return;
    }

    const username = activeUsers.get(socket.id);
    if (!username) {
      socket.emit("gameError", { message: "Register first." });
      return;
    }

    const text = sanitize(data.text, 90);

    if (text.length < 2) {
      socket.emit("gameError", { message: "Headline too short." });
      return;
    }

    if (game.headlineSubmissions.has(username)) {
      socket.emit("gameError", { message: "Already submitted headline." });
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      text,
      username,
      votes: 0,
      createdAt: Date.now()
    };

    game.currentHeadlines.push(item);
    game.headlineSubmissions.add(username);

    io.emit("newHeadline", item);
    emitState();
  });

  /* SUBMIT MESSAGE */

  socket.on("submitMessage", (data = {}) => {

    if (game.phase !== "message") {
      socket.emit("gameError", { message: "Message round closed." });
      return;
    }

    const username = activeUsers.get(socket.id);

    const text = sanitize(data.text, 300);

    if (text.length < 2) {
      socket.emit("gameError", { message: "Message too short." });
      return;
    }

    if (game.messageSubmissions.has(username)) {
      socket.emit("gameError", { message: "Already submitted paragraph." });
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      text,
      username,
      votes: 0,
      createdAt: Date.now()
    };

    game.currentMessages.push(item);
    game.messageSubmissions.add(username);

    io.emit("newMessage", item);
    emitState();
  });

  /* SUBMIT CONCLUSION */

  socket.on("submitConclusion", (data = {}) => {

    if (game.phase !== "conclusion") {
      socket.emit("gameError", { message: "Conclusion round closed." });
      return;
    }

    const username = activeUsers.get(socket.id);

    const text = sanitize(data.text, 300);

    if (text.length < 2) {
      socket.emit("gameError", { message: "Conclusion too short." });
      return;
    }

    if (game.conclusionSubmissions.has(username)) {
      socket.emit("gameError", { message: "Already submitted conclusion." });
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      text,
      username,
      votes: 0,
      createdAt: Date.now()
    };

    game.currentConclusions.push(item);
    game.conclusionSubmissions.add(username);

    io.emit("newConclusion", item);
    emitState();
  });

  /* VOTE */

  socket.on("castVote", ({ messageId }) => {

    if (game.votedUsers.has(socket.id)) {
      socket.emit("gameError", { message: "Already voted." });
      return;
    }

    let list;

    if (game.phase === "headline") list = game.currentHeadlines;
    if (game.phase === "message") list = game.currentMessages;
    if (game.phase === "conclusion") list = game.currentConclusions;

    const item = list.find(x => x.id === messageId);

    if (!item) return;

    item.votes++;

    game.votedUsers.add(socket.id);

    io.emit("updateVotes", { id: item.id, votes: item.votes });

    emitState();
  });

  /* ADMIN DELETE */

  socket.on("adminDelete", (data = {}) => {

    if (data.adminId !== ADMIN_ID || data.adminPw !== ADMIN_PW) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    const { phase, messageId } = data;

    let list;

    if (phase === "headline") list = game.currentHeadlines;
    if (phase === "message") list = game.currentMessages;
    if (phase === "conclusion") list = game.currentConclusions;

    const updated = list.filter(x => x.id !== messageId);

    if (phase === "headline") game.currentHeadlines = updated;
    if (phase === "message") game.currentMessages = updated;
    if (phase === "conclusion") game.currentConclusions = updated;

    io.emit("submissionRemoved", { phase, id: messageId });

    emitState();
  });

  /* FINALIZE ROUND */

  socket.on("finalizeRound", (data = {}) => {

    if (data.adminId !== ADMIN_ID || data.adminPw !== ADMIN_PW) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    if (game.phase === "headline") {

      const winner = getWinner(game.currentHeadlines);
      if (!winner) return;

      game.lockedHeadlineText = winner.text;

      game.currentHeadlines = [];
      game.headlineSubmissions.clear();
      game.votedUsers.clear();

      game.phase = "message";

      io.emit("roundFinalized", { winner });

      emitState();
      return;
    }

    if (game.phase === "message") {

      const winner = getWinner(game.currentMessages);
      if (!winner) return;

      game.storyPieces.push({ text: winner.text });

      const words = wordCount(game.storyPieces.map(x => x.text).join(" "));

      game.currentMessages = [];
      game.messageSubmissions.clear();
      game.votedUsers.clear();

      roundNumber++;

      if (words >= WORD_TARGET) {
        game.phase = "conclusion";
      }

      io.emit("roundFinalized", { winner });

      emitState();
      return;
    }

    if (game.phase === "conclusion") {

      const winner = getWinner(game.currentConclusions);
      if (!winner) return;

      const storyBody = game.storyPieces.map(x => x.text).join(" ");

      game.finalStory = `${game.lockedHeadlineText}\n\n${storyBody}\n\n${winner.text}`;

      game.phase = "published";

      io.emit("roundFinalized", { winner });

      emitState();
    }
  });

  /* DISCONNECT */

  socket.on("disconnect", () => {

    activeUsers.delete(socket.id);
    game.votedUsers.delete(socket.id);

    emitState();
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Game server running on port", PORT);
});
