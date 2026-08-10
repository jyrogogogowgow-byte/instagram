const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "IGAAYDbM8KbPFBZAFlZANGFJekpfYVNHNlhRVFNMMG1IRlQ2VFN2RW1PbS1vZAVh5UUE3NHZAVeGFvc0lVRWxkaV9xT2JNQjFab3gxSWNkd0FNSXo0dzQwMnRfb1psd3RqT3N3U3lsT2dTT2hEYWYzU1VRZAmMwNlRFQWkxUmhqUXBzawZDZD";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ABCD1234";

const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || "";
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";

// 🛠️ جلب الرابط المباشر باستعمال API الجديد
async function getMediaDirectUrl(reelUrl) {
  try {
    const apiUrl = `https://api-yout-gray.vercel.app/api/download?url=${encodeURIComponent(reelUrl)}`;

    const response = await axios.get(apiUrl, {
      timeout: 15000,
      headers: {
        "Accept": "application/json"
      }
    });

    const data = response.data;

    if (data && data.success === true && data.url) {
      console.log("✅ تم استخراج رابط الفيديو");
      return data.url;
    }

    console.log("❌ API لم يرجع رابط الفيديو:", data);
    return null;

  } catch (error) {
    console.error(
      "❌ خطأ في الاتصال بـ API:",
      error.response?.data || error.message
    );
    return null;
  }
}
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  if (req.body.object === 'instagram') {
    for (const entry of req.body.entry) {
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const senderId = event.sender && event.sender.id;
          if (!senderId) continue;

          if (event.message && event.message.text) {
            await sendGenericTemplate(senderId);
            continue;
          }

          if (event.message && event.message.attachments) {
            let reelFound = false;
            for (const attachment of event.message.attachments) {
              if (attachment.type === 'ig_reel' && attachment.payload && attachment.payload.url) {
                reelFound = true;
                await sendReply(senderId, "⏳ يتم معالجة واستخراج الريلز...");

                try {
                  const reelUrl = attachment.payload.url; 
                  const directUrl = await getMediaDirectUrl(reelUrl);

                  if (directUrl) {
                    await sendInstagramReel(senderId, directUrl); 
                  } else {
                    await sendReply(senderId, "❌ عذراً، لم أتمكن من جلب هذا المقطع.");
                  }
                } catch (err) {
                  await sendReply(senderId, "❌ وقع خطأ غير متوقع.");
                }
                break;
              }
            }
            if (!reelFound) await sendReply(senderId, "🚨 المرفق غير مدعوم.");
          }
        }
      }
    }
  }
});

// --- بقية الدوال ---
async function sendGenericTemplate(recipientId) {
  try {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: " مطور البوت 📲",
              image_url: "https://i.ibb.co/h1x9YLDV/26545.png",
              subtitle: "تواصل مع مطور البوت فحال توقف 🛑",
              default_action: { type: "web_url", url: "https://www.instagram.com/am_mo1_25_" },
              buttons: [{ type: "web_url", url: "https://www.instagram.com/am_mo1_25_", title: "تواصل" }]
            }]
          }
        }
      },
      messaging_type: "RESPONSE"
    });
  } catch (err) { console.error("❌ خطأ:", err.message); }
}

async function sendInstagramReel(senderId, url) {
  try {
    const sendResponse = await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      messaging_type: "RESPONSE",
      recipient: { id: senderId },
      message: { attachment: { type: "video", payload: { url: url } } }
    });
    if (sendResponse.status === 200) {
      await sendGenericTemplate(senderId);
      if (FACEBOOK_PAGE_ID && FACEBOOK_PAGE_ACCESS_TOKEN) {
        await postVideoToFacebook(url, "📥 لتحميل الريلز بدون تطبيق قم بتجربة: https://instagram.com/am_mo111_25_");
      }
    }
  } catch (error) { console.error("❌ خطأ في إرسال الفيديو:", error.message); }
}

async function sendReply(recipientId, messageText) {
  try {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: { text: messageText },
      messaging_type: "RESPONSE"
    });
  } catch (err) { console.error("❌ فشل:", err.message); }
}

async function postVideoToFacebook(videoUrl, caption) {
  try {
    await axios.post(`https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos`, new URLSearchParams({
      file_url: videoUrl,
      description: caption,
      access_token: FACEBOOK_PAGE_ACCESS_TOKEN
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  } catch (err) { console.error("❌ خطأ نشر فيسبوك:", err.message); }
}

module.exports = app;
