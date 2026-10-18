// # users.js ->
//
// ✅ NEW: POST /forgot-password, GET + POST /reset-password/:token
// ✅ FIXED: register field check (`!name, !email, !password` only checked password)
// ✅ FIXED: register response now includes `name` (login already did)
// ✅ FIXED: email / password must be strings (blocks NoSQL-injection objects like { "$ne": null })
//
// Needs:  npm i nodemailer
// .env :  JWT_SECRET, FRONTEND_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const JWT_SECRET = process.env.JWT_SECRET;

// ---------------- Forgot-password settings ----------------
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // reset link is valid for 15 minutes
const RESET_COOLDOWN_MS = 60 * 1000; // max one reset email per account per minute
const MIN_PASSWORD_LENGTH = 6; // keep in sync with the frontend reset page

const isText = (v) => typeof v === "string" && v.trim() !== "";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------------- Email (nodemailer) ----------------
let mailTransporter;
function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (!process.env.SMTP_HOST) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
  });
  return mailTransporter;
}

async function sendResetEmail({ to, name, link }) {
  const transporter = getMailTransporter();

  // No SMTP set up yet: in development just print the link in the server console.
  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM)");
    }
    console.log(`\n[DEV] SMTP not configured. Password reset link for ${to}:\n${link}\n`);
    return;
  }

  const minutes = RESET_TOKEN_TTL_MS / 60000;
  const safeName = escapeHtml(name || "there");

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Reset your SurveyPok password",
    text:
      `Hi ${name || "there"},\n\n` +
      `We received a request to reset your SurveyPok password.\n` +
      `Open this link to choose a new one (valid for ${minutes} minutes):\n\n${link}\n\n` +
      `If you didn't ask for this, you can safely ignore this email.`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 12px;color:#164e63">Reset your password</h2>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your SurveyPok password. This link is valid for <b>${minutes} minutes</b>.</p>
        <p style="margin:28px 0">
          <a href="${link}" style="background:#164e63;color:#fff;padding:12px 22px;text-decoration:none;display:inline-block">
            Choose a new password
          </a>
        </p>
        <p style="font-size:13px;color:#555">Or paste this link into your browser:<br>
          <a href="${link}" style="color:#164e63;word-break:break-all">${link}</a></p>
        <p style="font-size:13px;color:#555">If you didn't ask for this, you can safely ignore this email.</p>
      </div>`,
  });
}

module.exports = function usersRoutes(usersCollection) {
  const router = express.Router();

  const loggedUser = [];

  // ✅ Register appointments Route ==================
  router.post("/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // ✅ FIXED: was `(!name, !email, !password)` (comma operator → only checked password)
      if (!isText(name) || !isText(email) || !isText(password)) {
        return res.status(400).send({
          success: false,
          message: "All field are required",
        });
      }
      // checking is user exists --------------
      const existUser = await usersCollection.findOne({ email });
      if (existUser) {
        return res.status(400).send({
          success: false,
          message: "Users already exists",
        });
      }
      // hash Password ---------------------
      const hashedPassword = await bcrypt.hash(password, 10);
      // Insert new user --------
      const newUser = {
        name,
        email,
        password: hashedPassword,
        role: "user",
      };
      const result = await usersCollection.insertOne(newUser);
      // Generate jwt token -----------
      const token = jwt.sign(
        {
          id: result.insertedId.toString(),
          email: newUser.email,
          role: newUser.role,
        },
        JWT_SECRET,
        { expiresIn: "24h" },
      );

      res.status(201).send({
        success: true,
        message: "Registration successful",
        token,
        user: {
          id: result.insertedId.toString(),
          name: newUser.name, // ✅ added
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  });

  // ✅ Login appointments Route ==================
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!isText(email) || !isText(password)) {
        return res.status(400).send({
          success: false,
          message: "Email and Password are required",
        });
      }

      // checking if user exists --------------
      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(401).send({
          success: false,
          message: "User not found",
        });
      }

      // ✅ Compare hashed password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).send({
          success: false,
          message: "Invalid password",
        });
      }

      // Generate JWT token ----
      // after you've verified the email + password (bcrypt.compare)
      const token = jwt.sign(
        { id: user._id.toString() },
        process.env.JWT_SECRET,
        {
          expiresIn: "24h",
        },
      );

      // ✅ Already logged check
      const exists = loggedUser.find((u) => u.email === user.email);
      if (!exists) {
        loggedUser.push({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        });
      }
      return res.send({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  });

  // =========================================================
  // ✅ FORGOT PASSWORD — step 1: request the reset email
  // POST /forgot-password   body: { email }
  //
  // Always answers with the SAME message whether or not the email exists,
  // so nobody can use this route to find out who has an account.
  // Only a SHA-256 hash of the token is stored; the raw token only ever
  // exists in the emailed link.
  // =========================================================
  router.post("/forgot-password", async (req, res) => {
    const genericResponse = {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    };

    try {
      const { email } = req.body;

      if (!isText(email)) {
        return res.status(400).send({
          success: false,
          message: "Email is required",
        });
      }

      const cleanEmail = email.trim();
      const user = await usersCollection.findOne({ email: cleanEmail });

      // unknown email → pretend it worked
      if (!user) return res.send(genericResponse);

      // cooldown: ignore repeat requests inside 60s (stops email spamming)
      if (
        user.resetRequestedAt &&
        Date.now() - new Date(user.resetRequestedAt).getTime() < RESET_COOLDOWN_MS
      ) {
        return res.send(genericResponse);
      }

      // random token → store only its hash + expiry
      const rawToken = crypto.randomBytes(32).toString("hex");
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            resetPasswordToken: sha256(rawToken),
            resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
            resetRequestedAt: new Date(),
          },
        },
      );

      const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
      const link = `${frontendUrl}/reset-password/${rawToken}`;

      try {
        await sendResetEmail({ to: user.email, name: user.name, link });
      } catch (mailError) {
        // Logged for you, but the visitor still gets the generic answer
        // (a different reply here would reveal that the account exists).
        console.error("Failed to send password reset email:", mailError.message);
      }

      return res.send(genericResponse);
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).send({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  });

  // =========================================================
  // ✅ FORGOT PASSWORD — step 2a: is this link still valid?
  // GET /reset-password/:token
  // (lets the reset page show "link expired" before the user types anything)
  // =========================================================
  async function findUserByResetToken(token) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;
    return usersCollection.findOne({
      resetPasswordToken: sha256(token),
      resetPasswordExpires: { $gt: new Date() },
    });
  }

  router.get("/reset-password/:token", async (req, res) => {
    try {
      const user = await findUserByResetToken(req.params.token);
      if (!user) {
        return res.status(400).send({
          success: false,
          message: "This reset link is invalid or has expired.",
        });
      }
      return res.send({ success: true, message: "Reset link is valid" });
    } catch (error) {
      return res.status(500).send({ success: false, message: "Something went wrong. Please try again." });
    }
  });

  // =========================================================
  // ✅ FORGOT PASSWORD — step 2b: set the new password
  // POST /reset-password/:token   body: { password }
  // The token is single-use: it is deleted as soon as the password changes.
  // =========================================================
  router.post("/reset-password/:token", async (req, res) => {
    try {
      const { password } = req.body;

      if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).send({
          success: false,
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        });
      }

      const user = await findUserByResetToken(req.params.token);
      if (!user) {
        return res.status(400).send({
          success: false,
          message: "This reset link is invalid or has expired.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: { password: hashedPassword, passwordChangedAt: new Date() },
          $unset: { resetPasswordToken: "", resetPasswordExpires: "", resetRequestedAt: "" },
        },
      );

      return res.send({
        success: true,
        message: "Password reset successful. Please log in with your new password.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).send({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  });

  // ✅ Logged in users route =============
  router.get("/logged-user", (req, res) => {
    res.send({
      success: true,
      count: loggedUser.length,
      users: loggedUser,
    });
  });

  // ✅ all users route =============
  router.get("/all-users", (req, res) => {
    usersCollection
      .find()
      .toArray()
      .then((data) => res.json(data))
      .catch((error) => {
        console.error("Error fetching data:", error);
        res.status(500).json({ message: "Error fetching data" });
      });
  });

  return router;
};
