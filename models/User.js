const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    groupName: { type: String, required: true }, // 🆕 User ပိုင်ဆိုင်သော Group
    currentServer: { type: String, required: true },
    usedGB: { type: Number, default: 0 },
    totalGB: { type: Number, required: true }
});

module.exports = mongoose.model('User', userSchema);
