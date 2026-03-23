const mongoose = require('mongoose');
module.exports = mongoose.model('User', new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    currentServer: { type: String, required: true },
    usedGB: { type: Number, default: 0 },
    totalGB: { type: Number, required: true }
}));
