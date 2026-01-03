const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = "IGAAKBNjRZBjsNBZAFJhTXdTN1VnVk5jSXZAwN0xFRlRHVFFqYjFlRjk2c3RxaHNsdjhDa25sUGowS0JKSTVWUjRpNHY1SWtjQmplVno2UmRFSFo1WnlvU1RZAWWpJSzVMbDBDSDFSYTN0ZAUNUNy1NYWF3aWp0QldfT2hONjRKRGpnVQZDZD";
const VERIFY_TOKEN = "my_custom_verify";

// 🔵 إعدادات فيسبوك
const FACEBOOK_PAGE_ID = "225597157303578";
const FACEBOOK_PAGE_ACCESS_TOKEN = "EAAHa6OnUvf8BPTNccoszJ4xxXlwZAY3qGaN8yLWRHCrL7hmctM6mM6NWbu5LIFtQPcQU9jCNsi1prFp9DIlwSVbNSzZAxLeafXjVDZAUvZCea0Tu8Nzx897JyJT4mCm4wDJTIvcqICplk7ZBeUAQzsgLZBAbxce4ZCXK5dJpfrCy7mtNVZA5NfJw8B7ZAEiO7DYEWvjuFL7AZD";

// 🔧 متغيرات التحكم
const ENABLE_FACEBOOK_SHARE = true; // تفعيل/تعطيل النشر على فيسبوك
const MAX_VIDEO_SIZE_MB = 100; // الحد الأقصى لحجم الفيديو

// 🛡️ Middleware للتحقق من الصحة
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
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

// 🆕 نقطة نهاية للصحة
app.get('/health', (req, res) => {
  res.json({ 
    status: 'active', 
    timestamp: new Date().toISOString(),
    services: {
      instagram: 'ready',
      facebook: ENABLE_FACEBOOK_SHARE ? 'enabled' : 'disabled'
    }
  });
});

// 🆕 معالجة الأخطاء المركزية
app.use((error, req, res, next) => {
  console.error('🔥 Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.post('/webhook', async (req, res) => {
  try {
    console.log("📦 Received payload");

    if (req.body.object === 'instagram') {
      const promises = [];
      
      req.body.entry.forEach(entry => {
        if (entry.messaging) {
          entry.messaging.forEach(async (event) => {
            const senderId = event.sender?.id;
            const messageId = event.message?.mid;

            if (!senderId) return;

            // 🔄 معالجة النصوص
            if (event.message?.text) {
              const userMessage = event.message.text.toLowerCase();
              
              // 🆕 أوامر نصية
              if (userMessage.includes('مساعدة') || userMessage.includes('help')) {
                promises.push(sendHelpMessage(senderId));
              } else if (userMessage.includes('حول') || userMessage.includes('about')) {
                promises.push(sendAboutMessage(senderId));
              } else {
                promises.push(sendGenericTemplate(senderId));
              }
              return;
            }

            // 🔄 معالجة المرفقات
            if (event.message?.attachments) {
              let reelFound = false;

              for (const attachment of event.message.attachments) {
                if (attachment.type === 'ig_reel' && attachment.payload?.url) {
                  reelFound = true;
                  
                  try {
                    await sendReply(senderId, "⏳ جاري تحميل الريلز...");
                    
                    const reelUrl = attachment.payload.url;
                    
                    // 🆕 التحقق من حجم الفيديو قبل الإرسال
                    const isValidVideo = await validateVideoUrl(reelUrl);
                    if (!isValidVideo) {
                      await sendReply(senderId, "⚠️ لا يمكن تحميل هذا الفيديو، قد يكون حجمه كبيراً جداً أو غير متاح.");
                      return;
                    }
                    
                    // إرسال الفيديو
                    await sendInstagramReel(senderId, reelUrl);
                    
                  } catch (err) {
                    console.error('Error processing reel:', err);
                    await sendReply(senderId, "❌ حدث خطأ أثناء معالجة الريلز. حاول مرة أخرى.");
                  }
                  
                  return;
                }
              }

              if (!reelFound) {
                promises.push(sendReply(senderId, "🚨 المرفق غير مدعوم. يُرجى إرسال مقطع ريلز فقط."));
              }
            } else {
              promises.push(sendReply(senderId, "📩 يُرجى إرسال مقطع ريلز ليتم تحميله."));
            }
          });
        }
      });

      // انتظار اكتمال جميع العمليات
      await Promise.all(promises);
      return res.sendStatus(200);
    }

    res.sendStatus(404);
  } catch (error) {
    console.error('Error in webhook:', error);
    res.sendStatus(500);
  }
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
                    },
                    {
                      type: "postback",
                      title: "🔄 إرسال ريلز آخر",
                      payload: "SEND_ANOTHER_REEL"
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
    console.error("❌ خطأ في إرسال القالب:", err.response?.data || err.message);
  }
}

// 📌 إرسال الريلز
async function sendInstagramReel(senderId, url) {
  try {
    // إرسال الفيديو
    const sendResponse = await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
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
      { timeout: 30000 } // 30 ثانية timeout
    );

    if (sendResponse.status === 200) {
      console.log("✅ تم إرسال الفيديو بنجاح.");
      
      // إرسال رسالة تأكيد
      await sendReply(senderId, "✅ تم تحميل الفيديو بنجاح!");
      
      // إرسال قالب التطبيق
      await sendGenericTemplate(senderId);
      
      // 🆕 النشر على فيسبوك (اختياري)
      if (ENABLE_FACEBOOK_SHARE) {
        try {
          await postVideoToFacebook(url, "📥 ريلز محمل من البوت - جرب البوت بنفسك! @am_mo111_25_");
          console.log("✅ تم نشر الفيديو على صفحة الفيسبوك.");
        } catch (fbError) {
          console.warn("⚠️ لم يتمكن من النشر على الفيسبوك:", fbError.message);
          // لا نرسل رسالة خطأ للمستخدم حتى لا تشوش عليه
        }
      }
      
    } else {
      console.log("❌ فشل في إرسال الفيديو.");
      await sendReply(senderId, "❌ حدث خطأ أثناء إرسال الفيديو.");
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال الفيديو:", error.message);
    
    if (error.code === 'ECONNABORTED') {
      await sendReply(senderId, "⏱️ تجاوز الفيديو الوقت المسموح. حاول بريلز أقصر.");
    } else {
      await sendReply(senderId, "❌ تعذر تحميل الفيديو. تأكد من الرابط وحاول مرة أخرى.");
    }
  }
}

// 📌 إرسال رسالة نصية
async function sendReply(recipientId, messageText) {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: messageText },
        messaging_type: "RESPONSE"
      },
      { timeout: 10000 }
    );
  } catch (err) {
    console.error("❌ فشل في إرسال الرسالة:", err.response?.data || err.message);
  }
}

// 🆕 نشر الفيديو على فيسبوك (محسّن)
async function postVideoToFacebook(videoUrl, caption = "📲 فيديو تم تحميله تلقائياً") {
  if (!ENABLE_FACEBOOK_SHARE) {
    console.log("⚠️ النشر على الفيسبوك معطل من الإعدادات");
    return;
  }

  try {
    // 🆕 إضافة تأخير عشوائي لتجنب rate limits
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/videos`,
      {
        file_url: videoUrl,
        description: `${caption}\n\n📥 تم التحميل بواسطة بوت Instagram\n⏰ ${new Date().toLocaleString('ar-SA')}\n#ريلز #تحميل_ريلز`,
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
        published: true
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 45000 // 45 ثانية للنشر
      }
    );

    if (response.data?.id) {
      console.log("✅ تم نشر الفيديو على الصفحة بنجاح. Video ID:", response.data.id);
      return response.data.id;
    } else {
      console.log("⚠️ تم إرسال الطلب ولكن لم يتم النشر.");
    }
  } catch (err) {
    console.error("❌ خطأ أثناء نشر الفيديو على صفحة فيسبوك:");
    console.error("تفاصيل الخطأ:", err.response?.data || err.message);
    
    // 🆕 محاولة بديلة إذا فشلت الطريقة الأولى
    if (err.response?.data?.error?.code === 352) {
      console.log("🔄 تجربة طريقة بديلة للنشر...");
      await postVideoToFacebookAlternative(videoUrl, caption);
    }
  }
}

// 🆕 طريقة بديلة للنشر على فيسبوك
async function postVideoToFacebookAlternative(videoUrl, caption) {
  try {
    const formData = new URLSearchParams();
    formData.append('file_url', videoUrl);
    formData.append('description', caption);
    formData.append('access_token', FACEBOOK_PAGE_ACCESS_TOKEN);

    const response = await axios.post(
      `https://graph-video.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/videos`,
      formData.toString(),
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

// 🆕 التحقق من صحة رابط الفيديو
async function validateVideoUrl(videoUrl) {
  try {
    const response = await axios.head(videoUrl, { timeout: 10000 });
    
    const contentLength = response.headers['content-length'];
    const contentType = response.headers['content-type'];
    
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      if (sizeMB > MAX_VIDEO_SIZE_MB) {
        console.log(`⚠️ حجم الفيديو كبير جداً: ${sizeMB.toFixed(2)}MB`);
        return false;
      }
    }
    
    if (contentType && !contentType.includes('video/')) {
      console.log(`⚠️ نوع الملف غير صحيح: ${contentType}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn("⚠️ تعذر التحقق من رابط الفيديو:", error.message);
    return true; // نعود true في حالة عدم التمكن من التحقق
  }
}

// 🆕 رسائل المساعدة
async function sendHelpMessage(recipientId) {
  await sendReply(recipientId, `📖 *مساعدة البوت*\n
• أرسل ريلز ليتم تحميله\n• ثم سنرسل لك الفيديو + رابط التطبيق\n• للحصول على التطبيق، أرسل "تطبيق"\n• للاستفسارات: @am_mo111_25_`);
}

// 🆕 رسالة حول البوت
async function sendAboutMessage(recipientId) {
  await sendReply(recipientId, `🤖 *حول البوت*\n
هذا البوت يقوم بتحميل ريلز Instagram تلقائياً وإرساله لك.\nالمطور: @am_mo111_25_\nالإصدار: 2.0\n\n📢 ملاحظة: البوت لا يخزن أي مقاطع على سيرفراته.`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Instagram bot running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Facebook sharing: ${ENABLE_FACEBOOK_SHARE ? 'ENABLED' : 'DISABLED'}`);
});
