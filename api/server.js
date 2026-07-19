await axios.post(
      https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN},
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
    console.log("✅ تم إرسال القالب بنجاح.");
  } catch (err) {
    console.error("❌ خطأ في إرسال القالب:", err.response ? err.response.data : err.message);
  }
}

// 📌 إرسال الريلز أولاً ثم قالب التحميل
async function sendInstagramReel(senderId, url) {
  try {
    const sendResponse = await axios.post(
      https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN},
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
      console.log("✅ تم إرسال الفيديو للمستخدم بنجاح.");
      
      // ➕ بعد نجاح إرسال الفيديو، نرسل القالب
      await sendGenericTemplate(senderId);

      // ➕ نشر الفيديو على صفحة فيسبوك (تأكد من إضافة توكن وأيدي الصفحة)
      if (FACEBOOK_PAGE_ID && FACEBOOK_PAGE_ACCESS_TOKEN) {
        await postVideoToFacebook(url, "📥 لي تحميل رليز بدون تطبيق قوم بي تجربات https://instagram.com/am_mo111_25_ ");
      } else {
        console.log("⚠️ تم تخطي النشر على فيسبوك لأن إعدادات FACEBOOK_PAGE_ID مفقودة.");
      }
      
    } else {
      console.log("❌ فشل في إرسال الفيديو.");
      await sendReply(senderId, "❌ حدث خطأ أثناء محاولة إرسال الفيديو.");
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال الفيديو:", error.response ? JSON.stringify(error.response.data) : error.message);
    await sendReply(senderId, "❌ وقع خطأ أثناء محاولة إرسال الفيديو. قد يكون حجم الملف كبيراً.");
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
