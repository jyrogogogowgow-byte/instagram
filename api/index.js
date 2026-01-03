const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// ✅ إصلاح مشكلة SSL للمطورين (للتجربة فقط)
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const PAGE_ACCESS_TOKEN = "IGAAKBNjRZBjsNBZAFppXzVwQzRLcHhlUnhLa0JvaXpaWWxHaGNHNEIzeHJhak1uZAnV0aEQ3UkVQMXVvZAndDVFZAjeDU0dWtoZAjQ5aER5b1djZAG9SZAktXLU9LNnhBRlhpUXZATOFBBMzRTREN6bW5YUWFicUpnR3dGd1JOekxVOWduQQZDZD";
const VERIFY_TOKEN = "ABCD1234";

// 🔵 إعدادات فيسبوك
const FACEBOOK_PAGE_ID = "225597157303578";
const FACEBOOK_PAGE_ACCESS_TOKEN = "EAAHa6OnUvf8BPTNccoszJ4xxXlwZAY3qGaN8yLWRHCrL7hmctM6mM6NWbu5LIFtQPcQU9jCNsi1prFp9DIlwSVbNSzZAxLeafXjVDZAUvZCea0Tu8Nzx897JyJT4mCm4wDJTIvcqICplk7ZBeUAQzsgLZBAbxce4ZCXK5dJpfrCy7mtNVZA5NfJw8B7ZAEiO7DYEWvjuFL7AZD";

// ✅ إعداد axios مع SSL صحيح
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ 
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    keepAlive: true,
    timeout: 30000
  }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
  }
});

// ✅ نقطة نهاية للصحة
app.get('/health', (req, res) => {
  res.json({ 
    status: 'active', 
    timestamp: new Date().toISOString(),
    services: {
      instagram: 'ready',
      facebook: 'ready'
    }
  });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }

  console.log('❌ Webhook verification failed');
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  console.log("📦 Received payload");

  // ✅ الرد فوراً لتجنب timeout
  res.sendStatus(200);

  if (req.body.object === 'instagram') {
    for (const entry of req.body.entry) {
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const senderId = event.sender && event.sender.id;

          if (!senderId) continue;

          try {
            if (event.message && event.message.text) {
              await sendGenericTemplate(senderId);
              continue;
            }

            if (event.message && event.message.attachments) {
              let reelFound = false;

              for (const attachment of event.message.attachments) {
                if (attachment.type === 'ig_reel' && attachment.payload && attachment.payload.url) {
                  reelFound = true;

                  await sendReply(senderId, "⏳ جاري تحميل الريلز...");

                  try {
                    const reelUrl = attachment.payload.url;
                    await sendInstagramReel(senderId, reelUrl);
                  } catch (err) {
                    console.error('Error processing reel:', err);
                    await sendReply(senderId, "❌ حدث خطأ أثناء تحميل الريلز.");
                  }

                  break;
                }
              }

              if (!reelFound) {
                await sendReply(senderId, "🚨 المرفق غير مدعوم. يُرجى إرسال مقطع ريلز فقط.");
              }
            } else {
              await sendReply(senderId, "📩 يُرجى إرسال مقطع ريلز ليتم تحميله.");
            }
          } catch (error) {
            console.error(`Error processing message from ${senderId}:`, error.message);
          }
        }
      }
    }
  }
});

// 📌 قالب تحميل التطبيق
async function sendGenericTemplate(recipientId) {
  try {
    await axiosInstance.post(
      `https://graph.instagram.com/v19.0/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [
                {
                  title: "تحميل التطبيق 📲",
                  image_url: "https://i.ibb.co/VWwMFkHn/photo-5929237708758780812-y.jpg",
                  subtitle: "تطبيق لمشاهدة المباريات والقنوات فقط بنجمة ⭐6",
                  default_action: {
                    type: "web_url",
                    url: "https://whatsapp.com/channel/0029VbAgby79sBICj1Eg7h0h/102"
                  },
                  buttons: [
                    {
                      type: "web_url",
                      url: "https://whatsapp.com/channel/0029VbAgby79sBICj1Eg7h0h/102",
                      title: "📥 تحميل التطبيق الآن"
                    }
                  ]
                }
              ]
            }
          }
        },
        messaging_type: "RESPONSE"
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
        timeout: 15000
      }
    );

    console.log("✅ تم إرسال قالب تحميل التطبيق بنجاح.");
  } catch (err) {
    console.error("❌ خطأ في إرسال القالب:", err.response?.data || err.message);
    
    // ✅ محاولة بديلة
    if (err.code === 'EPROTO' || err.code === 'ECONNRESET') {
      console.log("🔄 تجربة طريقة بديلة...");
      await sendGenericTemplateFallback(recipientId);
    }
  }
}

// ✅ طريقة بديلة لإرسال القالب
async function sendGenericTemplateFallback(recipientId) {
  try {
    // استخدام fetch إذا فشل axios
    const fetch = require('node-fetch');
    
    await fetch(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          text: "📲 لتحميل التطبيق:\nhttps://whatsapp.com/channel/0029VbAgby79sBICj1Eg7h0h/102\n\nتطبيق لمشاهدة المباريات والقنوات فقط بنجمة ⭐6"
        },
        messaging_type: "RESPONSE"
      })
    });
    
    console.log("✅ تم إرسال الرابط البديل.");
  } catch (error) {
    console.error("❌ فشلت الطريقة البديلة أيضًا:", error.message);
  }
}

// 📌 إرسال الريلز
async function sendInstagramReel(senderId, url) {
  try {
    console.log(`📤 محاولة إرسال ريلز لـ ${senderId}`);
    
    // ✅ إرسال الفيديو
    const sendResponse = await axiosInstance.post(
      `https://graph.instagram.com/v19.0/me/messages`,
      {
        messaging_type: "RESPONSE",
        recipient: { id: senderId },
        message: {
          attachment: {
            type: "video",
            payload: { 
              url: url,
              is_reusable: true 
            }
          }
        }
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
        timeout: 40000
      }
    );

    if (sendResponse.status === 200) {
      console.log("✅ تم إرسال الفيديو بنجاح.");
      
      // ✅ إرسال تأكيد
      await new Promise(resolve => setTimeout(resolve, 1000));
      await sendReply(senderId, "✅ تم تحميل الفيديو بنجاح!");
      
      // ✅ إرسال قالب التطبيق
      await new Promise(resolve => setTimeout(resolve, 500));
      await sendGenericTemplate(senderId);
      
      // ✅ نشر الفيديو على فيسبوك
      await postVideoToFacebook(url, "📥 ريلز محمل من البوت - جرب البوت بنفسك! @am_mo111_25_");
      
    } else {
      console.log("❌ فشل في إرسال الفيديو.");
      await sendReply(senderId, "❌ حدث خطأ أثناء إرسال الفيديو.");
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال الفيديو:", {
      message: error.message,
      code: error.code
    });
    
    let errorMessage = "❌ تعذر تحميل الفيديو. حاول مرة أخرى.";
    
    if (error.code === 'EPROTO' || error.code === 'ECONNRESET') {
      errorMessage = "🔧 هناك مشكلة تقنية مؤقتة. جاري الإصلاح...";
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = "⏱️ تجاوز الفيديو الوقت المسموح. حاول بريلز أقصر.";
    }
    
    await sendReply(senderId, errorMessage);
  }
}

// 📌 إرسال رسالة نصية
async function sendReply(recipientId, messageText) {
  try {
    await axiosInstance.post(
      `https://graph.instagram.com/v19.0/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: messageText },
        messaging_type: "RESPONSE"
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
        timeout: 10000
      }
    );
    console.log(`✅ تم إرسال رسالة لـ ${recipientId}`);
  } catch (err) {
    console.error("❌ فشل في إرسال الرسالة:", {
      message: err.message,
      code: err.code
    });
  }
}

// ✅ نشر الفيديو على فيسبوك (محسّن)
async function postVideoToFacebook(videoUrl, caption = "📲 فيديو تم تحميله تلقائياً") {
  try {
    // ✅ انتظار عشوائي لتجنب rate limits
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await axiosInstance.post(
      `https://graph.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/videos`,
      {},
      {
        params: {
          file_url: videoUrl,
          description: `${caption}\n\n📥 تم التحميل بواسطة بوت Instagram\n⏰ ${new Date().toLocaleString('ar-SA')}`,
          access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
          published: true
        },
        timeout: 60000
      }
    );

    if (response.data?.id) {
      console.log("✅ تم نشر الفيديو على الصفحة بنجاح. Video ID:", response.data.id);
      return response.data.id;
    } else {
      console.log("⚠️ تم إرسال الطلب ولكن لم يتم النشر.");
    }
  } catch (err) {
    console.error("❌ خطأ أثناء نشر الفيديو على صفحة فيسبوك:", {
      message: err.message,
      status: err.response?.status
    });
    
    // ✅ محاولة بديلة
    if (err.response?.status === 400 || err.code === 'EPROTO') {
      console.log("🔄 تجربة طريقة بديلة للنشر...");
      await postVideoToFacebookAlternative(videoUrl, caption);
    }
  }
}

// ✅ طريقة بديلة للنشر على فيسبوك
async function postVideoToFacebookAlternative(videoUrl, caption) {
  try {
    const response = await axiosInstance.post(
      `https://graph-video.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/videos`,
      new URLSearchParams({
        file_url: videoUrl,
        description: caption,
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 60000
      }
    );

    console.log("✅ تم النشر بالطريقة البديلة:", response.data?.id || 'N/A');
  } catch (error) {
    console.error("❌ فشلت الطريقة البديلة أيضًا:", error.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Instagram bot running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook URL: https://your-domain.com/webhook`);
});
