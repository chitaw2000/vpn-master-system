const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const adminApp = express.Router();
const Group = require('../models/Group');
const Server = require('../models/Server');
const User = require('../models/User');
const authenticateAPI = require('../middlewares/auth');
require('dotenv').config();

// ==========================================
// 1. HOME DASHBOARD
// ==========================================
adminApp.get('/', async (req, res) => {
    const groups = await Group.find({});
    let groupsHtml = '';
    
    for (const g of groups) {
        const userCount = await User.countDocuments({ groupName: g.name });
        groupsHtml += `
        <div class="bg-white rounded-xl shadow-sm border p-6 flex flex-col justify-between hover:shadow-md transition">
            <div>
                <h3 class="text-xl font-bold text-gray-800 mb-2"><i class="fas fa-link text-indigo-500 mr-2"></i> ${g.name}</h3>
                <p class="text-xs text-gray-400 mb-1">Master ID: <b class="text-gray-600">${g.masterGroupId}</b></p>
                <p class="text-xs text-gray-400 mb-3">NS Record: <b class="text-indigo-600">${g.nsRecord || 'N/A'}</b></p>
                <p class="text-sm text-gray-500 mb-4">Users: <b>${userCount}</b></p>
            </div>
            <a href="/admin/group/${encodeURIComponent(g.name)}" class="text-center w-full bg-indigo-50 text-indigo-700 font-bold py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition">ဝင်ရောက်မည် <i class="fas fa-arrow-right ml-1"></i></a>
        </div>`;
    }

    let masterGroupsDropdown = '';
    try {
        const response = await axios.get('http://178.128.55.202:8888/api/active-groups', {
            headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' },
            timeout: 5000 
        });

        if (response.data && response.data.groups) {
            response.data.groups.forEach(mg => {
                masterGroupsDropdown += `<option value="${mg.id}">${mg.name} (${mg.serverCount} Nodes)</option>`;
            });
        }
    } catch (error) {
        masterGroupsDropdown = `<option value="" disabled>Master Panel ချိတ်ဆက်မှု နှောင့်နှေးနေပါသည်</option>`;
    }

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-gray-50 font-sans pb-10">
            <nav class="bg-indigo-700 text-white shadow-md p-4 mb-8"><div class="max-w-6xl mx-auto font-bold text-xl"><i class="fas fa-shield-alt mr-2"></i> VPN Admin Panel</div></nav>
            <div class="max-w-6xl mx-auto px-4">
                
                <div class="bg-white p-5 rounded-xl shadow-sm border mb-8 flex gap-4 items-end">
                    <div class="flex-1">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Create & Map New Group</label>
                        <form action="/admin/create-group" method="POST" class="flex flex-wrap gap-4">
                            <select name="masterGroupId" required class="w-full md:w-1/4 border p-3 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-indigo-500 text-sm">
                                <option value="" disabled selected>Master Panel မှ Group ရွေးပါ...</option>
                                ${masterGroupsDropdown}
                            </select>
                            
                            <input type="text" name="nsRecord" placeholder="NS Record (e.g. ns.allsimmaha.me)" required class="w-full md:w-1/4 border p-3 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-indigo-500 text-sm">
                            
                            <input type="text" name="groupName" placeholder="Local Group Name..." required class="flex-1 border p-3 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-indigo-500 text-sm">
                            <button type="submit" class="bg-green-600 text-white px-6 py-3 rounded-lg font-bold shadow-sm"><i class="fas fa-plus mr-2"></i> Create</button>
                        </form>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${groupsHtml || '<p class="text-gray-400">Group မရှိသေးပါ။ အသစ်တည်ဆောက်ပါ။</p>'}</div>
            </div>
        </body></html>
    `);
});

adminApp.post('/create-group', async (req, res) => {
    try {
        if (req.body.groupName && req.body.masterGroupId && req.body.nsRecord) {
            // Group ဆောက်တဲ့အခါ nsRecord ကိုပါ Database ထဲ သိမ်းမည်
            await Group.create({ 
                name: req.body.groupName, 
                masterGroupId: req.body.masterGroupId,
                nsRecord: req.body.nsRecord
            });
        }
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error creating group"); }
});

// ==========================================
// 2. INSIDE GROUP VIEW
// ==========================================
adminApp.get('/group/:name', async (req, res) => {
    const groupName = req.params.name;
    const groupInfo = await Group.findOne({ name: groupName });
    const users = await User.find({ groupName: groupName });

    // 🌟 ဒီ Group ရဲ့ ကိုယ်ပိုင် NS Record ကို ယူမည် (မရှိရင် default IP သုံးမည်)
    const domainName = (groupInfo && groupInfo.nsRecord) ? groupInfo.nsRecord : process.env.VPS_IP;

    let usersHtml = '';
    users.forEach((u, index) => {
        // ssconf လင့်ခ်တွင် Group ၏ ကိုယ်ပိုင် NS ကို အလိုလို ထည့်ပေးသွားမည်
        const link = `ssconf://${domainName}/${u.token}.json#VPN-${encodeURIComponent(u.name.replace(/\s+/g, ''))}`;
        const serverCount = u.accessKeys ? Object.keys(u.accessKeys).length : 0;

        usersHtml += `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-gray-500 font-bold">${index + 1}</td>
            <td class="p-4"><div class="font-bold text-gray-800 text-base">${u.name}</div><div class="text-xs text-indigo-500 font-mono">Token: ${u.token}</div></td>
            <td class="p-4 text-sm font-semibold text-gray-600"><span class="bg-gray-200 px-2 py-1 rounded text-xs">${serverCount} Nodes</span><br>${u.currentServer || 'None'}</td>
            <td class="p-4 text-sm text-red-500 font-semibold"><i class="far fa-clock mr-1"></i> ${u.expireDate}</td>
            <td class="p-4 font-bold text-gray-700">${u.usedGB} / ${u.totalGB} GB</td>
            <td class="p-4 text-right flex justify-end gap-2">
                <button id="btn-${u.token}" onclick="copyLink('${link}', 'btn-${u.token}')" class="bg-gray-800 text-white hover:bg-black px-3 py-2 rounded-lg text-xs font-bold transition"><i class="fas fa-copy"></i></button>
                <form action="/admin/delete-user" method="POST" onsubmit="return confirm('ဖျက်မှာ သေချာပြီလား?');">
                    <input type="hidden" name="token" value="${u.token}">
                    <input type="hidden" name="groupName" value="${u.groupName}">
                    <button type="submit" class="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition border border-red-200"><i class="fas fa-trash"></i></button>
                </form>
            </td>
        </tr>`;
    });

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-gray-50 font-sans pb-10">
            <nav class="bg-indigo-700 text-white shadow-md p-4 mb-6"><div class="max-w-6xl mx-auto flex items-center"><a href="/admin" class="hover:text-gray-300 mr-4 text-xl"><i class="fas fa-arrow-left"></i></a><span class="font-bold text-xl">${groupName} Management</span></div></nav>
            <div class="max-w-6xl mx-auto px-4">
                <div class="bg-white rounded-xl shadow-sm border p-6 mb-8">
                    <h2 class="font-bold text-gray-800 mb-4 text-lg"><i class="fas fa-bolt text-yellow-500 mr-2"></i> Request Key from Master Panel</h2>
                    <form action="/admin/add-user" method="POST" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <input type="hidden" name="groupName" value="${groupName}">
                        <input type="text" name="name" placeholder="User Name / Note" required class="col-span-2 lg:col-span-1 border p-3 rounded-lg bg-gray-50 outline-none">
                        <input type="number" name="totalGB" placeholder="Data Limit (GB)" required class="border p-3 rounded-lg bg-gray-50 outline-none">
                        <input type="date" name="expireDate" required class="border p-3 rounded-lg bg-gray-50 outline-none text-gray-500">
                        <button type="submit" class="col-span-2 lg:col-span-1 bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-sm w-full"><i class="fas fa-cloud-download-alt mr-2"></i> Request Key</button>
                    </form>
                </div>
                
                <div class="bg-white rounded-xl shadow-sm border overflow-hidden"><div class="p-5 border-b bg-gray-50"><h2 class="text-xl font-bold text-gray-800">Generated Keys List</h2></div>
                <div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="bg-gray-100 text-xs uppercase text-gray-500"><th class="p-4 w-10">No</th><th class="p-4">User</th><th class="p-4">Active Node</th><th class="p-4">Expire</th><th class="p-4">Usage</th><th class="p-4 text-right">Action</th></tr></thead><tbody>${usersHtml}</tbody></table></div></div>
            </div>
            <script>
                function copyLink(link, btnId) {
                    var tempInput = document.createElement("input"); tempInput.value = link; document.body.appendChild(tempInput); tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput);
                    var btn = document.getElementById(btnId); var orig = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i>'; btn.classList.replace('bg-gray-800', 'bg-green-600');
                    setTimeout(() => { btn.innerHTML = orig; btn.classList.replace('bg-green-600', 'bg-gray-800'); }, 3000);
                }
            </script>
        </body></html>
    `);
});

// ==========================================
// 3. GENERATE KEY & OTHER APIS
// ==========================================
adminApp.post('/add-user', async (req, res) => {
    try {
        const { groupName, name, totalGB, expireDate } = req.body;
        const groupInfo = await Group.findOne({ name: groupName });
        if (!groupInfo) return res.status(404).send("Group not found");

        const masterApiUrl = 'http://178.128.55.202:8888/api/generate-keys'; 
        const masterResponse = await axios.post(masterApiUrl, {
            masterGroupId: groupInfo.masterGroupId,
            userName: name,
            totalGB: totalGB,
            expireDate: expireDate
        }, { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' } });

        if (masterResponse.data && masterResponse.data.keys) {
            const keysFromMaster = masterResponse.data.keys;
            const token = crypto.randomBytes(16).toString('hex'); 
            const availableServers = Object.keys(keysFromMaster);
            const defaultServer = availableServers.length > 0 ? availableServers[0] : "None";

            await User.create({ 
                name, token, groupName, 
                totalGB: Number(totalGB), usedGB: 0, 
                currentServer: defaultServer, expireDate, 
                accessKeys: keysFromMaster
            });
            res.redirect('/admin/group/' + encodeURIComponent(groupName));
        } else {
            res.status(400).send("Master Panel မှ Key ပြန်မချပေးပါ။");
        }
    } catch (error) { 
        res.status(500).send("Master Panel နှင့် ချိတ်ဆက်၍ မရပါ။"); 
    }
});

adminApp.post('/delete-user', async (req, res) => {
    try {
        await User.deleteOne({ token: req.body.token });
        res.redirect('/admin/group/' + encodeURIComponent(req.body.groupName));
    } catch (error) { res.status(500).send("Error deleting user"); }
});

adminApp.post('/sync-new-server', authenticateAPI, async (req, res) => {
    try {
        const { masterGroupId, newServerName, userKeys } = req.body;
        if (!masterGroupId || !newServerName || !userKeys) return res.status(400).json({ error: "Missing data" });

        for (const [token, newOutlineKey] of Object.entries(userKeys)) {
            const user = await User.findOne({ token: token });
            if (user) {
                user.accessKeys = { ...user.accessKeys, [newServerName]: newOutlineKey };
                user.markModified('accessKeys'); 
                await user.save();
                await require('../config/redis').del(token); 
            }
        }
        res.json({ success: true, message: `Server ${newServerName} synced.` });
    } catch (error) { res.status(500).json({ error: "Server Error" }); }
});

adminApp.post('/update-gb-api', authenticateAPI, async (req, res) => {
    try {
        const { token, usedGB } = req.body;
        if (!token || usedGB === undefined) return res.status(400).json({ error: "Required fields missing" });

        const user = await User.findOne({ token: token });
        if (!user) return res.status(404).json({ error: "User not found" });

        user.usedGB = Number(usedGB);
        await user.save();

        if (user.usedGB >= user.totalGB) {
            try {
                await axios.post('http://178.128.55.202:8888/api/user-action', {
                    token: token, action: "suspend"
                }, { headers: { 'x-api-key': 'My_Super_Secret_VPN_Key_2026' } });
            } catch (err) { console.error("Master သို့ ပိတ်ရန် အကြောင်းကြား၍ မရပါ။"); }
        }
        res.json({ success: true, message: "GB updated" });
    } catch (error) { res.status(500).json({ error: "Database Error" }); }
});

module.exports = adminApp;
