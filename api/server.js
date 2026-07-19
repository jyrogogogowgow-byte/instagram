const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = "IGAAYDbM8KbPFBZAFlZANGFJekpfYVNHNlhRVFNMMG1IRlQ2VFN2RW1PbS1vZAVh5UUE3NHZAVeGFvc0lVRWxkaV9xT2JNQjFab3gxSWNkd0FNSXo0dzQwMnRfb1psd3RqT3N3U3lsT2dTT2hEYWYzU1VRZAmMwNlRFQWkxUmhqUXBzawZDZD";
const VERIFY_TOKEN = "ABCD1234";

// 🔵 إعدادات فيسبوك
const FACEBOOK_PAGE_ID = "";
const FACEBOOK_PAGE_ACCESS_TOKEN = "";

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  console.log("📦 Payload:", JSON.stringify(req.body, null, 2));

  if (req.body.object === 'instagram') {
    req.body.entry.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(async (event) => {
          const senderId = event.sender && event.sender.id;
          const messageId = event.message && event.message.mid;

          if (!senderId) return;

          if (event.message && event.message.text) {
            await sendGenericTemplate(senderId);
            return;
          }

          if (event.message && event.message.attachments) {
            let reelFound = false;

            for (const attachment of event.message.attachments) {
              if (attachment.type === 'ig_reel' && attachment.payload && attachment.payload.url) {
                reelFound = true;

                await sendReply(senderId, "⏳ يتم تحميل ريلز...");

                try {
                  const reelUrl = attachment.payload.url;
                  await sendInstagramReel(senderId, reelUrl); // ✅ الفيديو يُرسل أولاً
                } catch (err) {
                  await sendReply(senderId, "❌ وقع خطأ أثناء تحميل الريلز.");
                }

                return;
              }
            }

            if (!reelFound) {
              await sendReply(senderId, "🚨 المرفق غير مدعوم. يُرجى إرسال مقطع ريلز فقط.");
            }
          } else {
            await sendReply(senderId, "📩 يُرجى إرسال مقطع ريلز ليتم تحميله.");
          }
        });
      }
    });

    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

// 📌 قالب تحميل التطبيق
async function sendGenericTemplate(recipientId) {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [
                {
                  title: " مطور البوت 📲",
                  image_url: "https://i.ibb.co/TBPXVL2K/photo-5872718112396872742-x.jpg",
                  subtitle: "تواصل مع مطور البوت فحال  توقف 🛑 ",
                  default_action: {
                    type: "web_url",
                    url: "https://wa.me/message/VTOVK35COW4RG1" // رابط تحميل التطبيق
                  },
                  buttons: [
                    {
                      type: "web_url",
                      url: "https://wa.me/message/VTOVK35COW4RG1", // رابط تحميل التطبيق
                      title: "تواصل"
                        
              
                    }
                  ]
                }
              ]
            }
          }
        },
        messaging_type: "RESPONSE"
      }
    );

    console.log("✅ تم إرسال قالب تحميل التطبيق بنجاح.");
  } catch (err) {
    console.error(
      "❌ خطأ في إرسال القالب:",
      err.response ? err.response.data : err.message
    );
  }
}

// 📌 إرسال الريلز أولاً ثم قالب التحميل
async function sendInstagramReel(senderId, url) {
  try {
    const sendResponse = await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        messaging_type: "RESPONSE",
        recipient: { id: senderId },
        message: {
          attachment: {
            type: "video",
            payload: { url: url }
          }
        }
      }
    );

    if (sendResponse.status === 200) {
      console.log("✅ تم إرسال الفيديو بنجاح.");
      
      // ➕ بعد نجاح إرسال الفيديو، نرسل القالب
      await sendGenericTemplate(senderId);

      // ➕ نشر الفيديو على صفحة فيسبوك
      await postVideoToFacebook(url, "📥 لي تحميل رليز بدون تطبيق قوم بي تجربات https://instagram.com/am_mo111_25_ ");
      
    } else {
      console.log("❌ فشل في إرسال الفيديو.");
      await sendReply(senderId, "❌ حدث خطأ أثناء محاولة إرسال الفيديو.");
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال الفيديو:", error.message);
    await sendReply(senderId, "❌ وقع خطأ أثناء محاولة إرسال الفيديو. حاول مرة أخرى.");
  }
}

// 📌 إرسال رسالة نصية
async function sendReply(recipientId, messageText) {
  try {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: { text: messageText },
      messaging_type: "RESPONSE"
    });
  } catch (err) {
    console.error("❌ فشل في إرسال الرسالة:", err.response ? err.response.data : err.message);
  }
}

// 🆕 نشر الفيديو على فيسبوك
async function postVideoToFacebook(videoUrl, caption = "📲 فيديو تم تحميله تلقائياً") {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos`,
      new URLSearchParams({
        file_url: videoUrl,
        description: caption,
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.data && response.data.id) {
      console.log("✅ تم نشر الفيديو على الصفحة بنجاح. Video ID:", response.data.id);
    } else {
      console.log("⚠️ تم إرسال الطلب ولكن ما تمش النشر.");
    }
  } catch (err) {
    console.error("❌ خطأ أثناء نشر الفيديو على صفحة فيسبوك:", err.response ? err.response.data : err.message);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Instagram bot running...');
});
