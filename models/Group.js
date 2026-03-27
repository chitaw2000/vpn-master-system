const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    masterGroupId: { type: String, required: true },
    nsRecord: { type: String, required: true },
    masterIp: { type: String, required: true },       // 🌟 Master Panel IP အသစ်
    masterApiKey: { type: String, required: true }    // 🌟 သက်ဆိုင်ရာ API Key
});

module.exports = mongoose.model('Group', groupSchema);
