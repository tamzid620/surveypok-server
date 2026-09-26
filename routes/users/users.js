// # users.js ->

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY;

module.exports = function usersRoutes(usersCollection) {
  const router = express.Router();

  const loggedUser = [];

  // ✅ Register appointments Route ==================
  router.post("/register", async (req, res) => {
    try {
      const { fullName, email, password } = req.body;

      if ((!fullName,!email,!password)) {
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
        fullName,
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
        SECRET_KEY,
        { expiresIn: "24h" }, // token expires in 24 hour)
      );
      res.status(201).send({
        success: true,
        message: "Registration successful",
        token,
        user: {
          id: result.insertedId.toString(),
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

      if (!email || !password) {
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
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        SECRET_KEY,
        { expiresIn: "24h" },
      );

      // ✅ Already logged check
      const exists = loggedUser.find((u) => u.email === user.email);
      if (!exists) {
        loggedUser.push({
          id: user._id,
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