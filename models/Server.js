const mongoose = require('mongoose');
module.exports = mongoose.model('Server', new mongoose.Schema({
    groupName: { type: String, required: true },
    serverName: { type: String, required: true },
    serverKey: { type: String, required: true }
}));
