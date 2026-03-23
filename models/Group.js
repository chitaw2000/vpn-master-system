const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    masterGroupId: { type: String, required: true },
    nsRecord: { type: String, required: true }, // 🌟 Group အတွက် သီးသန့် NS Record ထည့်ရန်
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
