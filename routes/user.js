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
// 1. PING FETCH API (Background Task)
// ==========================================
// User တွေရဲ့ App ထဲကနေ Ping ကို နောက်ကွယ်ကနေ တိတ်တိတ်လေး လှမ်းတောင်းမည့် API (Page မထစ်စေရန်)
userApp.get('/panel/api/ping/:token/:nodeName', async (req, res) => {
    try {
        const { token, nodeName } = req.params;
        const user = await User.findOne({ token: token });
        if (!user) return res.json({ status: 'offline' });

        const group = await Group.findOne({ name: user.groupName });
        if (!group || !group.masterIp) return res.json({ status: 'offline' });

        // Master Panel ဆီသို့ Ping လှမ်းတောင်းမည်
        const url = `${group.masterIp}/api/ping/${encodeURIComponent(nodeName)}`;
        const response = await axios.get(url, {
            headers: { 'x-api-key': group.masterApiKey },
            timeout: 4000 // ၄ စက္ကန့်အတွင်း မရရင် Offline ပြမည်
        });

        res.json(response.data);
    } catch (error) {
        res.json({ status: 'offline' });
    }
});

// ==========================================
// 2. USER WEB PANEL (PREMIUM DARK MODE UI)
// ==========================================
userApp.get('/panel/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({ token: token });
        
        if(!user) return res.status(404).send("User not found or Invalid Token!");

        const group = await Group.findOne({ name: user.groupName });
        const domainName = (group && group.nsRecord) ? group.nsRecord : req.hostname;

        // 🌟 Premium Server List တည်ဆောက်ခြင်း
        let nodesListHtml = '';
        let nodeNames = []; // Javascript ဖြင့် Ping လှမ်းခေါ်ရန် သိမ်းထားမည်
        
        if (user.accessKeys && Object.keys(user.accessKeys).length > 0) {
            Object.keys(user.accessKeys).forEach(serverName => {
                nodeNames.push(serverName);
                const isSelected = user.currentServer === serverName;
                
                // ရွေးချယ်ထားသော Server ဖြစ်ပါက အရောင်ကွဲပြားစေမည်
                const activeClass = isSelected ? 'bg-indigo-900/30 border-l-4 border-indigo-500' : 'hover:bg-slate-800/50';
                const iconColor = isSelected ? 'text-indigo-400' : 'text-slate-400';
                const checkIcon = isSelected ? 
                    `<i class="fas fa-check-circle text-indigo-500 text-lg"></i>` : 
                    `<i class="fas fa-arrow-circle-right text-slate-600 hover:text-slate-400 transition text-lg"></i>`;

                nodesListHtml += `
                <form action="/panel/change-server" method="POST" class="m-0 border-b border-slate-800 last:border-0">
                    <input type="hidden" name="token" value="${token}">
                    <input type="hidden" name="newServer" value="${serverName}">
                    <button type="submit" class="w-full flex justify-between items-center p-4 transition-all duration-200 ${activeClass}">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                <i class="fas fa-globe ${iconColor} text-sm"></i>
                            </div>
                            <span class="font-bold ${isSelected ? 'text-white' : 'text-slate-300'} text-[15px] tracking-wide">${serverName}</span>
                        </div>
                        <div class="flex items-center gap-4">
                            <span id="ping-${serverName.replace(/\s+/g, '-')}" class="text-xs font-semibold text-slate-500 w-16 text-right tracking-wider">
                                <i class="fas fa-circle-notch fa-spin text-slate-600"></i>
                            </span>
                            ${checkIcon}
                        </div>
                    </button>
                </form>
                `;
            });
        } else { 
            nodesListHtml = `<div class="p-6 text-center text-slate-500 font-medium">No Servers Available</div>`; 
        }

        const ssconfLink = `ssconf://${domainName}/${token}.json#VPN-${encodeURIComponent(user.name.replace(/\s+/g, ''))}`;
        const usagePercent = user.totalGB > 0 ? ((user.usedGB / user.totalGB) * 100).toFixed(1) : 0;

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Premium VPN Panel</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                <style>
                    body { background-color: #0b1121; } /* Dark Navy Background */
                </style>
            </head>
            <body class="text-slate-200 font-sans min-h-screen pb-10 selection:bg-indigo-500 selection:text-white">
                
                <div class="max-w-md mx-auto px-4 pt-8">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h1 class="text-2xl font-black text-white tracking-tight">Premium<span class="text-indigo-500">VPN</span></h1>
                            <p class="text-sm font-medium text-slate-400 mt-1">ID: <span class="text-slate-300">${user.name}</span></p>
                        </div>
                        <div class="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                            <i class="fas fa-crown text-yellow-500 text-sm"></i>
                        </div>
                    </div>

                    <div class="bg-[#151f32] rounded-2xl p-5 shadow-lg border border-slate-800 mb-6 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <div class="flex justify-between items-end mb-2 relative z-10">
                            <div>
                                <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Data Usage</p>
                                <div class="text-3xl font-black text-white">${user.usedGB} <span class="text-sm text-slate-500 font-bold">/ ${user.totalGB} GB</span></div>
                            </div>
                        </div>
                        <div class="w-full bg-slate-800 rounded-full h-2.5 mt-3 relative z-10 overflow-hidden">
                            <div class="bg-gradient-to-r from-indigo-600 to-indigo-400 h-2.5 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" style="width: ${usagePercent}%"></div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-slate-800/80 flex justify-between items-center relative z-10">
                            <span class="text-xs font-bold text-slate-500"><i class="far fa-clock mr-1"></i> Expire Date</span>
                            <span class="text-xs font-bold text-yellow-500">${user.expireDate}</span>
                        </div>
                    </div>

                    <button id="copyBtn" onclick="copyLink('${ssconfLink}')" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-[0_4px_14px_rgba(79,70,229,0.4)] mb-8 transition-all active:scale-[0.98] flex justify-center items-center gap-2">
                        <i class="fas fa-link text-lg"></i> COPY SUBSCRIPTION LINK
                    </button>

                    <h3 class="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Available Servers</h3>
                    
                    <div class="bg-[#151f32] rounded-2xl overflow-hidden shadow-lg border border-slate-800">
                        <div class="bg-slate-800/40 p-4 text-sm font-bold text-white border-b border-slate-800 flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-server text-indigo-500"></i> ${user.groupName}
                            </div>
                        </div>
                        <div class="flex flex-col">
                            ${nodesListHtml}
                        </div>
                    </div>
                </div>
                
                <script>
                    const nodes = ${JSON.stringify(nodeNames)};
                    const token = '${token}';

                    async function fetchPings() {
                        for(let node of nodes) {
                            try {
                                // Request ping from sub-panel (which requests from master)
                                let res = await fetch('/panel/api/ping/' + token + '/' + encodeURIComponent(node));
                                let data = await res.json();
                                
                                // ID အတွက် Space များကို '-' အဖြစ် ပြောင်းထားသည်
                                let safeNodeId = node.replace(/\\s+/g, '-');
                                let pingEl = document.getElementById('ping-' + safeNodeId);

                                if(data.status === 'online' && data.latency_ms) {
                                    // Premium Ping Style (e.g., ((•)) 48ms )
                                    let latency = Math.round(data.latency_ms);
                                    let color = latency < 100 ? 'text-green-500' : (latency < 200 ? 'text-yellow-500' : 'text-red-500');
                                    pingEl.innerHTML = \`<span class="\${color} font-bold"><i class="fas fa-wifi text-[10px] mr-1"></i>\${latency}ms</span>\`;
                                } else {
                                    pingEl.innerHTML = '<span class="text-slate-600 font-bold text-[11px] uppercase">Offline</span>';
                                }
                            } catch(e) {
                                let safeNodeId = node.replace(/\\s+/g, '-');
                                document.getElementById('ping-' + safeNodeId).innerHTML = '<span class="text-slate-600 text-xs">Error</span>';
                            }
                        }
                    }

                    // Copy Link Function
                    function copyLink(link) { 
                        var t = document.createElement("input"); 
                        t.value = link; 
                        document.body.appendChild(t); 
                        t.select(); 
                        document.execCommand("copy"); 
                        document.body.removeChild(t); 
                        
                        var btn = document.getElementById('copyBtn'); 
                        btn.innerHTML = '<i class="fas fa-check-circle text-lg"></i> LINK COPIED!'; 
                        btn.classList.replace('bg-indigo-600', 'bg-teal-500'); 
                        btn.classList.replace('hover:bg-indigo-500', 'hover:bg-teal-400');
                        btn.classList.replace('shadow-[0_4px_14px_rgba(79,70,229,0.4)]', 'shadow-[0_4px_14px_rgba(20,184,166,0.4)]');
                        
                        setTimeout(() => { 
                            btn.innerHTML = '<i class="fas fa-link text-lg"></i> COPY SUBSCRIPTION LINK'; 
                            btn.classList.replace('bg-teal-500', 'bg-indigo-600'); 
                            btn.classList.replace('hover:bg-teal-400', 'hover:bg-indigo-500');
                            btn.classList.replace('shadow-[0_4px_14px_rgba(20,184,166,0.4)]', 'shadow-[0_4px_14px_rgba(79,70,229,0.4)]');
                        }, 3000); 
                    }

                    // Page ပွင့်ပြီး ၅၀၀ ms အကြာတွင် Ping စတင်ခေါ်မည်
                    setTimeout(fetchPings, 500);
                </script>
            </body>
            </html>
        `);
    } catch (error) { 
        res.status(500).send("System Error"); 
    }
});

// ==========================================
// 3. CHANGE SERVER LOGIC
// ==========================================
userApp.post('/panel/change-server', async (req, res) => {
    try {
        const { token, newServer } = req.body;
        const user = await User.findOne({ token: token });
        
        if (!user) return res.status(404).send("User not found");
        
        const groupInfo = await Group.findOne({ name: user.groupName });
        if (!groupInfo) return res.status(404).send("Group Error");

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
        
        try { await redisClient.del(token); } catch(e){}

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
// 4. SSCONF SUBSCRIPTION API
// ==========================================
userApp.get('/:token.json', async (req, res) => {
    try {
        const token = req.params.token;
        
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
            
            await redisClient.setEx(token, 300, JSON.stringify(rawConfig));
            return res.json(rawConfig);
        }
        res.status(404).json({ error: "Configuration Not Found" });
    } catch (error) { 
        res.status(500).json({ error: "System Error" }); 
    }
});

// ==========================================
// 5. SUPER FORGIVING AUTO-RECEIVE WEBHOOK
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

        const validGroup = await Group.findOne({ masterApiKey: apiKey });
        if (!validGroup) {
            console.log("❌ Unauthorized API Key");
            return res.status(401).json({ error: "Unauthorized" });
        }

        let successCount = 0;
        
        for (const [identifier, newConfig] of Object.entries(userKeys)) {
            const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            const user = await User.findOne({ 
                $or: [
                    { token: identifier }, 
                    { name: new RegExp('^' + escapedIdentifier + '$', 'i') } 
                ] 
            });

            if (user) {
                await User.updateOne(
                    { _id: user._id }, 
                    { $set: { [`accessKeys.${newServerName}`]: newConfig } }
                );
                
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
