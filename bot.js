const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const Database = require("better-sqlite3");

// מספר השדכן (בפורמט וואטסאפ JID)
const SHADCHAN_JID = "972526230014@s.whatsapp.net";

// מסד נתונים
const db = new Database("database.db");

// יצירת טבלאות אם לא קיימות
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_number TEXT NOT NULL,
    name TEXT,
    last_status TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// מצב שיחה זמני בזיכרון
const conversationState = {}; // key: wa_number, value: { stage: 'ask_name' | 'ask_status', name: string }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBot();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const senderJid = msg.key.remoteJid;
      const waNumber = senderJid.split("@")[0]; // למשל 9725XXXXXXX

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text) return;

      console.log("Message from", waNumber, ":", text);

      await handleMessage(sock, waNumber, senderJid, text.trim());
    }
  });
}

function getMatchByNumber(waNumber) {
  const stmt = db.prepare("SELECT * FROM matches WHERE wa_number = ?");
  return stmt.get(waNumber);
}

function createOrUpdateName(waNumber, name) {
  const existing = getMatchByNumber(waNumber);
  if (existing) {
    const stmt = db.prepare("UPDATE matches SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_number = ?");
    stmt.run(name, waNumber);
  } else {
    const stmt = db.prepare("INSERT INTO matches (wa_number, name) VALUES (?, ?)");
    stmt.run(waNumber, name);
  }
}

function updateStatus(waNumber, status) {
  const stmt = db.prepare("UPDATE matches SET last_status = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_number = ?");
  stmt.run(status, waNumber);
}

async function sendMessage(sock, jid, text) {
  await sock.sendMessage(jid, { text });
}

async function handleMessage(sock, waNumber, senderJid, text) {
  const match = getMatchByNumber(waNumber);
  const state = conversationState[waNumber] || {};

  // אם אין שם עדיין – מתחילים בשיחה
  if (!match || !match.name) {
    if (!state.stage) {
      // שלב ראשון: המדוייט כתב משהו – נתחיל ב"היי! איך קוראים לך?"
      conversationState[waNumber] = { stage: "ask_name" };
      await sendMessage(sock, senderJid, "היי! איך קוראים לך?");
      return;
    }

    if (state.stage === "ask_name") {
      const name = text;
      createOrUpdateName(waNumber, name);
      conversationState[waNumber] = { stage: "ask_status", name };
      await sendMessage(sock, senderJid, `נעים מאוד ${name}! מה הסטטוס שלך?`);
      return;
    }

    if (state.stage === "ask_status") {
      const name = state.name;
      const status = text;

      updateStatus(waNumber, status);

      // הודעה לשדכן
      const shadchanText = `המדוייט ${name} עדכן סטטוס:\n${status}`;
      await sendMessage(sock, SHADCHAN_JID, shadchanText);

      // תשובה למדויט
      await sendMessage(sock, senderJid, `תודה ${name}! עדכנתי את השדכן.`);

      // מנקים מצב שיחה
      delete conversationState[waNumber];
      return;
    }
  } else {
    // יש כבר שם – נניח שכל הודעה חדשה היא סטטוס
    const name = match.name;
    const status = text;

    updateStatus(waNumber, status);

    const shadchanText = `המדוייט ${name} עדכן סטטוס:\n${status}`;
    await sendMessage(sock, SHADCHAN_JID, shadchanText);

    await sendMessage(sock, senderJid, `תודה ${name}! עדכנתי את השדכן.`);
  }
}

startBot().catch((err) => {
  console.error("Bot error:", err);
});
