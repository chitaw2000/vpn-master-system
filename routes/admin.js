const express = require('express');
const crypto = require('crypto');
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
        const serverCount = await Server.countDocuments({ groupName: g.name });
        groupsHtml += `
        <div class="bg-white rounded-xl shadow-sm border p-6 flex flex-col justify-between hover:shadow-md transition">
            <div>
                <h3 class="text-xl font-bold text-gray-800 mb-2"><i class="fas fa-folder-open text-indigo-500 mr-2"></i> ${g.name}</h3>
                <p class="text-sm text-gray-500 mb-4">Servers: <b>${serverCount}</b> | Users: <b>${userCount}</b></p>
            </div>
            <a href="/admin/group/${encodeURIComponent(g.name)}" class="text-center w-full bg-indigo-50 text-indigo-700 font-bold py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition">ဝင်ရောက်မည် <i class="fas fa-arrow-right ml-1"></i></a>
        </div>`;
    }

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-gray-50 font-sans pb-10">
            <nav class="bg-indigo-700 text-white shadow-md p-4 mb-8"><div class="max-w-6xl mx-auto font-bold text-xl"><i class="fas fa-shield-alt mr-2"></i> VPN Admin Panel</div></nav>
            <div class="max-w-6xl mx-auto px-4">
                <div class="bg-white p-5 rounded-xl shadow-sm border mb-8 flex gap-4 items-end">
                    <div class="flex-1">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Create New Group</label>
                        <form action="/admin/create-group" method="POST" class="flex gap-4">
                            <input type="text" name="groupName" placeholder="Group Name..." required class="flex-1 border p-3 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-indigo-500">
                            <button type="submit" class="bg-green-600 text-white px-6 py-3 rounded-lg font-bold shadow-sm"><i class="fas fa-plus mr-2"></i> Create Group</button>
                        </form>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${groupsHtml || '<p class="text-gray-400">Group မရှိသေးပါ။</p>'}</div>
            </div>
        </body></html>
    `);
});

adminApp.post('/create-group', async (req, res) => {
    try {
        if (req.body.groupName) await Group.create({ name: req.body.groupName });
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error creating group"); }
});

// ==========================================
// 2. INSIDE GROUP VIEW
// ==========================================
adminApp.get('/group/:name', async (req, res) => {
    const groupName = req.params.name;
    const servers = await Server.find({ groupName: groupName });
    const users = await User.find({ groupName: groupName });

    let serversHtml = '';
    servers.forEach(s => {
        serversHtml += `<div class="bg-gray-100 px-4 py-2 rounded-lg mb-2 flex justify-between"><span class="font-bold text-gray-700">${s.serverName}</span><code class="text-xs text-gray-500 truncate w-32">${s.serverKey}</code></div>`;
    });

    let usersHtml = '';
    users.forEach((u, index) => {
        const link = `ssconf://${process.env.VPS_IP}:${process.env.USER_PORT}/${u.token}.json#VPN-${encodeURIComponent(u.name.replace(/\s+/g, ''))}`;
        usersHtml += `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-gray-500 font-bold">${index + 1}</td>
            <td class="p-4"><div class="font-bold text-gray-800 text-base">${u.name}</div><div class="text-xs text-indigo-500 font-mono">Token: ${u.token}</div></td>
            <td class="p-4 text-sm font-semibold text-gray-600">${u.currentServer || 'None'}</td>
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
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6"><h2 class="font-bold text-gray-800 mb-4"><i class="fas fa-key text-yellow-500 mr-2"></i> Create User (Manual)</h2>
                        <form action="/admin/add-user" method="POST" class="grid grid-cols-2 gap-4">
                            <input type="hidden" name="groupName" value="${groupName}">
                            <div class="col-span-2"><input type="text" name="name" placeholder="User Name" required class="w-full border p-3 rounded-lg bg-gray-50 outline-none"></div>
                            <input type="number" name="totalGB" placeholder="Data Limit (GB)" required class="border p-3 rounded-lg bg-gray-50 outline-none">
                            <input type="date" name="expireDate" required class="border p-3 rounded-lg bg-gray-50 outline-none">
                            <div class="col-span-2 mt-2"><button type="submit" class="w-full bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700">Generate Key</button></div>
                        </form>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm border p-6"><h2 class="font-bold text-gray-800 mb-4"><i class="fas fa-server mr-2"></i> Add Node</h2>
                        <form action="/admin/add-server" method="POST" class="space-y-3 mb-6">
                            <input type="hidden" name="groupName" value="${groupName}">
                            <input type="text" name="serverName" placeholder="Node Name" required class="w-full border p-2 rounded-lg bg-gray-50 text-sm">
                            <input type="text" name="serverKey" placeholder="ss://..." required class="w-full border p-2 rounded-lg bg-gray-50 text-sm">
                            <button type="submit" class="w-full bg-gray-200 text-gray-800 p-2 rounded-lg font-bold hover:bg-gray-300 text-sm">Add Server</button>
                        </form>
                        <hr class="mb-4"><div class="max-h-32 overflow-y-auto">${serversHtml}</div>
                    </div>
                </div>
                <div class="bg-white rounded-xl shadow-sm border overflow-hidden"><div class="p-5 border-b bg-gray-50"><h2 class="text-xl font-bold text-gray-800">Key List</h2></div>
                <div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="bg-gray-100 text-xs uppercase text-gray-500"><th class="p-4 w-10">No</th><th class="p-4">User</th><th class="p-4">Node</th><th class="p-4">Expire</th><th class="p-4">Usage</th><th class="p-4 text-right">Action</th></tr></thead><tbody>${usersHtml}</tbody></table></div></div>
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

adminApp.post('/add-server', async (req, res) => {
    try {
        const { groupName, serverName, serverKey } = req.body;
        if (groupName && serverName && serverKey) await Server.create({ groupName, serverName, serverKey });
        res.redirect('/admin/group/' + encodeURIComponent(groupName));
    } catch (error) { res.status(500).send("Error adding server"); }
});

adminApp.post('/add-user', async (req, res) => {
    try {
        const { groupName, name, totalGB, expireDate } = req.body;
        const firstServer = await Server.findOne({ groupName: groupName });
        const defaultServer = firstServer ? firstServer.serverName : "None";
        const token = crypto.randomBytes(16).toString('hex'); 
        
        if (name && totalGB && expireDate) {
            await User.create({ name, token, groupName, totalGB: Number(totalGB), usedGB: 0, currentServer: defaultServer, expireDate, accessKeys: {} });
        }
        res.redirect('/admin/group/' + encodeURIComponent(groupName));
    } catch (error) { res.status(500).send("Error generating user key"); }
});

adminApp.post('/delete-user', async (req, res) => {
    try {
        await User.deleteOne({ token: req.body.token });
        res.redirect('/admin/group/' + encodeURIComponent(req.body.groupName));
    } catch (error) { res.status(500).send("Error deleting user"); }
});

// ==========================================
// 3. MASTER PANEL APIs
// ==========================================

// Master မှ Key ၅ ခုလုံးကို တစ်ခါတည်း လှမ်းပို့မည့် API
adminApp.post('/sync-user-api', authenticateAPI, async (req, res) => {
    try {
        const { name, groupName, totalGB, expireDate, keys } = req.body;
        if (!name || !keys || Object.keys(keys).length === 0) return res.status(400).json({ error: "Missing data or keys" });

        const groupExists = await Group.findOne({ name: groupName });
        if (!groupExists) await Group.create({ name: groupName });

        const token = crypto.randomBytes(16).toString('hex'); 
        const availableServers = Object.keys(keys);
        const defaultServer = availableServers[0];

        await User.create({ name, token, groupName, totalGB: Number(totalGB), usedGB: 0, currentServer: defaultServer, expireDate, accessKeys: keys });

        const ssconfLink = `ssconf://${process.env.VPS_IP}:${process.env.USER_PORT}/${token}.json#VPN-${encodeURIComponent(name.replace(/\s+/g, ''))}`;
        res.json({ success: true, message: "Synced successfully", token: token, ssconf_link: ssconfLink });
    } catch (error) { res.status(500).json({ error: "Server Error" }); }
});

// Master မှ GB Update လာလုပ်မည့် API
adminApp.post('/update-gb-api', authenticateAPI, async (req, res) => {
    try {
        const { token, usedGB } = req.body;
        if (!token || usedGB === undefined) return res.status(400).json({ error: "Required fields missing" });

        const user = await User.findOneAndUpdate({ token: token }, { usedGB: Number(usedGB) });
        if (user) res.json({ success: true, message: "GB updated" });
        else res.status(404).json({ error: "User not found" });
    } catch (error) { res.status(500).json({ error: "Database Error" }); }
});

// မဖြစ်မနေ လိုအပ်သော အောက်ဆုံးလိုင်း (EXPORTS)
module.exports = adminApp;
