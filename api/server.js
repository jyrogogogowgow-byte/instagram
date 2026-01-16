const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// ================= CONFIG =================
const PAGE_ACCESS_TOKEN = "IGAAKBNjRZBjsNBZAFppXzVwQzRLcHhlUnhLa0JvaXpaWWxHaGNHNEIzeHJhak1uZAnV0aEQ3UkVQMXVvZAndDVFZAjeDU0dWtoZAjQ5aER5b1djZAG9SZAktXLU9LNnhBRlhpUXZATOFBBMzRTREN6bW5YUWFicUpnR3dGd1JOekxVOWduQQZDZD";
const VERIFY_TOKEN = "ABCD123224";


 EDGE_CONFIG_TOKEN = "b0087761-db31-4552-809b-d0966e37c0be";
EDGE_CONFIG_ID = "ecfg_xhxmsvazo3rzwucxuji0i4g0v4ch";
const INSTAGRAM_PROFILE_URL = "https://instagram.com/am_mo111_25_";

// =========================================

// 🧠 Edge Config helpers (REST API)
async function getAllowedUsers() {
  const res = await axios.get(
    `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
    {
      headers: {
        Authorization: `Bearer ${EDGE_CONFIG_TOKEN}`
      }
    }
  );

  const item = res.data.items.find(i => i.key === "allowedUsers");
  return item ? item.value : [];
}

async function saveAllowedUsers(users) {
  await axios.patch(
    `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
    {
      items: [
        {
          key: "allowedUsers",
          value: users
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${EDGE_CONFIG_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

async function isUserAllowed(userId) {
  const users = await getAllowedUsers();
  return users.includes(userId);
}

async function addUser(userId) {
  const users = await getAllowedUsers();
  if (!users.includes(userId)) {
    users.push(userId);
    await saveAllowedUsers(users);
  }
}

// 📩 إرسال رسالة نصية
async function sendReply(id, text) {
  await axios.post(
    `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id },
      messaging_type: "RESPONSE",
      message: { text }
    }
  );
}

// 🔔 قالب المتابعة
async function sendFollowTemplate(id) {
  await axios.post(
    `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id },
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

// 📦 قالب الخدمة
async function sendGenericTemplate(id) {
  await axios.post(
    `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id },
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

// ================= WEBHOOK =================

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

      if (event.message?.text) {
        const text = event.message.text.trim();

        const allowed = await isUserAllowed(senderId);

        // ❌ ما تابعش
        if (!allowed) {
          if (text === "تم") {
            await addUser(senderId);
            await sendReply(senderId, "✅ مرحباً! دابا تقدر تستعمل البوت.");
            await sendGenericTemplate(senderId);
            continue;
          }

          await sendFollowTemplate(senderId);
          await sendReply(senderId, "📌 من بعد المتابعة رجع وكتب: تم");
          continue;
        }

        // ✅ تابع
        await sendGenericTemplate(senderId);
      }
    }
  }

  res.sendStatus(200);
});

// ==========================================

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Instagram bot running");
});
