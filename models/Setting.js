// File: models/Setting.js
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    botToken: { type: String, default: '' },
    adminId: { type: String, default: '' },
    backupIntervalHours: { type: Number, default: 1 }
});

module.exports = mongoose.model('Setting', settingSchema);
