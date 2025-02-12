const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Note = require("../models/note");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const uploadDir = path.join("uploads");
let uniqueCounter = 1; // Default start value

// Function to initialize the counter from existing files
const initializeCounter = (userId) => {
  const userFolder = path.join(uploadDir, userId);

  if (fs.existsSync(userFolder)) {
    const files = fs.readdirSync(userFolder);

    console.log("Existing files in user folder:", files); // Debugging log

    // Extract numeric suffixes by splitting at '-'
    const suffixes = files
      .map((file) => {
        const parts = file.split("-"); // Split filename by '-'
        const lastPart = parts[parts.length - 1]; // Get last part
        const num = parseInt(lastPart, 10); // Convert to integer
        return isNaN(num) ? null : num; // Ignore if not a number
      })
      .filter((num) => num !== null);

    console.log("Extracted numeric suffixes:", suffixes); // Debugging log

    // Find the largest suffix and increment from there
    if (suffixes.length > 0) {
      uniqueCounter = Math.max(...suffixes) + 1;
    }
  }

  console.log(`Starting uniqueCounter from ${uniqueCounter}`);
};

// Function to ensure user folder exists and initialize counter
const ensureUserFolderExists = (userId) => {
  const userFolder = path.join(uploadDir, userId);

  // Create the user folder if it doesn't exist
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  // Initialize or update the counter for the user folder
  initializeCounter(userId);
};

//destination and upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    req.user = 1;
    const userFolder = path.join(`uploads/${req.user}`);

    // Check if directory exists, if not, create it
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true }); // Creates the directory recursively
    }
    ensureUserFolderExists(req.user.toString());
    cb(null, userFolder);
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname); // Get original file extension

    if (!req.uniqueSuffix) {
      req.uniqueSuffix = uniqueCounter++; // Store in req
    }
    const filename = `${file.fieldname}-${req.uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

const router = express.Router();

// Register User
router.post("/signup", async (req, res) => {
  console.log("hllo there");

  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword });

    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    res.json({
      message: "User registered successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login User
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
const cpUpload = upload.fields([{ name: "image" }, { name: "audio" }]);

// Protected Route Example
router.post("/upload", cpUpload, async (req, res) => {
  const files = req.files;
  console.log("reqfile", req.files.image[0].path);

  let note = new Note({
    transcript: req.body.transcript,
    image: req.files.image[0].path,
    audio: req.files.audio[0].path,
    user: req.user,
  });
  await note.save();
  res.json("hi there");
});

router.get("/get-files", (req, res) => {
  req.user = 1;
  const userFolderPath = path.join("uploads", req.user.toString());
  fs.readdir(userFolderPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Error reading files" });
    }

    // Filter image files only (JPG, PNG, JPEG, GIF)
    const imageFiles = files;
    console.log("imageFiles", files);
    // Construct file URLs
    const fileUrls = imageFiles.map((file) => ({
      name: file,
      url: `${req.protocol}://${req.get(
        "host"
      )}/uploads/${req.user.toString()}/${file}`,
    }));

    res.json({ images: fileUrls });
  });
});

module.exports = router;
