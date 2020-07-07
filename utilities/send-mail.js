"use strict";
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const $ = require("cheerio");

const config = {
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

if (process.env.SMTP_SERVICE != null) {
  config.service = process.env.SMTP_SERVICE;
} else {
  config.host = process.env.SMTP_HOST;
  config.port = parseInt(process.env.SMTP_PORT);
  config.secure = process.env.SMTP_SECURE !== "false";
}

const transporter = nodemailer.createTransport(config);
const templateName = process.env.TEMPLATE_NAME
  ? process.env.TEMPLATE_NAME
  : "rainbow";
const noticeTemplate = ejs.compile(
  fs.readFileSync(
    path.resolve(process.cwd(), "template", templateName, "notice.ejs"),
    "utf8"
  )
);
const sendTemplate = ejs.compile(
  fs.readFileSync(
    path.resolve(process.cwd(), "template", templateName, "send.ejs"),
    "utf8"
  )
);

// 提醒站长
exports.notice = (comment) => {
  // 站长自己发的评论不需要通知
  if (
    comment.get("mail") === process.env.TO_EMAIL ||
    comment.get("mail") === process.env.BLOGGER_EMAIL ||
    comment.get("mail") === process.env.SMTP_USER
  ) {
    return;
  }

  const name = comment.get("nick");
  const text = comment.get("comment");
  const url = process.env.SITE_URL + comment.get("url");
  const comment_id = process.env.COMMENT ? process.env.COMMENT : "";

  if (!process.env.DISABLE_EMAIL) {
    const emailSubject =
      "📌 ● 啟奏皇上，「" + process.env.SITE_NAME + "」上有壹刁民求見，是見呢還是斬了，您說了算。💦";
    const emailContent = noticeTemplate({
      siteName: process.env.SITE_NAME,
      siteUrl: process.env.SITE_URL,
      name: name,
      text: text,
      url: url + comment_id,
      mail: comment.get("mail"),
    });
    const mailOptions = {
      from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + ">",
      to:
        process.env.TO_EMAIL ||
        process.env.BLOGGER_EMAIL ||
        process.env.SMTP_USER,
      subject: emailSubject,
      html: emailContent,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error(error);
      }
      comment.set("isNotified", true);
      comment.save();
      console.log("收到一条评论, 已邮件提醒站长");
    });
  }

  // 微信提醒
  const scContent =
    "#### 评论内容" +
    "\r\n > " +
    comment.get("comment") +
    "\r\n" +
    "原文地址 👉 " +
    process.env.SITE_URL +
    comment.get("url") +
    "\r\n #### 评论人\r\n" +
    comment.get("nick") +
    "(" +
    comment.get("mail") +
    ")";
  if (process.env.SCKEY != null) {
    axios({
      method: "post",
      url: `https://sc.ftqq.com/${process.env.SCKEY}.send`,
      data: `text=${process.env.SITE_NAME} 来新评论啦！&desp=${scContent}`,
      headers: {
        "Content-type": "application/x-www-form-urlencoded",
      },
    })
      .then(function (response) {
        if (response.status === 200 && response.data.errmsg === "success")
          console.log("已微信提醒站长");
        else console.log("微信提醒失败:", response.data);
      })
      .catch(function (error) {
        console.warn("微信提醒失败:", error.message);
      });
  }
  // QQ提醒
  if (process.env.QMSG_KEY != null) {
    if (process.env.QQ_SHAKE != null) {
      axios
        .get(
          `https://qmsg.zendee.cn:443/send/${
            process.env.QMSG_KEY
          }.html?msg=${encodeURIComponent("[CQ:shake]")}`
        )
        .then(function (response) {
          if (response.status === 200 && response.data.success === true) {
            console.log("已发送QQ戳一戳");
          } else {
            console.error("发送QQ戳一戳失败:", response.data);
          }
        })
        .catch(function (error) {
          console.error("发送QQ戳一戳失败:", error.message);
        });
    }
    let qq = "";
    if (process.env.QQ != null) {
      qq = "&qq=" + process.env.QQ;
    }
    const scContent = `[CQ:face,id=119]您的 ${
      process.env.SITE_NAME
    } 上有新评论了！
[CQ:face,id=183]${name} 发表评论：
[CQ:face,id=77][CQ:face,id=77][CQ:face,id=77][CQ:face,id=77][CQ:face,id=77]
${$(
  text
    .replace(/  <img.*?src="(.*?)".*?>/g, "\n[图片]$1\n")
    .replace(/<br>/g, "\n")
)
  .text()
  .replace(/\n+/g, "\n")
  .replace(/\n+$/g, "")}
[CQ:face,id=76][CQ:face,id=76][CQ:face,id=76][CQ:face,id=76][CQ:face,id=76]
[CQ:face,id=169]${url + "#" + comment.get("objectId")}`;
    axios
      .get(
        `https://qmsg.zendee.cn:443/send/${
          process.env.QMSG_KEY
        }.html?msg=${encodeURIComponent(scContent)}` + qq
      )
      .then(function (response) {
        if (response.status === 200 && response.data.success === true)
          console.log("已QQ提醒站长");
        else console.warn("QQ提醒失败:", response.data);
      })
      .catch(function (error) {
        console.error("QQ提醒失败:", error.message);
      });
  }
};

// 发送邮件通知他人
exports.send = (currentComment, parentComment) => {
  // 站长被 @ 不需要提醒
  if (
    parentComment.get("mail") === process.env.TO_EMAIL ||
    parentComment.get("mail") === process.env.BLOGGER_EMAIL ||
    parentComment.get("mail") === process.env.SMTP_USER
  ) {
    return;
  }
  const emailSubject =
    "📌 叮！「" + process.env.SITE_NAME + "」上有人回复了你啦！快戳我！💦";
  const emailContent = sendTemplate({
    siteName: process.env.SITE_NAME,
    siteUrl: process.env.SITE_URL,
    pname: parentComment.get("nick"),
    ptext: parentComment.get("comment"),
    name: currentComment.get("nick"),
    text: currentComment.get("comment"),
    url:
      process.env.SITE_URL +
      currentComment.get("url") +
      "#" +
      currentComment.get("pid"),
  });
  const mailOptions = {
    from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + ">",
    to: parentComment.get("mail"),
    subject: emailSubject,
    html: emailContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    currentComment.set("isNotified", true);
    currentComment.save();
    console.log(
      currentComment.get("nick") +
        " @了" +
        parentComment.get("nick") +
        ", 已通知."
    );
  });
};

// 该方法可验证 SMTP 是否配置正确
exports.verify = function () {
  console.log("....");
  transporter.verify(function (error, success) {
    if (error) {
      console.error(error.message);
    }
    console.log("Server is ready to take our messages");
  });
};
