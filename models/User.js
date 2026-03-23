const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    groupName: { type: String, required: true }, 
    currentServer: { type: String, required: true },
    usedGB: { type: Number, default: 0 },
    totalGB: { type: Number, required: true },
    expireDate: { type: String, required: true } // 🆕 Date အတွက် အသစ်
});

module.exports = mongoose.model('User', userSchema);
