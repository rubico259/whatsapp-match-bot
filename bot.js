const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// רק אתה והשדכן מורשים להפעיל את הבוט
const allowedUsers = [
  "972544502160", // אתה
  "972526230014"  // השדכן
];

app.post("/webhook", async (req, res) => {
  const message = req.body;

  if (!allowedUsers.includes(message.from)) {
    return res.sendStatus(200);
  }

  const text = (message.body || "").trim();

  // זיהוי חכם של הפקודה
  const normalized = text.replace(/\s+/g, " ").replace(/[:\-–]/g, "").trim();

  if (normalized.includes("עדכן") && normalized.includes("שדכן")) {

    const update = normalized
      .replace("עדכן את השדכן", "")
      .replace("עדכן שדכן", "")
      .replace("תעדכן את השדכן", "")
      .replace("תעדכן שדכן", "")
      .trim();

    await sendMessage("972526230014", `ראובן עדכן: ${update || "(אין תוכן)"}`);
    await sendMessage(message.from, "העדכון נשלח לשדכן ✔️");
  }

  res.sendStatus(200);
});

// פונקציה ששולחת הודעה דרך Ultramsg
async function sendMessage(to, text) {
  try {
    await axios.post(
      "https://api.ultramsg.com/instance194153/messages/chat",
      {
        to,
        body: text
      },
      {
        headers: {
          "Content-Type": "application/json",
          "token": "jyp7m647msdfns44"
        }
      }
    );
  } catch (err) {
    console.error("Error sending message:", err.response?.data || err);
  }
}

app.listen(3000, () => {
  console.log("Bot is running on port 3000");
});
