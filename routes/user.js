const express = require('express');
const axios = require('axios');
const userApp = express.Router(); // 🌟 ဒီစာကြောင်း ပျောက်သွားလို့ Error တက်တာပါ
const redisClient = require('../config/redis');
const User = require('../models/User');
require('dotenv').config();

// ==========================================
// 1. USER WEB PANEL (UI)
// ==========================================
userApp.get('/panel/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({ token: token });
        
        if(!user) return res.status(404).send("User not found or Invalid Token!");

        let dropdownOptions = `<optgroup label="${user.groupName}">`;
        if (user.accessKeys && Object.keys(user.accessKeys).length > 0) {
            Object.keys(user.accessKeys).forEach(serverName => {
                const isSelected = user.currentServer === serverName ? 'selected' : '';
                dropdownOptions += `<option value="${serverName}" ${isSelected}>${serverName}</option>`;
            });
        } else {
            dropdownOptions += `<option disabled>Master Panel မှ Key မပို့သေးပါ</option>`;
        }
        dropdownOptions += `</optgroup>`;

        const ssconfLink = `ssconf://${req.get('host')}/${token}.json#VPN-${encodeURIComponent(user.name.replace(/\s+/g, ''))}`;

        res.send(`
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
            <body class="bg-gray-100 flex justify-center items-center min-h-screen p-4">
                <div class="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-md">
                    <div class="text-center mb-6"><h2 class="text-2xl font-black text-gray-800"><i class="fas fa-shield-alt text-indigo-600 mr-2"></i>My VPN</h2><p class="text-gray-500 mt-1">Hello, <b class="text-gray-800">${user.name}</b></p></div>
                    <button id="copyBtn" onclick="copyLink('${ssconfLink}')" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow transition transform hover:-translate-y-1 mb-6 flex justify-center items-center text-lg"><i class="fas fa-copy mr-3 text-xl"></i> COPY SSCONF LINK</button>
                    <div class="bg-gray-50 p-5 rounded-xl mb-6 border border-gray-200">
                        <p class="mb-2 text-sm text-gray-500 uppercase font-bold tracking-wider">Data Usage</p>
                        <div class="flex justify-between items-end mb-2"><span class="text-2xl font-black text-indigo-600">${user.usedGB} <span class="text-base font-medium">GB</span></span><span class="text-gray-500 font-medium">/ ${user.totalGB} GB</span></div>
                        <div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full" style="width: ${(user.usedGB / user.totalGB) * 100}%"></div></div>
                        <p class="text-xs text-center text-red-500 font-bold mt-3"><i class="far fa-clock"></i> Expire: ${user.expireDate}</p>
                    </div>
                    <form action="/panel/change-server" method="POST">
                        <input type="hidden" name="token" value="${token}">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Switch Location</label>
                        <select name="newServer" class="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-gray-700">${dropdownOptions}</select>
                        <button type="submit" class="w-full bg-gray-800 hover:bg-black text-white font-bold py-3 rounded-lg shadow transition">Switch Now</button>
                    </form>
                </div>
                <script>
                    function copyLink(link) {
                        var tempInput = document.createElement("input"); tempInput.value = link; document.body.appendChild(tempInput); tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput);
                        var btn = document.getElementById('copyBtn'); btn.innerHTML = '<i class="fas fa-check-circle mr-3 text-xl"></i> LINK COPIED!'; btn.classList.replace('bg-green-500', 'bg-teal-600');
                        setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy mr-3 text-xl"></i> COPY SSCONF LINK'; btn.classList.replace('bg-teal-600', 'bg-green-500'); }, 3000);
                    }
                </script>
            </body></html>
        `);
    } catch (error) { res.status(500).send("System Error"); }
});

// ==========================================
// 2. CHANGE SERVER API & WEBHOOK
// ==========================================
userApp.post('/panel/change-server', async (req, res) => {
    const { token, newServer } = req.body;
    try {
        const user = await User.findOne({ token: token });
        if (user && user.accessKeys && user.accessKeys[newServer]) {
            user.currentServer = newServer;
            await user.save(); 
            await redisClient.del(token); 

            try {
                const masterWebhookUrl = 'http://178.128.55.202:8888/api/webhook/switch'; 
                await axios.post(masterWebhookUrl, { token: token, activeServer: newServer });
                console.log(`✅ Webhook Sent: User ${token} switched to ${newServer}`);
            } catch (webhookError) {
                console.error("❌ Webhook Failed to send");
            }
        }
        res.redirect('/panel/' + token);
    } catch (error) { res.status(500).send("Error changing server"); }
});

// ==========================================
// 3. OUTLINE APP JSON ENDPOINT (Robust Handling)
// ==========================================
// ==========================================
// 3. OUTLINE APP JSON ENDPOINT (Exact Format Ordering)
// ==========================================
userApp.get('/:token.json', async (req, res) => {
    const token = req.params.token;
    try {
        const cachedKey = await redisClient.get(token);
        if (cachedKey) {
            try { return res.json(JSON.parse(cachedKey)); } 
            catch (e) { await redisClient.del(token); }
        }
        
        const user = await User.findOne({ token: token });
        if (user && user.accessKeys && user.accessKeys[user.currentServer]) {
            let rawConfig = user.accessKeys[user.currentServer];
            
            // String အနေနဲ့ ဝင်လာရင် Object အဖြစ် ပြောင်းမည်
            if (typeof rawConfig === 'string' && rawConfig.startsWith('{')) {
                try { rawConfig = JSON.parse(rawConfig); } catch(e){}
            }
            
            // ss:// အဟောင်းတွေအတွက်
            if (typeof rawConfig === 'string' && rawConfig.startsWith('ss://')) {
                const fallbackFormat = { server: rawConfig };
                await redisClient.setEx(token, 300, JSON.stringify(fallbackFormat));
                return res.json(fallbackFormat);
            }

            // 🌟 ဤနေရာသည် အရေးကြီးဆုံးဖြစ်သည် (လိုချင်သော Format အတိအကျ ပြန်စီခြင်း) 🌟
            if (typeof rawConfig === 'object' && rawConfig.server) {
                rawConfig = {
                    server: rawConfig.server,
                    server_port: Number(rawConfig.server_port), // Port သည် ဂဏန်းဖြစ်ရမည်
                    password: rawConfig.password,
                    method: rawConfig.method,
                    prefix: rawConfig.prefix || ""
                };
            }

            // ပြန်စီထားသော Data ကို Cache ထဲသိမ်းပြီး App သို့ ပြန်ပို့မည်
            await redisClient.setEx(token, 300, JSON.stringify(rawConfig));
            return res.json(rawConfig);
        }
        res.status(404).json({ error: "Configuration Not Found" });
    } catch (error) { 
        console.error("❌ JSON Error:", error.message);
        res.status(500).json({ error: "System Error" }); 
    }
});
module.exports = userApp;
