const express = require('express');
const axios = require('axios');
const userApp = express.Router();
const redisClient = require('../config/redis');
const User = require('../models/User');
const Group = require('../models/Group');

// 🌟 Exponential Backoff Retry Function
async function fetchWithRetry(url, data, config, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try { 
            return await axios.post(url, data, config); 
        } 
        catch (err) { 
            if (i === retries - 1) throw err; 
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i))); 
        }
    }
}

// ==========================================
// 1. USER WEB PANEL (UI)
// ==========================================
userApp.get('/panel/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({ token: token });
        
        if(!user) return res.status(404).send("User not found or Invalid Token!");

        const group = await Group.findOne({ name: user.groupName });
        const domainName = (group && group.nsRecord) ? group.nsRecord : req.hostname;

        // Node ရွေးချယ်ရန် Dropdown Menu တည်ဆောက်ခြင်း
        let dropdownOptions = `<optgroup label="${user.groupName}">`;
        if (user.accessKeys && Object.keys(user.accessKeys).length > 0) {
            Object.keys(user.accessKeys).forEach(serverName => {
                const isSelected = user.currentServer === serverName ? 'selected' : '';
                dropdownOptions += `<option value="${serverName}" ${isSelected}>${serverName}</option>`;
            });
        } else { 
            dropdownOptions += `<option disabled>No Nodes Available</option>`; 
        }
        dropdownOptions += `</optgroup>`;

        const ssconfLink = `ssconf://${domainName}/${token}.json#VPN-${encodeURIComponent(user.name.replace(/\s+/g, ''))}`;

        // 🌟 HTML အပြည့်အစုံ (လုံးဝ မချုံ့ထားပါ)
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>User Control Panel</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
            </head>
            <body class="bg-gray-100 flex justify-center items-center min-h-screen p-4">
                <div class="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-md">
                    
                    <div class="text-center mb-6">
                        <h2 class="text-2xl font-black text-gray-800">
                            <i class="fas fa-shield-alt text-indigo-600 mr-2"></i>My VPN
                        </h2>
                        <p class="text-gray-500 mt-1">Hello, <b class="text-gray-800">${user.name}</b></p>
                    </div>
                    
                    <button id="copyBtn" onclick="copyLink('${ssconfLink}')" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow mb-6 transition">
                        <i class="fas fa-copy mr-3"></i> COPY SSCONF LINK
                    </button>
                    
                    <div class="bg-gray-50 p-5 rounded-xl mb-6 border">
                        <div class="flex justify-between items-end mb-2">
                            <span class="text-2xl font-black text-indigo-600">${user.usedGB} <span class="text-base">GB</span></span>
                            <span class="text-gray-500">/ ${user.totalGB} GB</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-indigo-500 h-2 rounded-full" style="width: ${(user.usedGB / user.totalGB) * 100}%"></div>
                        </div>
                        <p class="text-xs text-center text-red-500 font-bold mt-3">
                            Expire: ${user.expireDate}
                        </p>
                    </div>
                    
                    <form action="/panel/change-server" method="POST">
                        <input type="hidden" name="token" value="${token}">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Switch Location</label>
                        <select name="newServer" class="w-full p-3 border rounded-lg mb-4 outline-none font-semibold text-slate-700">
                            ${dropdownOptions}
                        </select>
                        <button type="submit" class="w-full bg-gray-800 hover:bg-black text-white font-bold py-3 rounded-lg shadow transition">
                            Switch Now
                        </button>
                    </form>
                    
                </div>
                
                <script>
                    function copyLink(link) { 
                        var t = document.createElement("input"); 
                        t.value = link; 
                        document.body.appendChild(t); 
                        t.select(); 
                        document.execCommand("copy"); 
                        document.body.removeChild(t); 
                        
                        var btn = document.getElementById('copyBtn'); 
                        btn.innerHTML = '<i class="fas fa-check-circle mr-3"></i> LINK COPIED!'; 
                        btn.classList.replace('bg-green-500', 'bg-teal-600'); 
                        
                        setTimeout(() => { 
                            btn.innerHTML = '<i class="fas fa-copy mr-3"></i> COPY SSCONF LINK'; 
                            btn.classList.replace('bg-teal-600', 'bg-green-500'); 
                        }, 3000); 
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) { 
        res.status(500).send("System Error"); 
    }
});

// ==========================================
// 2. CHANGE SERVER LOGIC
// ==========================================
userApp.post('/panel/change-server', async (req, res) => {
    try {
        const { token, newServer } = req.body;
        const user = await User.findOne({ token: token });
        
        if (!user) return res.status(404).send("User not found");
        
        const groupInfo = await Group.findOne({ name: user.groupName });
        if (!groupInfo) return res.status(404).send("Group Error");

        // အကယ်၍ User တွင် ထို Server မရှိပါက Master ထံမှ ပြန်ဆွဲယူမည်
        if (!user.accessKeys || !user.accessKeys[newServer]) {
            try {
                const masterResponse = await fetchWithRetry(groupInfo.masterIp + '/api/generate-keys', {
                    masterGroupId: groupInfo.masterGroupId, 
                    userName: user.name, 
                    totalGB: user.totalGB, 
                    expireDate: user.expireDate
                }, { headers: { 'x-api-key': groupInfo.masterApiKey } });
                
                if (masterResponse.data && masterResponse.data.keys) { 
                    const updateQuery = {};
                    for (const [nodeName, nodeConfig] of Object.entries(masterResponse.data.keys)) {
                        updateQuery[`accessKeys.${nodeName}`] = nodeConfig;
                    }
                    await User.updateOne({ _id: user._id }, { $set: updateQuery });
                }
            } catch (err) { 
                console.log("Key Sync Error"); 
            }
        }

        user.currentServer = newServer; 
        await user.save(); 
        
        // Cache အဟောင်းဖျက်မည်
        try { await redisClient.del(token); } catch(e){}

        // Master ဆီသို့ Switch ပြောင်းကြောင်း သတင်းပို့မည် (Retry ၃ ကြိမ်)
        try { 
            await fetchWithRetry(
                groupInfo.masterIp + '/api/webhook/switch', 
                { token: token, activeServer: newServer }, 
                { headers: { 'x-api-key': groupInfo.masterApiKey } }
            ); 
        } catch (err) {
            console.log("Webhook Switch Error");
        }
        
        res.redirect('/panel/' + token);
    } catch (error) { 
        res.status(500).send("Error Changing Server"); 
    }
});

// ==========================================
// 3. SSCONF SUBSCRIPTION API
// ==========================================
userApp.get('/:token.json', async (req, res) => {
    try {
        const token = req.params.token;
        
        // Redis Cache စစ်ဆေးခြင်း
        const cachedKey = await redisClient.get(token);
        if (cachedKey) { 
            try { 
                return res.json(JSON.parse(cachedKey)); 
            } catch (e) { 
                await redisClient.del(token); 
            } 
        }
        
        const user = await User.findOne({ token: token });
        if (user && user.accessKeys && user.accessKeys[user.currentServer]) {
            let rawConfig = user.accessKeys[user.currentServer];
            
            if (typeof rawConfig === 'string' && rawConfig.startsWith('{')) { 
                try { rawConfig = JSON.parse(rawConfig); } catch(e){} 
            }
            if (typeof rawConfig === 'string' && rawConfig.startsWith('ss://')) { 
                return res.json({ server: rawConfig }); 
            }

            if (typeof rawConfig === 'object' && rawConfig.server) { 
                rawConfig = { 
                    server: rawConfig.server, 
                    server_port: Number(rawConfig.server_port), 
                    password: rawConfig.password, 
                    method: rawConfig.method, 
                    prefix: rawConfig.prefix || "" 
                }; 
            }
            
            // Cache တွင် ၅ မိနစ် (300 စက္ကန့်) မှတ်ထားမည်
            await redisClient.setEx(token, 300, JSON.stringify(rawConfig));
            return res.json(rawConfig);
        }
        res.status(404).json({ error: "Configuration Not Found" });
    } catch (error) { 
        res.status(500).json({ error: "System Error" }); 
    }
});

// ==========================================
// 4. SUPER FORGIVING AUTO-RECEIVE WEBHOOK (ROOT)
// ==========================================
userApp.post('/api/internal/sync-new-server', async (req, res) => {
    console.log("\n[WEBHOOK RECEIVED] /api/internal/sync-new-server");

    try {
        const apiKey = req.headers['x-api-key'];
        const { newServerName, userKeys } = req.body;

        if (!newServerName || !userKeys) {
            console.log("❌ Invalid Data Sent by Master");
            return res.status(400).json({ error: "Invalid payload data" });
        }

        // API Key ကိုက်ညီသော Group ကိုရှာမည် (မည်သည့် Group ID မဆို လက်ခံမည်)
        const validGroup = await Group.findOne({ masterApiKey: apiKey });
        if (!validGroup) {
            console.log("❌ Unauthorized API Key");
            return res.status(401).json({ error: "Unauthorized" });
        }

        let successCount = 0;
        
        for (const [identifier, newConfig] of Object.entries(userKeys)) {
            // Case-Insensitive (စာလုံးအကြီးအသေး မခွဲခြားသော) ရှာဖွေမှု
            const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            const user = await User.findOne({ 
                $or: [
                    { token: identifier }, 
                    { name: new RegExp('^' + escapedIdentifier + '$', 'i') } 
                ] 
            });

            if (user) {
                // Database ထဲသို့ တိုက်ရိုက် ထိုးသွင်းမည် (Force Inject)
                await User.updateOne(
                    { _id: user._id }, 
                    { $set: { [`accessKeys.${newServerName}`]: newConfig } }
                );
                
                // Cache ကို ချက်ချင်းရှင်းလင်းမည်
                try { await redisClient.del(user.token); } catch(e){}
                
                successCount++;
            }
        }

        if (successCount === 0) {
            console.log(`❌ FAILED: Received ${Object.keys(userKeys).length} keys, but matched 0 users.`);
        } else {
            console.log(`✅ SUCCESS: Synced ${newServerName} for ${successCount} users!`);
        }

        return res.json({ success: true, message: `Server synced successfully for ${successCount} users` });
    } catch (error) { 
        console.error("❌ Webhook Server Error:", error.message);
        res.status(500).json({ error: "Server Error" }); 
    }
});

module.exports = userApp;
