// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    groupName: { type: String, required: true },
    currentServer: { type: String, required: true },
    usedGB: { type: Number, default: 0 },
    totalGB: { type: Number, required: true },
    expireDate: { type: String, required: true },
    accessKeys: { type: Object, required: true } // 🌟 Server ၅ ခုစာ Key များကို သိမ်းမည့်နေရာ
});

module.exports = mongoose.model('User', userSchema);
