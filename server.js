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
const MAX_PAST_GAMES = 50;

/* ROUND NUMBER */
let roundNumber = 1;

/* GAME STATE */
let game = createFreshGame();
let activeUsers = new Map();
let pastGames = [];

/* HELPERS */

function createFreshGame() {
  return {
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
}

function sanitize(value, max) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanSubmission(text) {
  return String(text || "")
    .replace(/Here is a \*\*\d+\-word message[\s\S]*?\-\-\-/gi, "")
    .replace(/Here is a\s+\d+\-word message[\s\S]*?\-\-\-/gi, "")
    .replace(/\*\*/g, "")
    .replace(/^---+/gm, "")
    .replace(/^\s*Title:\s*/gim, "")
    .replace(/^\s*Headline:\s*/gim, "")
    .trim();
}

function sanitizeStoryText(value, max) {
  return sanitize(cleanSubmission(value), max);
}

function validUsername(username) {
  return /^[A-Za-z0-9._\- ]{1,31}$/.test(username);
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function isAdminValid(data = {}) {
  return data.adminId === ADMIN_ID && data.adminPw === ADMIN_PW;
}

function formatWinnerCredit(item = {}) {
  const name = item.name || item.username || "Anonymous";
  const social = item.social || "";
  const handle = item.handle || "";

  if (social && handle) return `${name} (${social}: ${handle})`;
  if (handle) return `${name} (${handle})`;
  return name;
}

function buildFinalStoryFromPieces(storyGame = game) {
  const headline = storyGame.lockedHeadlineText || "";
  const pieces = Array.isArray(storyGame.storyPieces) ? storyGame.storyPieces : [];

  const body = pieces.map((piece) => {
    return `${piece.text}\n— Won by ${formatWinnerCredit(piece)}`;
  }).join("\n\n");

  return [headline, body].filter(Boolean).join("\n\n");
}

function publicPastGames() {
  return pastGames.map((item) => ({
    lockedHeadlineText: item.lockedHeadlineText,
    storyPieces: item.storyPieces,
    finalStory: item.finalStory,
    roundNumber: item.roundNumber,
    completedAt: item.completedAt,
    completedAtLabel: item.completedAtLabel
  }));
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
    wordTarget: WORD_TARGET,
    pastGames: publicPastGames()
  };
}

function emitState() {
  io.emit("gameState", publicState());
  io.emit("playerCount", { count: activeUsers.size });
}

function getWinner(list) {
  if (!Array.isArray(list) || !list.length) return null;

  return list.reduce((best, item) => {
    if (item.votes > best.votes) return item;
    if (item.votes === best.votes && item.createdAt < best.createdAt) return item;
    return best;
  });
}

function getListForPhase(phase) {
  if (phase === "headline") return game.currentHeadlines;
  if (phase === "message") return game.currentMessages;
  if (phase === "conclusion") return game.currentConclusions;
  return null;
}

function resetToNewGame() {
  game = createFreshGame();
  roundNumber = 1;
}

function removeUsernameSubmissionLock(phase, removedItem) {
  if (!removedItem || !removedItem.username) return;

  if (phase === "headline") {
    game.headlineSubmissions.delete(removedItem.username);
  }

  if (phase === "message") {
    game.messageSubmissions.delete(removedItem.username);
  }

  if (phase === "conclusion") {
    game.conclusionSubmissions.delete(removedItem.username);
  }
}

function archiveCurrentPublishedGame() {
  if (!game.lockedHeadlineText && !game.storyPieces.length && !game.finalStory) {
    return;
  }

  const finalStory = game.finalStory || buildFinalStoryFromPieces(game);

  pastGames.push({
    lockedHeadlineText: game.lockedHeadlineText,
    storyPieces: Array.isArray(game.storyPieces)
      ? game.storyPieces.map((piece) => ({
          text: piece.text || "",
          username: piece.username || "",
          name: piece.name || "",
          social: piece.social || "",
          handle: piece.handle || ""
        }))
      : [],
    finalStory,
    roundNumber,
    completedAt: Date.now(),
    completedAtLabel: new Date().toLocaleString("en-ZA")
  });

  if (pastGames.length > MAX_PAST_GAMES) {
    pastGames = pastGames.slice(-MAX_PAST_GAMES);
  }
}

function deletePastGameByIndex(index) {
  if (!Number.isInteger(index)) return false;
  if (index < 0 || index >= pastGames.length) return false;

  pastGames.splice(index, 1);
  return true;
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

    const text = sanitizeStoryText(data.text, 90);

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
      name: sanitize(data.name, 24),
      social: sanitize(data.social, 24),
      handle: sanitize(data.handle, 31),
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
    if (!username) {
      socket.emit("gameError", { message: "Register first." });
      return;
    }

    const text = sanitizeStoryText(data.text, 300);

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
      name: sanitize(data.name, 24),
      social: sanitize(data.social, 24),
      handle: sanitize(data.handle, 31),
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
    if (!username) {
      socket.emit("gameError", { message: "Register first." });
      return;
    }

    const text = sanitizeStoryText(data.text, 300);

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
      name: sanitize(data.name, 24),
      social: sanitize(data.social, 24),
      handle: sanitize(data.handle, 31),
      votes: 0,
      createdAt: Date.now()
    };

    game.currentConclusions.push(item);
    game.conclusionSubmissions.add(username);

    io.emit("newConclusion", item);
    emitState();
  });

  /* VOTE */

  socket.on("castVote", ({ messageId } = {}) => {
    if (game.votedUsers.has(socket.id)) {
      socket.emit("gameError", { message: "Already voted." });
      return;
    }

    const list = getListForPhase(game.phase);

    if (!list) {
      socket.emit("gameError", { message: "Voting is not open right now." });
      return;
    }

    const item = list.find((x) => x.id === messageId);

    if (!item) {
      socket.emit("gameError", { message: "Vote target not found." });
      return;
    }

    item.votes += 1;
    game.votedUsers.add(socket.id);

    io.emit("updateVotes", { id: item.id, votes: item.votes });
    emitState();
  });

  /* ADMIN DELETE SUBMISSION */

  socket.on("adminDelete", (data = {}) => {
    if (!isAdminValid(data)) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    const { phase, messageId } = data;
    const list = getListForPhase(phase);

    if (!list) {
      socket.emit("gameError", { message: "Invalid delete phase." });
      return;
    }

    const removedItem = list.find((x) => x.id === messageId);

    if (!removedItem) {
      socket.emit("gameError", { message: "Submission not found." });
      return;
    }

    if (phase === "headline") {
      game.currentHeadlines = game.currentHeadlines.filter((x) => x.id !== messageId);
    }

    if (phase === "message") {
      game.currentMessages = game.currentMessages.filter((x) => x.id !== messageId);
    }

    if (phase === "conclusion") {
      game.currentConclusions = game.currentConclusions.filter((x) => x.id !== messageId);
    }

    removeUsernameSubmissionLock(phase, removedItem);

    io.emit("submissionRemoved", { phase, id: messageId });
    emitState();
  });

  /* ADMIN DELETE PAST GAME */

  socket.on("adminDeletePastGame", (data = {}) => {
    if (!isAdminValid(data)) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    const index = Number(data.pastGameIndex);

    if (!Number.isInteger(index) || index < 0 || index >= pastGames.length) {
      socket.emit("gameError", { message: "Past game not found." });
      return;
    }

    const deleted = deletePastGameByIndex(index);

    if (!deleted) {
      socket.emit("gameError", { message: "Failed to delete past game." });
      return;
    }

    io.emit("pastGameDeleted", {
      index,
      pastGames: publicPastGames()
    });

    emitState();
  });

  /* ADMIN RESET / DELETE PUBLISHED STORY */

  socket.on("adminDeletePublishedStory", (data = {}) => {
    if (!isAdminValid(data)) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    resetToNewGame();

    io.emit("publishedStoryDeleted");
    emitState();
  });

  /* FINALIZE ROUND */

  socket.on("finalizeRound", (data = {}) => {
    if (!isAdminValid(data)) {
      socket.emit("gameError", { message: "Unauthorized admin action." });
      return;
    }

    if (game.phase === "headline") {
      const winner = getWinner(game.currentHeadlines);

      if (!winner) {
        socket.emit("gameError", { message: "No headline submissions to finalize." });
        return;
      }

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

      if (!winner) {
        socket.emit("gameError", { message: "No message submissions to finalize." });
        return;
      }

      game.storyPieces.push({
        text: winner.text,
        username: winner.username || "",
        name: winner.name || "",
        social: winner.social || "",
        handle: winner.handle || ""
      });

      const words = wordCount(game.storyPieces.map((x) => x.text).join(" "));

      game.currentMessages = [];
      game.messageSubmissions.clear();
      game.votedUsers.clear();

      roundNumber += 1;

      if (words >= WORD_TARGET) {
        game.phase = "conclusion";
      }

      io.emit("roundFinalized", { winner });
      emitState();
      return;
    }

    if (game.phase === "conclusion") {
      const winner = getWinner(game.currentConclusions);

      if (!winner) {
        socket.emit("gameError", { message: "No conclusion submissions to finalize." });
        return;
      }

      game.storyPieces.push({
        text: winner.text,
        username: winner.username || "",
        name: winner.name || "",
        social: winner.social || "",
        handle: winner.handle || ""
      });

      game.finalStory = buildFinalStoryFromPieces(game);
      game.phase = "published";
      game.currentConclusions = [];
      game.conclusionSubmissions.clear();
      game.votedUsers.clear();

      archiveCurrentPublishedGame();

      io.emit("roundFinalized", { winner, finalStory: game.finalStory });
      emitState();
      return;
    }

    if (game.phase === "published") {
      socket.emit("gameError", { message: "Story is already published." });
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
