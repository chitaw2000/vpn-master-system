const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const adminApp = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');

// ==========================================
// 1. HOME DASHBOARD (Premium UI)
// ==========================================
adminApp.get('/', async (req, res) => {
    const groups = await Group.find({});
    let groupsHtml = '';
    
    for (const g of groups) {
        const userCount = await User.countDocuments({ groupName: g.name });
        groupsHtml += `
        <div class="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center">
                <h3 class="text-lg font-bold text-white"><i class="fas fa-server text-indigo-400 mr-2"></i> ${g.name}</h3>
                <form action="/admin/delete-group" method="POST" onsubmit="return confirm('⚠️ သတိပေးချက်: ဒီ Group နဲ့ အထဲက User တွေအကုန်လုံးကို ဖျက်မှာ သေချာပြီလား?');" class="m-0">
                    <input type="hidden" name="groupName" value="${g.name}">
                    <button type="submit" class="text-white hover:text-red-400 bg-white/10 hover:bg-white/20 p-2 rounded-lg transition" title="Delete Group">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </form>
            </div>
            <div class="p-5 flex-1">
                <div class="flex items-center justify-between mb-3 border-b border-slate-50 pb-3">
                    <span class="text-xs text-slate-400 font-semibold uppercase">Master ID</span>
                    <span class="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">${g.masterGroupId}</span>
                </div>
                <div class="flex items-center justify-between mb-4">
                    <span class="text-xs text-slate-400 font-semibold uppercase">Custom DNS</span>
                    <span class="text-sm font-bold text-indigo-600 truncate max-w-[150px]" title="${g.nsRecord}">${g.nsRecord || 'N/A'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-slate-400 font-semibold uppercase">Active Users</span>
                    <span class="text-xl font-black text-slate-800">${userCount}</span>
                </div>
            </div>
            <div class="p-4 bg-slate-50 border-t border-slate-100">
                <a href="/admin/group/${encodeURIComponent(g.name)}" class="flex items-center justify-center w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-md transition">
                    Manage Group <i class="fas fa-arrow-right ml-2"></i>
                </a>
            </div>
        </div>`;
    }

    let masterGroupsDropdown = '';
    try {
        const response = await axios.get('http://168.144.33.53:8888/api/active-groups', { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' }, timeout: 5000 });
        if (response.data && response.data.groups) {
            response.data.groups.forEach(mg => { masterGroupsDropdown += `<option value="${mg.id}">${mg.name} (${mg.serverCount} Nodes)</option>`; });
        }
    } catch (error) { masterGroupsDropdown = `<option value="" disabled>Error: Master Panel Connection Failed</option>`; }

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-slate-50 font-sans pb-10">
            <nav class="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white shadow-lg p-5 mb-8">
                <div class="max-w-7xl mx-auto font-black text-2xl tracking-tight"><i class="fas fa-shield-alt mr-2 text-indigo-300"></i> PROXY <span class="text-indigo-200 font-light">ADMIN</span></div>
            </nav>
            <div class="max-w-7xl mx-auto px-4">
                <div class="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-100 mb-10">
                    <label class="block text-lg font-black text-slate-800 mb-4 flex items-center"><i class="fas fa-layer-group text-indigo-500 mr-2"></i> Create New Group</label>
                    <form action="/admin/create-group" method="POST" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">1. Master Group</label>
                            <select name="masterGroupId" required class="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 font-semibold text-slate-700"><option value="" disabled selected>Select from Master...</option>${masterGroupsDropdown}</select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">2. Local Name</label>
                            <input type="text" name="groupName" placeholder="e.g. VIP Gaming" required class="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-800">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">3. Custom DNS</label>
                            <input type="text" name="nsRecord" placeholder="e.g. ns1.yourdomain.com" required class="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 font-bold text-indigo-700">
                        </div>
                        <div class="flex items-end">
                            <button type="submit" class="w-full bg-slate-800 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-black transition"><i class="fas fa-plus-circle mr-2"></i> Create</button>
                        </div>
                    </form>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">${groupsHtml || `<p class="col-span-full text-center py-10 text-slate-500">No groups found.</p>`}</div>
            </div>
        </body></html>
    `);
});

adminApp.post('/create-group', async (req, res) => {
    try {
        if (req.body.groupName && req.body.masterGroupId && req.body.nsRecord) {
            await Group.create({ name: req.body.groupName, masterGroupId: req.body.masterGroupId, nsRecord: req.body.nsRecord });
        }
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error creating group"); }
});

adminApp.post('/delete-group', async (req, res) => {
    try {
        // Group ဖျက်လျှင် အထဲက User တွေကို Master ဆီမှာပါ လိုက်ဖျက်မည်
        const users = await User.find({ groupName: req.body.groupName });
        for (const u of users) {
            try { await axios.post('http://168.144.33.53:8888/api/user-action', { token: u.token, action: "delete" }, { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' } }); } catch(e){}
        }
        await Group.deleteOne({ name: req.body.groupName });
        await User.deleteMany({ groupName: req.body.groupName });
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error deleting group"); }
});

// ==========================================
// 2. INSIDE GROUP VIEW
// ==========================================
adminApp.get('/group/:name', async (req, res) => {
    const groupName = req.params.name;
    const groupInfo = await Group.findOne({ name: groupName });
    const users = await User.find({ groupName: groupName });
    
    const domainName = (groupInfo && groupInfo.nsRecord) ? groupInfo.nsRecord : process.env.VPS_IP;
    const currentHost = req.get('host'); // ဆာဗာရဲ့ လက်ရှိ Domain/IP

    let usersHtml = '';
    users.forEach((u, index) => {
        // 🌟 Link ၂ မျိုး (SSCONF အတွက် နှင့် User ဝင်ရမည့် Web Panel အတွက်)
        const ssconfLink = `ssconf://${domainName}/${u.token}.json#VPN-${encodeURIComponent(u.name.replace(/\s+/g, ''))}`;
        const webPanelLink = `http://${currentHost}/panel/${u.token}`; 
        
        const serverCount = u.accessKeys ? Object.keys(u.accessKeys).length : 0;
        const usagePercent = u.totalGB > 0 ? ((u.usedGB / u.totalGB) * 100).toFixed(1) : 0;

        usersHtml += `
        <tr class="border-b border-slate-50 hover:bg-indigo-50/30">
            <td class="p-4 text-slate-400 font-bold">${index + 1}</td>
            <td class="p-4"><div class="font-bold text-slate-800">${u.name}</div><div class="text-xs text-indigo-400 font-mono">${u.token}</div></td>
            <td class="p-4"><span class="bg-slate-100 px-2 py-1 rounded text-xs font-bold mr-2">${serverCount} Nodes</span><span class="text-sm font-semibold">${u.currentServer || 'None'}</span></td>
            <td class="p-4 text-sm font-bold text-slate-600">${u.expireDate}</td>
            <td class="p-4 w-48"><div class="flex justify-between text-xs mb-1 font-bold"><span>${u.usedGB} GB</span><span>${u.totalGB} GB</span></div><div class="w-full bg-slate-100 rounded-full h-1.5"><div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${usagePercent}%"></div></div></td>
            <td class="p-4 text-right flex justify-end gap-2">
                
                <button id="panelBtn-${u.token}" onclick="copyLink('${webPanelLink}', 'panelBtn-${u.token}', '<i class=\\'fas fa-globe\\'></i>')" class="bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition" title="Copy User Panel Link">
                    <i class="fas fa-globe"></i>
                </button>

                <button id="btn-${u.token}" onclick="copyLink('${ssconfLink}', 'btn-${u.token}', '<i class=\\'fas fa-link\\'></i>')" class="bg-slate-100 text-slate-600 hover:bg-green-500 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition" title="Copy SSCONF Link">
                    <i class="fas fa-link"></i>
                </button>
                
                <form action="/admin/delete-user" method="POST" onsubmit="return confirm('ဖျက်မှာ သေချာပြီလား? Master Panel မှာပါ ပျက်သွားပါမည်။');" class="m-0">
                    <input type="hidden" name="token" value="${u.token}"><input type="hidden" name="groupName" value="${u.groupName}">
                    <button type="submit" class="bg-red-50 text-red-500 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition"><i class="fas fa-trash"></i></button>
                </form>
            </td>
        </tr>`;
    });

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-slate-50 font-sans pb-10">
            <nav class="bg-white border-b border-slate-200 shadow-sm p-4 mb-8">
                <div class="max-w-7xl mx-auto flex items-center"><a href="/admin" class="text-slate-400 hover:text-indigo-600 mr-4 text-xl"><i class="fas fa-arrow-left"></i></a><span class="font-black text-xl">${groupName}</span><span class="ml-3 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">DNS: ${domainName}</span></div>
            </nav>
            <div class="max-w-7xl mx-auto px-4">
                <div class="bg-white rounded-2xl shadow-sm border p-6 mb-8">
                    <form action="/admin/add-user" method="POST" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input type="hidden" name="groupName" value="${groupName}">
                        <input type="text" name="name" placeholder="User Name" required class="border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 font-bold">
                        <input type="number" name="totalGB" placeholder="Data Limit (GB)" required class="border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 font-bold">
                        <input type="date" name="expireDate" required class="border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-600">
                        <button type="submit" class="bg-indigo-600 text-white rounded-xl py-3 font-bold hover:bg-indigo-700 transition">Generate Key</button>
                    </form>
                </div>
                <div class="bg-white rounded-2xl shadow-sm border overflow-hidden"><table class="w-full text-left"><thead><tr class="bg-slate-100 text-xs uppercase text-slate-500"><th class="p-4">No</th><th class="p-4">User</th><th class="p-4">Node</th><th class="p-4">Expire</th><th class="p-4">Usage</th><th class="p-4 text-right">Actions</th></tr></thead><tbody>${usersHtml}</tbody></table></div>
            </div>
            <script>
                function copyLink(link, btnId, origHtml) {
                    var tempInput = document.createElement("input"); tempInput.value = link; document.body.appendChild(tempInput); tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput);
                    var btn = document.getElementById(btnId); btn.innerHTML = '<i class="fas fa-check"></i>'; btn.classList.add('bg-green-500', 'text-white');
                    setTimeout(() => { btn.innerHTML = origHtml; btn.classList.remove('bg-green-500', 'text-white'); }, 2000);
                }
            </script>
        </body></html>
    `);
});

// ==========================================
// 3. API ENDPOINTS (Add, Delete, Webhook)
// ==========================================
adminApp.post('/add-user', async (req, res) => {
    try {
        const { groupName, name, totalGB, expireDate } = req.body;
        const groupInfo = await Group.findOne({ name: groupName });
        
        const masterResponse = await axios.post('http://168.144.33.53:8888/api/generate-keys', {
            masterGroupId: groupInfo.masterGroupId, userName: name, totalGB, expireDate
        }, { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' } });

        if (masterResponse.data && masterResponse.data.keys) {
            const token = crypto.randomBytes(16).toString('hex'); 
            const defaultServer = Object.keys(masterResponse.data.keys)[0] || "None";
            await User.create({ name, token, groupName, totalGB: Number(totalGB), usedGB: 0, currentServer: defaultServer, expireDate, accessKeys: masterResponse.data.keys });
            res.redirect('/admin/group/' + encodeURIComponent(groupName));
        } else { res.status(400).send("Master Panel API Error"); }
    } catch (error) { res.status(500).send("Error connecting to Master"); }
});

adminApp.post('/delete-user', async (req, res) => {
    try {
        const token = req.body.token;

        // 🌟 ၁။ Master Panel ဘက်မှာ အရင်သွားဖျက်မည် (API Integration)
        try {
            await axios.post('http://168.144.33.53:8888/api/user-action', { 
                token: token, 
                action: "delete" 
            }, { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' } });
        } catch(e) { console.log("Master Panel Delete API Failed"); }

        // ၂။ Local DB မှာ ဖျက်မည်
        await User.deleteOne({ token: token });
        res.redirect('/admin/group/' + encodeURIComponent(req.body.groupName));
    } catch (error) { res.status(500).send("Error deleting user"); }
});

// ==========================================
// 🌟 4. RECEIVE GB FROM MASTER PANEL (WEBHOOK)
// ==========================================
// Master Panel က ဒီလမ်းကြောင်းကို လှမ်းပြီး POST လုပ်ပါလိမ့်မယ်
adminApp.post('/api/receive-gb', async (req, res) => {
    try {
        // Master ဆီကလာတဲ့ API Key ကို စစ်ဆေးရန်
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== 'My_Super_Secret_VPN_Key_2026') {
            return res.status(401).json({ error: "Unauthorized API Key" });
        }

        const { token, usedGB } = req.body;
        if (!token || usedGB === undefined) {
            return res.status(400).json({ error: "Missing token or usedGB" });
        }

        const user = await User.findOne({ token: token });
        if (user) {
            user.usedGB = Number(usedGB);
            await user.save();
            return res.json({ success: true, message: "GB Updated in Sub-Panel Successfully" });
        } else {
            return res.status(404).json({ error: "User token not found in Sub-Panel" });
        }
    } catch (error) { 
        res.status(500).json({ error: "Server Error" }); 
    }
});

module.exports = adminApp;
