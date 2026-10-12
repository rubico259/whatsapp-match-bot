const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// פרטי החשבון שלך ב‑Ultramsg
const INSTANCE_ID = "instance194153";
const TOKEN = "jyp7m647msdfns44";

// פונקציה לשליחת הודעה
async function sendMessage(to, message) {
  try {
    const url = `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`;
    const data = {
      token: TOKEN,
      to: to,
      body: message
    };

    const res = await axios.post(url, data);
    console.log("Message sent:", res.data);
  } catch (err) {
    console.error("Error sending message:", err.response?.data || err.message);
  }
}

// Webhook לקבלת הודעות נכנסות
app.post("/webhook", async (req, res) => {
  const data = req.body;

  console.log("Incoming message:", data);

  const from = data.from;     // מספר השולח
  const message = data.body;  // תוכן ההודעה

  // תגובה אוטומטית
  await sendMessage(from, "קיבלתי את ההודעה שלך 🤖");

  res.sendStatus(200);
});

// הפעלת השרת
app.listen(3000, () => {
  console.log("Bot is running on port 3000");
});
