```js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(bodyParser.json());


// =====================================================
// 🔐 CONFIG
// =====================================================

const PAGE_ACCESS_TOKEN =
  process.env.PAGE_ACCESS_TOKEN || "IGAAYDbM8KbPFBZAFlZANGFJekpfYVNHNlhRVFNMMG1IRlQ2VFN2RW1PbS1vZAVh5UUE3NHZAVeGFvc0lVRWxkaV9xT2JNQjFab3gxSWNkd0FNSXo0dzQwMnRfb1psd3RqT3N3U3lsT2dTT2hEYWYzU1VRZAmMwNlRFQWkxUmhqUXBzawZDZD";

const VERIFY_TOKEN =
  process.env.VERIFY_TOKEN || "ABCD1234";

const FACEBOOK_PAGE_ID =
  process.env.FACEBOOK_PAGE_ID || "";

const FACEBOOK_PAGE_ACCESS_TOKEN =
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";


// =====================================================
// 🛡️ منع معالجة نفس الريلز أكثر من مرة
// =====================================================

const processingReels = new Set();


// =====================================================
// 🎥 استخراج رابط الفيديو من API
// =====================================================

async function getMediaDirectUrl(reelUrl) {
  try {
    const apiUrl = `https://api-yout-gray.vercel.app/api/download?url=${encodeURIComponent(reelUrl)}`;

    console.log("🌐 API:", apiUrl);

    const response = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    console.log("📡 API Status:", response.status);
    console.log("📦 API Response:", response.data);

    if (
      response.data &&
      response.data.success === true &&
      response.data.url
    ) {
      console.log("✅ تم استخراج رابط الفيديو");
      console.log("🎥 Direct URL:", response.data.url);

      return response.data.url;
    }

    console.log("❌ API لم يرجع رابط فيديو");
    return null;

  } catch (error) {
    console.error("❌ خطأ في API:", error.message);

    if (error.response) {
      console.error("📛 API Error:", error.response.data);
    }

    return null;
  }
}
```


// =====================================================
// 🔐 Webhook Verification
// =====================================================

app.get("/webhook", (req, res) => {

  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];


  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {

    console.log("✅ Webhook Verified");

    return res
      .status(200)
      .send(challenge);
  }


  console.log("❌ Webhook Verification Failed");

  return res.sendStatus(403);
});


// =====================================================
// 📩 Instagram Webhook
// =====================================================

app.post("/webhook", async (req, res) => {

  // الرد بسرعة على Instagram
  res.status(200).send("EVENT_RECEIVED");


  try {

    if (
      req.body.object !== "instagram"
    ) {
      return;
    }


    for (
      const entry
      of req.body.entry || []
    ) {

      if (!entry.messaging) {
        continue;
      }


      for (
        const event
        of entry.messaging
      ) {

        const senderId =
          event.sender &&
          event.sender.id;


        if (!senderId) {
          continue;
        }


        // =================================================
        // 💬 الرسائل النصية
        // =================================================

        if (
          event.message &&
          event.message.text
        ) {

          await sendReply(
            senderId,
            "👋 أرسل لي Reel من Instagram وسأحاول استخراج الفيديو."
          );

          continue;
        }


        // =================================================
        // 📎 المرفقات
        // =================================================

        if (
          !event.message ||
          !event.message.attachments
        ) {
          continue;
        }


        let reelFound = false;


        for (
          const attachment
          of event.message.attachments
        ) {

          if (
            attachment.type === "ig_reel" &&
            attachment.payload &&
            attachment.payload.url
          ) {

            reelFound = true;


            const reelUrl =
              attachment.payload.url;


            // =================================================
            // 🛡️ منع التكرار
            // =================================================

            const reelKey = reelUrl;


            if (
              processingReels.has(reelKey)
            ) {

              console.log(
                "⚠️ هذا الريلز قيد المعالجة بالفعل"
              );

              continue;
            }


            processingReels.add(
              reelKey
            );


            try {

              console.log("=================================");
              console.log("📩 Reel Received");
              console.log("👤 Sender:", senderId);
              console.log("🔗 URL:", reelUrl);
              console.log("=================================");


              // رسالة الانتظار
              await sendReply(
                senderId,
                "⏳ يتم معالجة واستخراج الريلز..."
              );


              // =================================================
              // 🎥 استخراج الفيديو
              // =================================================

              const directUrl =
                await getMediaDirectUrl(
                  reelUrl
                );


              if (!directUrl) {

                await sendReply(
                  senderId,
                  "❌ عذراً، لم أتمكن من استخراج الفيديو."
                );

                continue;
              }


              // =================================================
              // 📤 إرسال الفيديو
              // =================================================

              await sendInstagramReel(
                senderId,
                directUrl
              );


            } catch (error) {

              console.error(
                "❌ خطأ أثناء معالجة الريلز:",
                error.message
              );


              await sendReply(
                senderId,
                "❌ وقع خطأ أثناء معالجة الفيديو."
              );


            } finally {

              // إزالة الريلز من القائمة
              // بعد انتهاء المعالجة

              processingReels.delete(
                reelKey
              );
            }


            break;
          }
        }


        // =================================================
        // 🚨 مرفق غير مدعوم
        // =================================================

        if (!reelFound) {

          await sendReply(
            senderId,
            "🚨 المرفق غير مدعوم."
          );
        }
      }
    }


  } catch (error) {

    console.error(
      "❌ Webhook Error:",
      error.message
    );
  }
});


// =====================================================
// 📤 إرسال الفيديو إلى Instagram
// =====================================================

async function sendInstagramReel(
  senderId,
  videoUrl
) {

  try {

    console.log("=================================");
    console.log("📤 محاولة إرسال الفيديو");

    console.log("👤 Sender:");
    console.log(senderId);

    console.log("🎥 URL:");
    console.log(videoUrl);

    console.log("=================================");


    if (!videoUrl) {

      console.log(
        "❌ رابط الفيديو فارغ"
      );

      await sendReply(
        senderId,
        "❌ رابط الفيديو فارغ."
      );

      return;
    }


    // =================================================
    // إرسال الفيديو مباشرة بالرابط
    // =================================================

    const response =
      await axios.post(

        `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,

        {

          messaging_type:
            "RESPONSE",

          recipient: {
            id: senderId
          },

          message: {

            attachment: {

              type: "video",

              payload: {

                url: videoUrl

              }

            }

          }

        },

        {

          timeout: 90000,

          headers: {

            "Content-Type":
              "application/json"
          }

        }
      );


    console.log("=================================");
    console.log("📡 Instagram Response Status:");
    console.log(response.status);

    console.log("📦 Instagram Response:");
    console.log(response.data);

    console.log("=================================");


    if (
      response.status === 200
    ) {

      console.log(
        "✅ تم إرسال الفيديو بنجاح"
      );


      // =================================================
      // 📘 نشر على Facebook إذا كان مفعلاً
      // =================================================

      if (
        FACEBOOK_PAGE_ID &&
        FACEBOOK_PAGE_ACCESS_TOKEN
      ) {

        await postVideoToFacebook(

          videoUrl,

          "📥 لتحميل الريلز بدون تطبيق قم بتجربة: https://instagram.com/am_mo111_25_"

        );
      }


    } else {

      console.log(
        "⚠️ Instagram رجع Status غير 200"
      );
    }


  } catch (error) {

    console.error("=================================");
    console.error("❌ ERROR SEND VIDEO");

    console.error(
      "Status:",
      error.response?.status
    );

    console.error(
      "Data:",
      JSON.stringify(
        error.response?.data,
        null,
        2
      )
    );

    console.error(
      "Message:",
      error.message
    );

    console.error("=================================");


    let errorMessage =
      "❌ تعذر إرسال الفيديو.";


    if (
      error.response?.data?.error?.message
    ) {

      errorMessage +=
        "\n\n📌 السبب:\n" +
        error.response.data.error.message;
    }


    await sendReply(
      senderId,
      errorMessage
    );
  }
}


// =====================================================
// 💬 إرسال رسالة نصية
// =====================================================

async function sendReply(
  recipientId,
  messageText
) {

  try {

    const response =
      await axios.post(

        `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,

        {

          recipient: {

            id: recipientId
          },

          message: {

            text: messageText
          },

          messaging_type:
            "RESPONSE"
        },

        {

          timeout: 30000,

          headers: {

            "Content-Type":
              "application/json"
          }
        }
      );


    console.log(
      "✅ Message sent:",
      response.status
    );


  } catch (error) {

    console.error(
      "❌ Send Message Error:",
      error.response?.data ||
      error.message
    );
  }
}


// =====================================================
// 📘 نشر الفيديو على Facebook
// =====================================================

async function postVideoToFacebook(
  videoUrl,
  caption
) {

  try {

    console.log(
      "📘 جاري نشر الفيديو على Facebook..."
    );


    const response =
      await axios.post(

        `https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos`,

        new URLSearchParams({

          file_url:
            videoUrl,

          description:
            caption,

          access_token:
            FACEBOOK_PAGE_ACCESS_TOKEN

        }),

        {

          headers: {

            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          timeout: 90000
        }
      );


    console.log(
      "✅ تم نشر الفيديو على Facebook"
    );

    console.log(
      response.data
    );


  } catch (error) {

    console.error(
      "❌ Facebook Error:",

      error.response?.data ||
      error.message
    );
  }
}


// =====================================================
// 🚀 EXPORT
// =====================================================

module.exports = app;
```
