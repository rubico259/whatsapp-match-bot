app.post("/webhook", async (req, res) => {
  const message = req.body;

  const allowedUsers = [
    "972544502160", // אתה
    "972526230014"  // השדכן
  ];

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
