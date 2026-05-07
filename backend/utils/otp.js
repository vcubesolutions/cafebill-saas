/**
 * otp.js — Shared SMS + Email OTP sending utility for CafeBill SaaS
 * Mirrors the same logic as cafe-billing/backend/routes/auth.js
 */
const axios = require("axios");

// ── SMS config ────────────────────────────────────────────────
const SMS_PROVIDER = process.env.SMS_PROVIDER || "demo";
const FAST2SMS_KEY = process.env.FAST2SMS_KEY || "";
const MSG91_KEY    = process.env.MSG91_KEY    || "";
const MSG91_SENDER = process.env.MSG91_SENDER || "CAFBIL";
const TWILIO_SID   = process.env.TWILIO_SID   || "";
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || "";
const TWILIO_FROM  = process.env.TWILIO_FROM  || "";

// ── Email config ──────────────────────────────────────────────
const EMAIL_USER   = process.env.EMAIL_USER   || "";
const EMAIL_PASS   = process.env.EMAIL_PASS   || "";
const EMAIL_HOST   = process.env.EMAIL_HOST   || "";
const EMAIL_PORT   = parseInt(process.env.EMAIL_PORT || "465");
const EMAIL_SECURE = process.env.EMAIL_SECURE !== "false";

let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  try {
    const nodemailer = require("nodemailer");
    if (EMAIL_HOST) {
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST, port: EMAIL_PORT, secure: EMAIL_SECURE,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      });
      console.log(`✅ Email (Custom SMTP: ${EMAIL_HOST}) configured for OTP`);
    } else {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      });
      console.log("✅ Email (Gmail) configured for OTP");
    }
  } catch (e) {
    console.warn("⚠️  nodemailer not installed — run: npm install nodemailer");
  }
}

// ── Generate 6-digit OTP ──────────────────────────────────────
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Send SMS ──────────────────────────────────────────────────
async function sendSms(mobile, otp) {
  const message = `Your CafeBill OTP is: ${otp}. Valid for 5 minutes. Do not share with anyone.`;

  try {
    if (SMS_PROVIDER === "fast2sms" && FAST2SMS_KEY) {
      const response = await axios.post(
        "https://www.fast2sms.com/dev/bulkV2",
        {
          route: "q",
          message: `Your CafeBill OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`,
          flash: "0",
          numbers: mobile,
        },
        { headers: { authorization: FAST2SMS_KEY } }
      );
      console.log(`✅ [Fast2SMS] OTP sent to ${mobile}`, response.data);

    } else if (SMS_PROVIDER === "msg91" && MSG91_KEY) {
      await axios.post("https://api.msg91.com/api/v5/otp", {
        template_id: "YOUR_MSG91_TEMPLATE_ID",
        mobile: `91${mobile}`,
        authkey: MSG91_KEY,
        otp,
      });
      console.log(`✅ [MSG91] OTP sent to ${mobile}`);

    } else if (SMS_PROVIDER === "twilio" && TWILIO_SID) {
      const twilio = require("twilio")(TWILIO_SID, TWILIO_TOKEN);
      await twilio.messages.create({ body: message, from: TWILIO_FROM, to: `+91${mobile}` });
      console.log(`✅ [Twilio] OTP sent to ${mobile}`);

    } else {
      // DEMO mode — log OTP to terminal
      console.log(`📱 [DEMO] OTP for +91${mobile}: ${otp}`);
      return { demo: true, otp };
    }
    return { demo: false };

  } catch (err) {
    const detail = err?.response?.data || err.message;
    console.error("❌ SMS send error:", JSON.stringify(detail, null, 2));
    throw new Error(
      typeof detail === "object"
        ? detail?.message || detail?.return || JSON.stringify(detail)
        : detail || "Failed to send OTP."
    );
  }
}

// ── Send Email OTP ────────────────────────────────────────────
async function sendEmailOtp(email, otp, name) {
  if (!transporter) return { emailSent: false };
  await transporter.sendMail({
    from: `"CafeBill" <${EMAIL_USER}>`,
    to: email,
    subject: `${otp} is your CafeBill OTP`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
        <div style="background:#ea580c;padding:24px;text-align:center">
          <h2 style="color:white;margin:0">☕ CafeBill</h2>
        </div>
        <div style="padding:32px;text-align:center">
          <p style="color:#374151;font-size:16px">Hi <b>${name || "there"}</b>, your OTP is:</p>
          <div style="background:#fff7ed;border:2px dashed #ea580c;border-radius:12px;padding:20px;margin:20px 0;display:inline-block">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#ea580c">${otp}</span>
          </div>
          <p style="color:#6b7280;font-size:13px">This OTP is valid for <b>5 minutes</b>.<br/>Do not share it with anyone.</p>
        </div>
      </div>
    `,
  });
  return { emailSent: true };
}

module.exports = { generateOtp, sendSms, sendEmailOtp };
