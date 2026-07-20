const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "IGAAYDbM8KbPFBZAFlZANGFJekpfYVNHNlhRVFNMMG1IRlQ2VFN2RW1PbS1vZAVh5UUE3NHZAVeGFvc0lVRWxkaV9xT2JNQjFab3gxSWNkd0FNSXo0dzQwMnRfb1psd3RqT3N3U3lsT2dTT2hEYWYzU1VRZAmMwNlRFQWkxUmhqUXBzawZDZD";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ABCD1234";

// --- دالة الذكاء الاصطناعي الجديدة ---
async function getAvetaarAIResponse(userMessage) {
  try {
    // 1. جلب التوكن باستخدام Regex بدلاً من Cheerio
    const responsePage = await axios.get("https://aichat.org/chat");
    const match = responsePage.data.match(/<meta name="csrf-token" content="([^"]+)"/);
    const csrfToken = match ? match[1] : null;

    if (!csrfToken) return "❌ تعذر الحصول على الاتصال.";

    // 2. إرسال السؤال
    const response = await axios.post("https://aichat.org/api/chat", {
      model: "perplexity/sonar",
      messages: [{ role: "user", content: "أجب بالعربية فقط وباختصار. " + userMessage }],
      stream: false
    }, {
      headers: {
        "X-CSRF-TOKEN": csrfToken,
        "Content-Type": "application/json",
        "Referer": "https://aichat.org/chat",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const reply = response.data.choices[0].message.content;
    return `${reply}\n\n𓄼𝗗𝗲𝘃𓄹: @avetaar`;
  } catch (error) {
    console.error("❌ خطأ AI:", error.message);
    return "❌ حدث خطأ في التواصل مع الذكاء الاصطناعي.\n\n𓄼𝗗𝗲𝘃𓄹: @avetaar";
  }
}
// 🛠️ دالة جلب الرابط المباشر
async function getMediaDirectUrl(reelUrl) {
  try {
    const response = await axios.post("https://api.downloadgram.org/media", new URLSearchParams({ url: reelUrl, v: "3", lang: "en" }).toString(), {
      headers: { "Referer": "https://downloadgram.org/", "Content-Type": "application/x-www-form-urlencoded" }
    });
    const match = response.data.match(/href=\\x22(https:\/\/[^\\"]+)/);
    return match ? match[1] : null;
  } catch (error) { return null; }
}

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) return res.status(200).send(req.query['hub.challenge']);
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  if (req.body.object === 'instagram') {
    for (const entry of req.body.entry) {
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const senderId = event.sender?.id;
          if (!senderId) continue;

          // معالجة النصوص (الذكاء الاصطناعي الجديد)
          if (event.message?.text) {
            const aiReply = await getAvetaarAIResponse(event.message.text);
            await sendReply(senderId, aiReply);
            await sendGenericTemplate(senderId);
            continue;
          }

          // معالجة الريلز
          if (event.message?.attachments) {
            for (const attachment of event.message.attachments) {
              if (attachment.type === 'ig_reel') {
                const directUrl = await getMediaDirectUrl(attachment.payload.url);
                if (directUrl) await sendInstagramReel(senderId, directUrl);
                else await sendReply(senderId, "❌ تعذر تحميل المقطع.");
                break;
              }
            }
          }
        }
      }
    }
  }
});

// --- الدوال ---
async function sendGenericTemplate(recipientId) {
    // كود القالب كما هو
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: { attachment: { type: "template", payload: { template_type: "generic", elements: [{ title: "مطور البوت 📲", image_url: "https://i.ibb.co/TBPXVL2K/photo-5872718112396872742-x.jpg", subtitle: "تواصل مع المطور", default_action: { type: "web_url", url: "https://wa.me/message/VTOVK35COW4RG1" }, buttons: [{ type: "web_url", url: "https://wa.me/message/VTOVK35COW4RG1", title: "تواصل" }] }] } } },
      messaging_type: "RESPONSE"
    }).catch(err => console.error(err.message));
}

async function sendInstagramReel(senderId, url) {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      messaging_type: "RESPONSE",
      recipient: { id: senderId },
      message: { attachment: { type: "video", payload: { url: url } } }
    }).then(() => sendGenericTemplate(senderId)).catch(err => console.error(err.message));
}

async function sendReply(recipientId, messageText) {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: { text: messageText },
      messaging_type: "RESPONSE"
    }).catch(err => console.error(err.message));
}

module.exports = app;
