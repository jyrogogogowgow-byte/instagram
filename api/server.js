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

async function getMediaDirectUrl(url) {

try {

const response = await axios.post('https://api.cobalt.tools/api/json', {

  url: url,

  isAudioOnly: false 

}, {

  headers: {

    'Accept': 'application/json',

    'Content-Type': 'application/json',

    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  }

});



if (response.data && response.data.url) {

  return response.data.url; 

}

return null;

} catch (error) {

console.error("❌ خطأ في Cobalt API:", error.response ? error.response.data : error.message);

return null;

}

}

app.get('/webhook', (req, res) => {

const mode = req.query['hub.mode'];

const token = req.query['hub.verify_token'];

const challenge = req.query['hub.challenge'];

if (mode === 'subscribe' && token === VERIFY_TOKEN) {

console.log('✅ Webhook verified on Vercel');

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

                await sendReply(senderId, "❌ عذراً، لم أتمكن من جلب هذا المقطع (قد يكون الحساب خاصاً).");

              }

            } catch (err) {

              await sendReply(senderId, "❌ وقع خطأ غير متوقع أثناء تحميل الريلز.");

            }



            break;

          }

        }



        if (!reelFound) {

          await sendReply(senderId, "🚨 المرفق غير مدعوم. يُرجى إرسال مقطع ريلز فقط.");

        }

      } else if (!event.message || !event.message.text) {

         if(event.message) await sendReply(senderId, "📩 يُرجى إرسال مقطع ريلز ليتم تحميله.");

      }

    }

  }

}

}

});

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

              subtitle: "تواصل مع مطور البوت فحال توقف 🛑",

              default_action: {

                type: "web_url",

                url: "https://wa.me/message/VTOVK35COW4RG1"

              },

              buttons: [

                {

                  type: "web_url",

                  url: "https://wa.me/message/VTOVK35COW4RG1",

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

} catch (err) {

console.error("❌ خطأ في إرسال القالب:", err.response ? err.response.data : err.message);

}

}

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

  await sendGenericTemplate(senderId);

  

  if (FACEBOOK_PAGE_ID && FACEBOOK_PAGE_ACCESS_TOKEN) {

    await postVideoToFacebook(url, "📥 لي تحميل رليز بدون تطبيق قوم بي تجربات https://instagram.com/am_mo111_25_ ");

  }

} else {

  await sendReply(senderId, "❌ حدث خطأ أثناء محاولة إرسال الفيديو.");

}

} catch (error) {

console.error("❌ خطأ في إرسال الفيديو:", error.response ? JSON.stringify(error.response.data) : error.message);

await sendReply(senderId, "❌ وقع خطأ أثناء محاولة إرسال الفيديو. قد يكون حجم الملف كبيراً.");

}

}

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

async function postVideoToFacebook(videoUrl, caption) {

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

} catch (err) {

console.error("❌ خطأ أثناء نشر الفيديو على فيسبوك:", err.response ? err.response.data : err.message);

}

}

module.exports = app;
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
async function postVideoToFacebook(videoUrl, caption) {
  try {
    const response = await axios.post(
      https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos,
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
    }
  } catch (err) {
    console.error("❌ خطأ أثناء نشر الفيديو على فيسبوك:", err.response ? err.response.data : err.message);
  }
}

// ⚠️ هام لـ Vercel: التصدير بدلاً من app.listen
module.exports = app;
