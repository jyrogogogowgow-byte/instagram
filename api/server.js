const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================
// CONFIG
// ================================

const PAGE_ACCESS_TOKEN =
  process.env.PAGE_ACCESS_TOKEN || "IGAAYDbM8KbPFBZAFlZANGFJekpfYVNHNlhRVFNMMG1IRlQ2VFN2RW1PbS1vZAVh5UUE3NHZAVeGFvc0lVRWxkaV9xT2JNQjFab3gxSWNkd0FNSXo0dzQwMnRfb1psd3RqT3N3U3lsT2dTT2hEYWYzU1VRZAmMwNlRFQWkxUmhqUXBzawZDZD";

const VERIFY_TOKEN =
  process.env.VERIFY_TOKEN || "ABCD1234";

// إذا كنت تستعمل نشر الفيديو في Facebook
const FACEBOOK_PAGE_ID =
  process.env.FACEBOOK_PAGE_ID || "";

const FACEBOOK_PAGE_ACCESS_TOKEN =
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";

// Instagram Graph API
const GRAPH_URL = "https://graph.instagram.com/v19.0";

// Downloader API
const DOWNLOADER_API =
  "https://api-yout-gray.vercel.app/api/download?url=";


// ================================
// AXIOS CONFIG
// ================================

const axiosConfig = {
  timeout: 60000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
  }
};


// ================================
// GET VIDEO DIRECT URL
// ================================

async function getMediaDirectUrl(reelUrl) {
  try {
    console.log("=================================");
    console.log("🔎 بدء استخراج الفيديو");
    console.log("🔗 Reel URL:");
    console.log(reelUrl);

    const apiUrl =
      `${DOWNLOADER_API}${encodeURIComponent(reelUrl)}`;

    console.log("🌐 API:");
    console.log(apiUrl);

    const response = await axios.get(
      apiUrl,
      axiosConfig
    );

    console.log("📡 API Status:", response.status);

    console.log("📦 API Response:");
    console.log(response.data);

    const data = response.data;

    if (
      data &&
      data.success === true &&
      typeof data.url === "string" &&
      data.url.startsWith("http")
    ) {
      console.log("✅ تم استخراج رابط الفيديو");

      console.log("🎥 Direct URL:");
      console.log(data.url);

      console.log("=================================");

      return data.url;
    }

    console.log("❌ API لم يرجع رابط فيديو صالح");

    return null;

  } catch (error) {

    console.error("❌ خطأ في Downloader API:");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response:", error.response.data);
    } else {
      console.error(error.message);
    }

    return null;
  }
}


// ================================
// SEND INSTAGRAM MESSAGE
// ================================

async function sendInstagramMessage(
  recipientId,
  message,
  attempt = 1
) {
  try {

    const url =
      `${GRAPH_URL}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

    const response = await axios.post(
      url,
      {
        recipient: {
          id: recipientId
        },

        message: message,

        messaging_type: "RESPONSE"
      },
      {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0"
        }
      }
    );

    console.log(
      "✅ Instagram Message Sent:",
      response.status
    );

    return true;

  } catch (error) {

    console.error(
      `❌ Send Message Error (attempt ${attempt}):`,
      error.message
    );

    if (error.response) {
      console.error(
        "📛 Instagram API:",
        error.response.data
      );
    }

    // Retry
    if (attempt < 3) {

      console.log(
        `🔄 إعادة المحاولة ${attempt + 1}/3...`
      );

      await new Promise(resolve =>
        setTimeout(resolve, 2000 * attempt)
      );

      return sendInstagramMessage(
        recipientId,
        message,
        attempt + 1
      );
    }

    return false;
  }
}


// ================================
// SEND TEXT
// ================================

async function sendReply(
  recipientId,
  text
) {
  return sendInstagramMessage(
    recipientId,
    {
      text: text
    }
  );
}


// ================================
// GENERIC TEMPLATE
// ================================

async function sendGenericTemplate(
  recipientId
) {

  try {

    const url =
      `${GRAPH_URL}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

    const body = {

      recipient: {
        id: recipientId
      },

      message: {

        attachment: {

          type: "template",

          payload: {

            template_type: "generic",

            elements: [

              {

                title: "مطور البوت 📲",

                image_url:
                  "https://i.ibb.co/h1x9YLDV/26545.png",

                subtitle:
                  "تواصل مع مطور البوت في حالة توقف 🛑",

                default_action: {

                  type: "web_url",

                  url:
                    "https://www.instagram.com/am_mo1_25_"
                },

                buttons: [

                  {

                    type: "web_url",

                    url:
                      "https://www.instagram.com/am_mo1_25_",

                    title: "تواصل"
                  }

                ]
              }

            ]
          }
        }
      },

      messaging_type: "RESPONSE"
    };


    const response = await axios.post(
      url,
      body,
      {
        timeout: 30000,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

    console.log(
      "✅ Generic Template Sent:",
      response.status
    );

    return true;

  } catch (error) {

    console.error(
      "❌ Generic Template Error:",
      error.response?.data ||
      error.message
    );

    return false;
  }
}


// ================================
// SEND VIDEO
// ================================

async function sendInstagramReel(
  senderId,
  videoUrl
) {

  try {

    console.log("=================================");
    console.log("📤 محاولة إرسال الفيديو");

    console.log("🎥 URL:");
    console.log(videoUrl);

    console.log("=================================");


    // نتأكد أن الرابط صالح
    if (
      !videoUrl ||
      !videoUrl.startsWith("http")
    ) {

      console.log(
        "❌ رابط الفيديو غير صالح"
      );

      await sendReply(
        senderId,
        "❌ رابط الفيديو غير صالح."
      );

      return false;
    }


    const url =
      `${GRAPH_URL}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;


    const body = {

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
      },

      messaging_type: "RESPONSE"
    };


    const response = await axios.post(
      url,
      body,
      {
        timeout: 60000,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );


    console.log(
      "📡 Instagram Video Status:",
      response.status
    );

    console.log(
      "📦 Instagram Response:",
      response.data
    );


    if (response.status === 200) {

      console.log(
        "✅ تم إرسال الفيديو بنجاح"
      );

      // Generic Template
      await sendGenericTemplate(
        senderId
      );


      // Facebook optional
      if (
        FACEBOOK_PAGE_ID &&
        FACEBOOK_PAGE_ACCESS_TOKEN
      ) {

        await postVideoToFacebook(
          videoUrl,
          "📥 لتحميل الريلز بدون تطبيق قم بتجربة: https://instagram.com/am_mo111_25_"
        );
      }

      return true;
    }


    return false;

  } catch (error) {

    console.error(
      "❌ خطأ في إرسال الفيديو:"
    );

    console.error(
      error.response?.data ||
      error.message
    );

    return false;
  }
}


// ================================
// FACEBOOK VIDEO
// ================================

async function postVideoToFacebook(
  videoUrl,
  caption
) {

  try {

    if (
      !FACEBOOK_PAGE_ID ||
      !FACEBOOK_PAGE_ACCESS_TOKEN
    ) {
      return;
    }


    console.log(
      "📤 محاولة نشر الفيديو على Facebook..."
    );


    const data = new URLSearchParams();

    data.append(
      "file_url",
      videoUrl
    );

    data.append(
      "description",
      caption
    );

    data.append(
      "access_token",
      FACEBOOK_PAGE_ACCESS_TOKEN
    );


    const response = await axios.post(

      `https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos`,

      data.toString(),

      {
        timeout: 60000,

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        }
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
      "❌ خطأ نشر Facebook:",
      error.response?.data ||
      error.message
    );
  }
}


// ================================
// WEBHOOK VERIFY
// ================================

app.get(
  "/webhook",
  (req, res) => {

    const mode =
      req.query["hub.mode"];

    const token =
      req.query["hub.verify_token"];

    const challenge =
      req.query["hub.challenge"];


    console.log(
      "🔐 Webhook Verification"
    );


    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN
    ) {

      console.log(
        "✅ Webhook Verified"
      );

      return res
        .status(200)
        .send(challenge);
    }


    console.log(
      "❌ Webhook Verification Failed"
    );

    return res.sendStatus(403);
  }
);


// ================================
// WEBHOOK
// ================================

app.post(
  "/webhook",
  async (req, res) => {

    // الرد بسرعة على Instagram
    res
      .status(200)
      .send("EVENT_RECEIVED");


    try {

      console.log(
        "================================="
      );

      console.log(
        "📩 Webhook Received"
      );


      if (
        !req.body ||
        req.body.object !== "instagram"
      ) {

        console.log(
          "⚠️ Object ليس Instagram"
        );

        return;
      }


      const entries =
        req.body.entry || [];


      for (
        const entry of entries
      ) {

        const messaging =
          entry.messaging || [];


        for (
          const event of messaging
        ) {

          const senderId =
            event.sender &&
            event.sender.id;


          if (!senderId) {

            console.log(
              "⚠️ Sender ID غير موجود"
            );

            continue;
          }


          console.log(
            "📩 Sender:",
            senderId
          );


          // ============================
          // TEXT
          // ============================

          if (
            event.message &&
            event.message.text
          ) {

            console.log(
              "💬 Text Message"
            );

            await sendGenericTemplate(
              senderId
            );

            continue;
          }


          // ============================
          // ATTACHMENTS
          // ============================

          if (
            event.message &&
            Array.isArray(
              event.message.attachments
            )
          ) {

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


                console.log(
                  "================================="
                );

                console.log(
                  "📩 Reel Received"
                );

                console.log(
                  "Sender:",
                  senderId
                );

                console.log(
                  "URL:",
                  reelUrl
                );

                console.log(
                  "================================="
                );


                // رسالة الانتظار
                await sendReply(
                  senderId,
                  "⏳ يتم استخراج الفيديو..."
                );


                // استخراج الفيديو
                const directUrl =
                  await getMediaDirectUrl(
                    reelUrl
                  );


                if (!directUrl) {

                  await sendReply(
                    senderId,
                    "❌ عذراً، لم أتمكن من استخراج الفيديو."
                  );

                  break;
                }


                // إرسال الفيديو
                const sent =
                  await sendInstagramReel(
                    senderId,
                    directUrl
                  );


                if (!sent) {

                  await sendReply(
                    senderId,
                    "❌ تم استخراج الفيديو، لكن تعذر إرساله. حاول مرة أخرى."
                  );
                }


                break;
              }
            }


            if (!reelFound) {

              await sendReply(
                senderId,
                "🚨 المرفق غير مدعوم."
              );
            }
          }
        }
      }

    } catch (error) {

      console.error(
        "❌ Webhook Error:",
        error
      );
    }
  }
);


// ================================
// HEALTH CHECK
// ================================

app.get(
  "/",
  (req, res) => {

    res.json({

      success: true,

      message:
        "Instagram Downloader Bot is running",

      downloader:
        "api-yout-gray.vercel.app"

    });
  }
);


// ================================
// VERCEL
// ================================

module.exports = app;


// ================================
// LOCAL SERVER
// ================================

if (require.main === module) {

  const PORT =
    process.env.PORT || 3000;


  app.listen(
    PORT,
    () => {

      console.log(
        `🚀 Server running on port ${PORT}`
      );

    }
  );
}
```
