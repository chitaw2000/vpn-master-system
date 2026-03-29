const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    botToken: { type: String, default: '' },
    adminId: { type: String, default: '' },
    backupIntervalMinutes: { type: Number, default: 60 } // 🌟 ဤနေရာတွင် Minutes အဖြစ် ပြောင်းထားပါသည်
});

module.exports = mongoose.model('Setting', settingSchema);
