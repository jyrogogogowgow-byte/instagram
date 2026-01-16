const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const { get, set } = require("@vercel/edge-config");

const app = express();
app.use(bodyParser.json());

// ================== CONFIG ==================
const PAGE_ACCESS_TOKEN = "IGAAKBNjRZBjsNBZAFppXzVwQzRLcHhlUnhLa0JvaXpaWWxHaGNHNEIzeHJhak1uZAnV0aEQ3UkVQMXVvZAndDVFZAjeDU0dWtoZAjQ5aER5b1djZAG9SZAktXLU9LNnhBRlhpUXZATOFBBMzRTREN6bW5YUWFicUpnR3dGd1JOekxVOWduQQZDZD";
const VERIFY_TOKEN = "ABCD123224";


const INSTAGRAM_PROFILE_URL = "https://instagram.com/am_mo111_25_";

// ============================================

// 🔐 Check user
async function isUserAllowed(userId) {
  const users = (await get("allowedUsers")) || [];
  return users.includes(userId);
}

// 💾 Save user
async function saveUser(userId) {
  const users = (await get("allowedUsers")) || [];
  if (!users.includes(userId)) {
    users.push(userId);
    await set("allowedUsers", users);
  }
}

// 📩 Text message
async function sendReply(recipientId, text) {
  await axios.post(
    `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text }
    }
  );
}

// 🔔 Follow template
async function sendFollowTemplate(recipientId) {
  await axios.post(
    `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: "⚠️ خاصك تتابع الحساب",
                subtitle: "تابع الحساب باش تقدر تستعمل البوت",
                buttons: [
                  {
                    type: "web_url",
                    url: INSTAGRAM_PROFILE_URL,
                    title: "✅ متابعة"
                  }
                ]
              }
            ]
          }
        }
      }
    }
  );
}

// 📦 Main template
async function sendGenericTemplate(recipientId) {
  await axios.post(
    `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: "📲 تحميل التطبيق",
                subtitle: "اضغط هنا لتحميل التطبيق",
                buttons: [
                  {
                    type: "web_url",
                    url: "https://whatsapp.com/channel/0029VbAgby79sBICj1Eg7h0h/102",
                    title: "تحميل الآن"
                  }
                ]
              }
            ]
          }
        }
      }
    }
  );
}

// ================== WEBHOOK ==================

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  if (req.body.object !== "instagram") return res.sendStatus(404);

  for (const entry of req.body.entry) {
    if (!entry.messaging) continue;

    for (const event of entry.messaging) {
      const senderId = event.sender?.id;
      if (!senderId) continue;

      // 📩 Text message
      if (event.message?.text) {
        const text = event.message.text.trim();

        const allowed = await isUserAllowed(senderId);

        // ❌ not allowed
        if (!allowed) {
          if (text === "تم") {
            await saveUser(senderId);
            await sendReply(senderId, "✅ مرحباً! دابا تقدر تستعمل البوت.");
            await sendGenericTemplate(senderId);
            continue;
          }

          await sendFollowTemplate(senderId);
          await sendReply(senderId, "📌 من بعد المتابعة كتب: تم");
          continue;
        }

        // ✅ allowed
        await sendGenericTemplate(senderId);
      }
    }
  }

  res.sendStatus(200);
});

// ============================================

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Instagram bot running on Vercel");
});
