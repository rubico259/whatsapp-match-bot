const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const sqlite3 = require("sqlite3").verbose();

// מספר השדכן
const SHADCHAN_JID = "972526230014@s.whatsapp.net";

// מסד נתונים
const db = new sqlite3.Database("database.db");

// יצירת טבלה אם לא קיימת
db.run(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_number TEXT NOT NULL,
    name TEXT,
    last_status TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const conversationState = {};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    emitQR: true,
    qrTimeout: 0
  });

  // QR דרך האירוע הראשי
  sock.ev.on("qr", qr => {
    console.log("SCAN THIS QR:\n" + qr);
  });

  // QR גם דרך connection.update (חשוב ל‑Render!)
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("SCAN THIS QR:\n" + qr);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const senderJid = msg.key.remoteJid;
      const waNumber = senderJid.split("@")[0];

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text) return;

      await handleMessage(sock, waNumber, senderJid, text.trim());
    }
  });
}

function getMatchByNumber(waNumber, cb) {
  db.get("SELECT * FROM matches WHERE wa_number = ?", [waNumber], cb);
}

function createOrUpdateName(waNumber, name) {
  getMatchByNumber(waNumber, (err, row) => {
    if (row) {
      db.run(
        "UPDATE matches SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_number = ?",
        [name, waNumber]
      );
    } else {
      db.run(
        "INSERT INTO matches (wa_number, name) VALUES (?, ?)",
        [waNumber, name]
      );
    }
  });
}

function updateStatus(waNumber, status) {
  db.run(
    "UPDATE matches SET last_status = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_number = ?",
    [status, waNumber]
  );
}

async function sendMessage(sock, jid, text) {
  await sock.sendMessage(jid, { text });
}

async function handleMessage(sock, waNumber, senderJid, text) {
  getMatchByNumber(waNumber, async (err, match) => {
    const state = conversationState[waNumber] || {};

    if (!match || !match.name) {
      if (!state.stage) {
        conversationState[waNumber] = { stage: "ask_name" };
        return sendMessage(sock, senderJid, "היי! איך קוראים לך?");
      }

      if (state.stage === "ask_name") {
        const name = text;
        createOrUpdateName(waNumber, name);
        conversationState[waNumber] = { stage: "ask_status", name };
        return sendMessage(sock, senderJid, `נעים מאוד ${name}! מה הסטטוס שלך?`);
      }

      if (state.stage === "ask_status") {
        const name = state.name;
        const status = text;

        updateStatus(waNumber, status);

        await sendMessage(sock, SHADCHAN_JID, `המדוייט ${name} עדכן סטטוס:\n${status}`);
        await sendMessage(sock, senderJid, `תודה ${name}! עדכנתי את השדכן.`);

        delete conversationState[waNumber];
        return;
      }
    } else {
      const name = match.name;
      const status = text;

      updateStatus(waNumber, status);

      await sendMessage(sock, SHADCHAN_JID, `המדוייט ${name} עדכן סטטוס:\n${status}`);
      await sendMessage(sock, senderJid, `תודה ${name}! עדכנתי את השדכן.`);
    }
  });
}

startBot().catch(console.error);
