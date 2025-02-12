const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
  transcript: { type: String, required: true },
  image: { type: String, required: true, unique: true },
  audio: { type: String, required: true },
});

module.exports = mongoose.model("Note", NoteSchema);
