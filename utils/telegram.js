// File: utils/telegram.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Telegram သို့ Backup ဖိုင် ပို့ပေးမည့် Function
async function sendBackupDocument(botToken, chatId, filePath, caption = "") {
    try {
        if (!fs.existsSync(filePath)) throw new Error("Backup file not found.");

        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append('document', fs.createReadStream(filePath));

        const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendDocument`, form, {
            headers: form.getHeaders(),
            timeout: 60000 // File ကြီးလျှင် အချိန်ကြာနိုင်သဖြင့် 60s ပေးထားပါသည်
        });
        return response.data;
    } catch (error) {
        console.error("❌ Telegram Send Error:", error.message);
        throw error;
    }
}

module.exports = { sendBackupDocument };
