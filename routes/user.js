const express = require('express');
const axios = require('axios');
const userApp = express.Router();
const redisClient = require('../config/redis');
const User = require('../models/User');
const Group = require('../models/Group');

// ==========================================
// 1. USER WEB PANEL (UI)
// ==========================================
userApp.get('/panel/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({ token: token });
        if(!user) return res.status(404).send("User not found!");

        const group = await Group.findOne({ name: user.groupName });
        const domainName = (group && group.nsRecord) ? group.nsRecord : req.hostname;

        let dropdownOptions = `<optgroup label="${user.groupName}">`;
        if (user.accessKeys) {
            Object.keys(user.accessKeys).forEach(serverName => {
                const isSelected = user.currentServer === serverName ? 'selected' : '';
                dropdownOptions += `<option value="${serverName}" ${isSelected}>${serverName}</option>`;
            });
        }
        dropdownOptions += `</optgroup>`;

        const ssconfLink = `ssconf://${domainName}/${token}.json#VPN-${encodeURIComponent(user.name.replace(/\s+/g, ''))}`;

        res.send(`
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
            <body class="bg-gray-100 flex justify-center items-center min-h-screen p-4">
                <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
                    <div class="text-center mb-6"><h2 class="text-2xl font-black text-gray-800">My VPN</h2><p class="text-gray-500 mt-1">Hello, <b class="text-gray-800">${user.name}</b></p></div>
                    <button id="copyBtn" onclick="copyLink('${ssconfLink}')" class="w-full bg-green-500 text-white font-bold py-4 rounded-xl shadow mb-6">COPY SSCONF LINK</button>
                    <div class="bg-gray-50 p-5 rounded-xl mb-6 border">
                        <div class="flex justify-between items-end mb-2"><span class="text-2xl font-black text-indigo-600">${user.usedGB} <span class="text-base">GB</span></span><span class="text-gray-500">/ ${user.totalGB} GB</span></div>
                        <div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full" style="width: ${(user.usedGB / user.totalGB) * 100}%"></div></div>
                        <p class="text-xs text-center text-red-500 font-bold mt-3">Expire: ${user.expireDate}</p>
                    </div>
                    <form action="/panel/change-server" method="POST">
                        <input type="hidden" name="token" value="${token}">
                        <select name="newServer" class="w-full p-3 border rounded-lg mb-4 outline-none">${dropdownOptions}</select>
                        <button type="submit" class="w-full bg-gray-800 text-white font-bold py-3 rounded-lg shadow">Switch Server</button>
                    </form>
                </div>
                <script>
                    function copyLink(link) {
                        var t = document.createElement("input"); t.value = link; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t);
                        var btn = document.getElementById('copyBtn'); btn.innerHTML = 'LINK COPIED!'; btn.classList.replace('bg-green-500', 'bg-teal-600');
                        setTimeout(() => { btn.innerHTML = 'COPY SSCONF LINK'; btn.classList.replace('bg-teal-600', 'bg-green-500'); }, 3000);
                    }
                </script>
            </body></html>
        `);
    } catch (error) { res.status(500).send("System Error"); }
});

// ==========================================
// 2. CHANGE SERVER API (Webhook & Auto-fetch)
// ==========================================
userApp.post('/panel/change-server', async (req, res) => {
    try {
        const { token, newServer } = req.body;
        const user = await User.findOne({ token: token });
        if (!user) return res.status(404).send("User not found");

        if (!user.accessKeys || !user.accessKeys[newServer]) {
            const groupInfo = await Group.findOne({ name: user.groupName });
            if (groupInfo) {
                try {
                    // 🌟 IP အသစ် နှင့် API Key တိုက်ရိုက်ထည့်ထားပါသည်
                    const masterResponse = await axios.post('http://168.144.33.53:8888/api/generate-keys', {
                        masterGroupId: groupInfo.masterGroupId, userName: user.name, totalGB: user.totalGB, expireDate: user.expireDate
                    }, { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' } });
                    
                    if (masterResponse.data && masterResponse.data.keys) {
                        user.accessKeys = masterResponse.data.keys; user.markModified('accessKeys');
                    }
                } catch (err) { console.log("Key Sync Error"); }
            }
        }

        user.currentServer = newServer; await user.save(); await redisClient.del(token); 

        try {
            // 🌟 IP အသစ် နှင့် API Key တိုက်ရိုက်ထည့်ထားပါသည်
            await axios.post('http://168.144.33.53:8888/api/webhook/switch', { 
                token: token, activeServer: newServer 
            }, { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' } });
        } catch (err) { console.log("Webhook Error"); }

        res.redirect('/panel/' + token);
    } catch (error) { res.status(500).send("Error"); }
});

// ==========================================
// 3. JSON ENDPOINT (Strict Formatting)
// ==========================================
userApp.get('/:token.json', async (req, res) => {
    try {
        const token = req.params.token;
        const cachedKey = await redisClient.get(token);
        if (cachedKey) { try { return res.json(JSON.parse(cachedKey)); } catch (e) { await redisClient.del(token); } }
        
        const user = await User.findOne({ token: token });
        if (user && user.accessKeys && user.accessKeys[user.currentServer]) {
            let rawConfig = user.accessKeys[user.currentServer];
            if (typeof rawConfig === 'string' && rawConfig.startsWith('{')) { try { rawConfig = JSON.parse(rawConfig); } catch(e){} }
            if (typeof rawConfig === 'string' && rawConfig.startsWith('ss://')) { return res.json({ server: rawConfig }); }

            if (typeof rawConfig === 'object' && rawConfig.server) {
                rawConfig = { 
                    server: rawConfig.server, 
                    server_port: Number(rawConfig.server_port), 
                    password: rawConfig.password, 
                    method: rawConfig.method, 
                    prefix: rawConfig.prefix || "" 
                };
            }
            await redisClient.setEx(token, 300, JSON.stringify(rawConfig));
            return res.json(rawConfig);
        }
        res.status(404).json({ error: "Configuration Not Found" });
    } catch (error) { res.status(500).json({ error: "System Error" }); }
});

module.exports = userApp;
