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
  process.env.PAGE_ACCESS_TOKEN ||
  "IGAAYDbM8KbPFBZAFlZANGFJekpfYVNHNlhRVFNMMG1IRlQ2VFN2RW1PbS1vZAVh5UUE3NHZAVeGFvc0lVRWxkaV9xT2JNQjFab3gxSWNkd0FNSXo0dzQwMnRfb1psd3RqT3N3U3lsT2dTT2hEYWYzU1VRZAmMwNlRFQWkxUmhqUXBzawZDZD";

const VERIFY_TOKEN =
  process.env.VERIFY_TOKEN || "ABCD1234";

const FACEBOOK_PAGE_ID =
  process.env.FACEBOOK_PAGE_ID || "";

const FACEBOOK_PAGE_ACCESS_TOKEN =
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";


// =====================================================
// 🎥 GET DIRECT VIDEO URL
// =====================================================

async function getMediaDirectUrl(reelUrl) {
  try {

    console.log("=================================");
    console.log("🔎 بدء استخراج الفيديو");
    console.log("🔗 Reel URL:");
    console.log(reelUrl);

    const apiUrl =
      `https://api-yout-gray.vercel.app/api/download?url=${encodeURIComponent(reelUrl)}`;

    console.log("🌐 API:");
    console.log(apiUrl);

    const response = await axios.get(apiUrl, {
      timeout: 60000,

      headers: {
        "Accept": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149 Safari/537.36"
      }
    });

    console.log("📡 API Status:", response.status);

    const data = response.data;

    console.log("📦 API Response:");
    console.log(data);

    if (
      data &&
      data.success === true &&
      data.url
    ) {

      console.log("✅ تم استخراج رابط الفيديو");

      console.log("🎥 Direct URL:");
      console.log(data.url);

      console.log("=================================");

      return data.url;
    }

    console.log("❌ API لم يرجع رابط فيديو");
    console.log("=================================");

    return null;

  } catch (error) {

    console.error("=================================");
    console.error("❌ خطأ API استخراج الفيديو");

    console.error(
      "Status:",
      error.response?.status
    );

    console.error(
      "Data:",
      error.response?.data
    );

    console.error(
      "Message:",
      error.message
    );

    console.error("=================================");

    return null;
  }
}


// =====================================================
// 🔐 WEBHOOK VERIFY
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

  res.sendStatus(403);
});


// =====================================================
// 📩 WEBHOOK
// =====================================================

app.post("/webhook", async (req, res) => {

  // الرد مباشرة على Instagram
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
        // 💬 TEXT MESSAGE
        // =================================================

        if (
          event.message &&
          event.message.text
        ) {

          await sendGenericTemplate(
            senderId
          );

          continue;
        }


        // =================================================
        // 📎 ATTACHMENTS
        // =================================================

        if (
          event.message &&
          event.message.attachments
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


              // رسالة الانتظار
              await sendReply(
                senderId,
                "⏳ يتم معالجة واستخراج الريلز..."
              );


              try {

                const reelUrl =
                  attachment.payload.url;


                console.log("=================================");
                console.log("📩 Reel Received");
                console.log("Sender:", senderId);
                console.log("URL:", reelUrl);
                console.log("=================================");


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

                  continue;
                }


                // إرسال الفيديو
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
              }


              break;
            }
          }


          // =================================================
          // 🚨 UNSUPPORTED
          // =================================================

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
      error.message
    );
  }
});


// =====================================================
// 👤 GENERIC TEMPLATE
// =====================================================

async function sendGenericTemplate(
  recipientId
) {

  try {

    await axios.post(

      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,

      {

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

                  title:
                    "مطور البوت 📲",

                  image_url:
                    "https://i.ibb.co/h1x9YLDV/26545.png",

                  subtitle:
                    "تواصل مع مطور البوت فحال توقف 🛑",

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

                      title:
                        "تواصل"
                    }

                  ]
                }

              ]
            }
          }
        },

        messaging_type:
          "RESPONSE"
      }
    );

  } catch (error) {

    console.error(
      "❌ Generic Template Error:",
      error.response?.data ||
      error.message
    );
  }
}


// =====================================================
// 🎥 SEND VIDEO TO INSTAGRAM
// =====================================================

async function sendInstagramReel(
  senderId,
  url
) {

  try {

    console.log("=================================");
    console.log("📤 محاولة إرسال الفيديو");
    console.log("🎥 URL:");
    console.log(url);
    console.log("=================================");


    if (!url) {

      console.log(
        "❌ URL فارغ"
      );

      await sendReply(
        senderId,
        "❌ رابط الفيديو فارغ."
      );

      return;
    }


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

                url: url

              }
            }
          }
        },

        {

          timeout: 60000,

          headers: {

            "Content-Type":
              "application/json"
          }
        }
      );


    console.log("=================================");
    console.log(
      "✅ Instagram Response:"
    );

    console.log(
      response.status
    );

    console.log(
      response.data
    );

    console.log("=================================");


    if (
      response.status === 200
    ) {

      console.log(
        "🎉 تم إرسال الفيديو بنجاح"
      );


      // Generic Template
      await sendGenericTemplate(
        senderId
      );


      // Facebook
      if (
        FACEBOOK_PAGE_ID &&
        FACEBOOK_PAGE_ACCESS_TOKEN
      ) {

        await postVideoToFacebook(

          url,

          "📥 لتحميل الريلز بدون تطبيق قم بتجربة: https://instagram.com/am_mo111_25_"

        );
      }
    }

  } catch (error) {

    console.error("=================================");
    console.error(
      "❌ ERROR SEND VIDEO"
    );


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


    let message =
      "❌ تعذر إرسال الفيديو.";


    if (
      error.response?.data?.error?.message
    ) {

      message +=
        "\n\n📌 السبب:\n" +
        error.response.data.error.message;
    }


    await sendReply(
      senderId,
      message
    );
  }
}


// =====================================================
// 💬 SEND MESSAGE
// =====================================================

async function sendReply(
  recipientId,
  messageText
) {

  try {

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

        headers: {

          "Content-Type":
            "application/json"
        }
      }
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
// 📘 POST VIDEO TO FACEBOOK
// =====================================================

async function postVideoToFacebook(
  videoUrl,
  caption
) {

  try {

    console.log(
      "📘 جاري نشر الفيديو على Facebook..."
    );


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

        timeout: 60000
      }
    );


    console.log(
      "✅ تم نشر الفيديو على Facebook"
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
