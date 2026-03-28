const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const adminApp = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const Master = require('../models/Master');

// 🌟 Exponential Backoff Retry Function
async function fetchWithRetry(url, data, config, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.post(url, data, config);
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i))); 
        }
    }
}

// ==========================================
// 1. HOME DASHBOARD
// ==========================================
adminApp.get('/', async (req, res) => {
    const groups = await Group.find({});
    const masters = await Master.find({}); 
    
    let groupsHtml = '';
    for (const g of groups) {
        const userCount = await User.countDocuments({ groupName: g.name });
        groupsHtml += `
        <div class="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center">
                <h3 class="text-lg font-bold text-white flex items-center">
                    <i class="fas fa-server text-indigo-400 mr-2"></i> ${g.name} 
                    <span class="ml-3 text-xs font-black bg-indigo-500 text-white px-2 py-1 rounded-md shadow-sm border border-indigo-400">
                        ${g.masterName || 'API-1'}
                    </span>
                </h3>
                <form action="/admin/delete-group" method="POST" onsubmit="return confirm('Group ကို ဖျက်မှာ သေချာပြီလား?');" class="m-0">
                    <input type="hidden" name="groupName" value="${g.name}">
                    <button type="submit" class="text-white hover:text-red-400 bg-white/10 hover:bg-white/20 p-2 rounded-lg transition">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </form>
            </div>
            <div class="p-5 flex-1">
                <div class="flex items-center justify-between mb-3 border-b border-slate-50 pb-3">
                    <span class="text-xs text-slate-400 font-semibold uppercase">Master IP</span>
                    <span class="text-xs font-bold text-slate-600 truncate w-32 text-right">${g.masterIp || 'N/A'}</span>
                </div>
                <div class="flex items-center justify-between mb-4">
                    <span class="text-xs text-slate-400 font-semibold uppercase">Custom DNS</span>
                    <span class="text-sm font-bold text-indigo-600 truncate max-w-[150px]">${g.nsRecord || 'N/A'}</span>
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

    let masterOptions = '<option value="" disabled selected>Select a saved Master API...</option>';
    let mastersListHtml = '';
    masters.forEach((m) => {
        masterOptions += `<option value="${m.ip}|${m.apiKey}|${m.name}">${m.name} (${m.ip})</option>`;
        mastersListHtml += `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
                <div>
                    <span class="font-bold text-slate-700 bg-slate-200 px-2 py-1 rounded text-xs mr-2">${m.name}</span> 
                    <span class="text-sm font-semibold text-slate-600">${m.ip}</span>
                </div>
                <form action="/admin/delete-master" method="POST" onsubmit="return confirm('ဖျက်မှာ သေချာလား?');" class="m-0">
                    <input type="hidden" name="id" value="${m._id}">
                    <button type="submit" class="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg">
                        <i class="fas fa-trash"></i>
                    </button>
                </form>
            </div>`;
    });

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>VPN Master Admin</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        </head>
        <body class="bg-slate-50 font-sans pb-10">
            <nav class="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white shadow-lg p-5 mb-8">
                <div class="max-w-7xl mx-auto flex items-center justify-between">
                    <div class="font-black text-2xl tracking-tight">
                        <i class="fas fa-shield-alt mr-2 text-indigo-300"></i> PROXY <span class="text-indigo-200 font-light">ADMIN</span>
                    </div>
                </div>
            </nav>

            <div class="max-w-7xl mx-auto px-4">
                
                <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-6">
                    <div class="flex-1 border-r border-slate-100 pr-0 md:pr-6">
                        <label class="block text-lg font-black text-slate-800 mb-4">
                            <i class="fas fa-key text-yellow-500 mr-2"></i> Save New Master API
                        </label>
                        <form action="/admin/add-master" method="POST" class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input type="text" name="name" placeholder="Name (e.g., API-1)" required class="border-2 p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm text-slate-800">
                            <input type="text" name="ip" placeholder="URL (http://ip:8888)" required class="border-2 p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm text-slate-800">
                            <input type="password" name="apiKey" placeholder="API Key" required class="border-2 p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm text-slate-800">
                            <button type="submit" class="md:col-span-3 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-black transition text-sm">
                                <i class="fas fa-save mr-2"></i> Save Master API
                            </button>
                        </form>
                    </div>
                    <div class="flex-1 pl-0 md:pl-2">
                        <label class="block text-sm font-black text-slate-500 mb-3 uppercase tracking-wider">Saved APIs</label>
                        <div class="max-h-32 overflow-y-auto pr-2">
                            ${mastersListHtml || '<p class="text-sm text-slate-400">No Master APIs saved yet.</p>'}
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-100 mb-10">
                    <label class="block text-lg font-black text-slate-800 mb-4">
                        <i class="fas fa-network-wired text-indigo-500 mr-2"></i> Create Group
                    </label>
                    <div class="flex flex-col md:flex-row gap-4 mb-6 pb-6 border-b border-slate-100">
                        <div class="flex-1">
                            <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Select Master API</label>
                            <select id="savedMasterSelector" class="w-full border-2 border-indigo-200 bg-indigo-50 p-3 rounded-xl outline-none focus:border-indigo-500 font-bold text-indigo-800">
                                ${masterOptions}
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button type="button" onclick="fetchGroupsFromSaved()" id="fetchBtn" class="w-full md:w-auto bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition">
                                <i class="fas fa-sync-alt mr-2"></i> Fetch Groups
                            </button>
                        </div>
                    </div>

                    <form action="/admin/create-group" method="POST" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input type="hidden" name="masterIp" id="formMasterIp">
                        <input type="hidden" name="masterApiKey" id="formMasterApiKey">
                        <input type="hidden" name="masterName" id="formMasterName">
                        
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">1. Select Group</label>
                            <select name="masterGroupId" id="masterGroupSelect" required class="w-full border-2 border-slate-200 bg-slate-50 p-3 rounded-xl outline-none focus:border-indigo-500 font-semibold text-slate-700">
                                <option value="" disabled selected>Fetch groups first...</option>
                            </select>
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
                            <button type="submit" class="w-full bg-slate-800 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-black transition">
                                <i class="fas fa-plus mr-2"></i> Create
                            </button>
                        </div>
                    </form>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    ${groupsHtml || '<p class="col-span-full text-center py-10 text-slate-500">No groups found.</p>'}
                </div>
            </div>

            <script>
                async function fetchGroupsFromSaved() {
                    const selector = document.getElementById('savedMasterSelector').value; 
                    const btn = document.getElementById('fetchBtn');
                    
                    if(!selector) return alert("Please select a Master API!");
                    
                    const [ip, key, name] = selector.split('|'); 
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Fetching...';
                    
                    try {
                        const res = await fetch('/admin/api/fetch-master-groups', { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify({ masterIp: ip, masterApiKey: key }) 
                        });
                        const data = await res.json();
                        
                        if(data.success) {
                            let options = '<option value="" disabled selected>Select from Master...</option>';
                            data.groups.forEach(g => { 
                                options += \`<option value="\${g.id}">\${g.name} (\${g.serverCount} Nodes)</option>\`; 
                            });
                            
                            document.getElementById('masterGroupSelect').innerHTML = options; 
                            document.getElementById('masterGroupSelect').classList.remove('bg-slate-50');
                            
                            document.getElementById('formMasterIp').value = ip; 
                            document.getElementById('formMasterApiKey').value = key; 
                            document.getElementById('formMasterName').value = name;
                            
                            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Connected!'; 
                            btn.classList.replace('bg-indigo-600', 'bg-green-500'); 
                            
                            setTimeout(() => { 
                                btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Fetch Groups'; 
                                btn.classList.replace('bg-green-500', 'bg-indigo-600'); 
                            }, 2000);
                        } else { 
                            alert("Failed: " + data.error); 
                            btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Fetch Groups'; 
                        }
                    } catch(e) { 
                        alert("Network Error!"); 
                        btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Fetch Groups'; 
                    }
                }
            </script>
        </body>
        </html>
    `);
});

adminApp.post('/add-master', async (req, res) => {
    try { 
        let { name, ip, apiKey } = req.body; 
        ip = ip.replace(/\/$/, ""); 
        await Master.create({ name, ip, apiKey }); 
        res.redirect('/admin'); 
    } catch (e) { 
        res.status(500).send("Error saving Master. Name might be duplicate."); 
    }
});

adminApp.post('/delete-master', async (req, res) => { 
    await Master.findByIdAndDelete(req.body.id); 
    res.redirect('/admin'); 
});

adminApp.post('/api/fetch-master-groups', async (req, res) => {
    try { 
        let { masterIp, masterApiKey } = req.body; 
        masterIp = masterIp.replace(/\/$/, ""); 
        
        const response = await fetchWithRetry(masterIp + '/api/active-groups', null, { 
            headers: { 'x-api-key': masterApiKey }, 
            timeout: 5000 
        });
        
        if (response.data && response.data.groups) { 
            res.json({ success: true, groups: response.data.groups }); 
        } else { 
            res.json({ success: false, error: "Invalid API Response" }); 
        }
    } catch (error) { 
        res.json({ success: false, error: error.message }); 
    }
});

adminApp.post('/create-group', async (req, res) => {
    try {
        const { groupName, masterGroupId, nsRecord, masterIp, masterApiKey, masterName } = req.body;
        if (groupName && masterGroupId && nsRecord && masterIp && masterApiKey) { 
            let cleanIp = masterIp.replace(/\/$/, ""); 
            await Group.create({ 
                name: groupName, 
                masterGroupId, 
                nsRecord, 
                masterIp: cleanIp, 
                masterApiKey, 
                masterName: masterName || "1" 
            }); 
        }
        res.redirect('/admin');
    } catch (error) { 
        res.status(500).send("Error creating group"); 
    }
});

adminApp.post('/delete-group', async (req, res) => {
    try {
        const groupInfo = await Group.findOne({ name: req.body.groupName }); 
        const users = await User.find({ groupName: req.body.groupName });
        
        if (groupInfo) { 
            for (const u of users) { 
                try { 
                    await fetchWithRetry(
                        groupInfo.masterIp + '/api/internal/delete-user', 
                        { username: u.name, token: u.token }, 
                        { headers: { 'x-api-key': groupInfo.masterApiKey } }
                    ); 
                } catch(e) {
                    console.log("Failed to delete user on master:", u.name);
                } 
            } 
        }
        await Group.deleteOne({ name: req.body.groupName }); 
        await User.deleteMany({ groupName: req.body.groupName }); 
        res.redirect('/admin');
    } catch (error) { 
        res.status(500).send("Error deleting group"); 
    }
});

// ==========================================
// 2. INSIDE GROUP VIEW
// ==========================================
adminApp.get('/group/:name', async (req, res) => {
    const groupName = req.params.name;
    const groupInfo = await Group.findOne({ name: groupName });
    const users = await User.find({ groupName: groupName }).sort({ userNo: 1 }); 
    const masters = await Master.find({}); 
    
    const domainName = (groupInfo && groupInfo.nsRecord) ? groupInfo.nsRecord : (process.env.VPS_IP || req.hostname);
    const panelHost = process.env.VPS_IP || req.hostname;

    let usersHtml = '';
    users.forEach((u) => {
        const ssconfLink = `ssconf://${domainName}/${u.token}.json#VPN-${encodeURIComponent(u.name.replace(/\s+/g, ''))}`;
        const webPanelLink = `http://${panelHost}/panel/${u.token}`; 
        const serverCount = u.accessKeys ? Object.keys(u.accessKeys).length : 0;
        const usagePercent = u.totalGB > 0 ? ((u.usedGB / u.totalGB) * 100).toFixed(1) : 0;

        usersHtml += `
        <tr class="border-b border-slate-50 hover:bg-indigo-50/30">
            <td class="p-4 text-slate-800 font-black">#${u.userNo || '-'}</td>
            <td class="p-4">
                <div class="font-bold text-slate-800">${u.name}</div>
                <div class="text-xs text-indigo-400 font-mono">${u.token}</div>
            </td>
            <td class="p-4">
                <span class="bg-slate-100 px-2 py-1 rounded text-xs font-bold mr-2">${serverCount} Nodes</span>
                <span class="text-sm font-semibold">${u.currentServer || 'None'}</span>
            </td>
            <td class="p-4 text-sm font-bold text-slate-600">${u.expireDate}</td>
            <td class="p-4 w-48">
                <div class="flex justify-between text-xs mb-1 font-bold">
                    <span class="text-indigo-600">${u.usedGB} GB</span>
                    <span class="text-slate-500">${u.totalGB} GB</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-1.5">
                    <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${usagePercent}%"></div>
                </div>
            </td>
            <td class="p-4 text-right flex justify-end gap-2">
                <button id="panelBtn-${u.token}" onclick="copyLink('${webPanelLink}', 'panelBtn-${u.token}', '<i class=\\'fas fa-globe\\'></i>')" class="bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition" title="Copy Web Panel Link">
                    <i class="fas fa-globe"></i>
                </button>
                <button id="btn-${u.token}" onclick="copyLink('${ssconfLink}', 'btn-${u.token}', '<i class=\\'fas fa-link\\'></i>')" class="bg-slate-100 text-slate-600 hover:bg-green-500 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition" title="Copy SSCONF Link">
                    <i class="fas fa-link"></i>
                </button>
                <form action="/admin/delete-user" method="POST" onsubmit="return confirm('ဖျက်မှာ သေချာပြီလား?');" class="m-0">
                    <input type="hidden" name="token" value="${u.token}">
                    <input type="hidden" name="groupName" value="${u.groupName}">
                    <button type="submit" class="bg-red-50 text-red-500 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </form>
            </td>
        </tr>`;
    });

    let relinkOptions = '<option value="" disabled selected>Select Master API to Re-link...</option>';
    masters.forEach(m => { 
        relinkOptions += `<option value="${m.ip}|${m.apiKey}|${m.name}">${m.name} (${m.ip})</option>`; 
    });

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Group Management</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        </head>
        <body class="bg-slate-50 font-sans pb-10">
            <nav class="bg-white border-b border-slate-200 shadow-sm p-4 mb-6">
                <div class="max-w-7xl mx-auto flex items-center justify-between">
                    <div class="flex items-center">
                        <a href="/admin" class="text-slate-400 hover:text-indigo-600 mr-4 text-xl">
                            <i class="fas fa-arrow-left"></i>
                        </a>
                        <span class="font-black text-xl">${groupName}</span>
                        <span class="ml-3 text-xs font-bold text-white bg-indigo-500 px-2 py-1 rounded shadow-sm">
                            ${groupInfo.masterName || 'API'}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                            <i class="fas fa-link text-indigo-400 mr-1"></i> ${groupInfo.masterIp || 'Not Linked'}
                        </div>
                        
                        <form action="/admin/sync-group-nodes" method="POST" class="m-0" onsubmit="this.querySelector('button').innerHTML='<i class=\\'fas fa-spinner fa-spin mr-2\\'></i> Syncing...';">
                            <input type="hidden" name="groupName" value="${groupName}">
                            <button type="submit" class="bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white px-4 py-1.5 rounded-lg text-sm font-bold transition shadow-sm border border-indigo-200 flex items-center" title="Pull latest nodes from Master">
                                <i class="fas fa-sync-alt mr-2"></i> Sync All Nodes
                            </button>
                        </form>
                    </div>
                </div>
            </nav>

            <div class="max-w-7xl mx-auto px-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="md:col-span-2 bg-white rounded-2xl shadow-sm border p-6">
                        <label class="block text-sm font-black text-slate-800 mb-4">
                            <i class="fas fa-user-plus text-green-500 mr-2"></i> Generate New Key
                        </label>
                        <form action="/admin/add-user" method="POST" class="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <input type="hidden" name="groupName" value="${groupName}">
                            <input type="text" name="name" placeholder="User Name" required class="border-2 border-slate-200 p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm">
                            <input type="number" name="totalGB" placeholder="Data (GB)" required class="border-2 border-slate-200 p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm">
                            <input type="date" name="expireDate" required class="border-2 border-slate-200 p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm text-slate-600">
                            <button type="submit" class="bg-indigo-600 text-white rounded-xl py-2.5 font-bold hover:bg-indigo-700 transition text-sm">
                                Create
                            </button>
                        </form>
                    </div>

                    <div class="bg-yellow-50 rounded-2xl shadow-sm border border-yellow-200 p-6">
                        <label class="block text-sm font-black text-yellow-800 mb-2">
                            <i class="fas fa-plug text-yellow-600 mr-2"></i> Update Connection
                        </label>
                        <form action="/admin/update-group-master" method="POST" class="flex flex-col gap-2">
                            <input type="hidden" name="groupName" value="${groupName}">
                            <select name="masterData" required class="w-full border border-yellow-300 bg-white p-2 rounded-lg outline-none font-bold text-xs text-slate-700">
                                ${relinkOptions}
                            </select>
                            <button type="submit" class="w-full bg-yellow-500 text-white rounded-lg py-2 font-bold hover:bg-yellow-600 transition text-sm">
                                Re-Link Master
                            </button>
                        </form>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-slate-100 text-xs uppercase text-slate-500">
                                <th class="p-4">ID</th>
                                <th class="p-4">User</th>
                                <th class="p-4">Node</th>
                                <th class="p-4">Expire</th>
                                <th class="p-4">Usage</th>
                                <th class="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${usersHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <script>
                function copyLink(link, btnId, origHtml) {
                    var tempInput = document.createElement("input"); 
                    tempInput.value = link; 
                    document.body.appendChild(tempInput); 
                    tempInput.select(); 
                    document.execCommand("copy"); 
                    document.body.removeChild(tempInput);
                    
                    var btn = document.getElementById(btnId); 
                    btn.innerHTML = '<i class="fas fa-check"></i>'; 
                    btn.classList.add('bg-green-500', 'text-white');
                    
                    setTimeout(() => { 
                        btn.innerHTML = origHtml; 
                        btn.classList.remove('bg-green-500', 'text-white'); 
                    }, 2000);
                }
            </script>
        </body>
        </html>
    `);
});

// 🌟🌟 NEW: MANUAL SYNC ALL NODES API 🌟🌟
adminApp.post('/sync-group-nodes', async (req, res) => {
    try {
        const groupName = req.body.groupName;
        const groupInfo = await Group.findOne({ name: groupName });
        if (!groupInfo || !groupInfo.masterIp) return res.redirect('/admin');

        const users = await User.find({ groupName: groupName });
        
        for (const user of users) {
            try {
                // Fetch the latest keys for this user from Master Panel
                const masterResponse = await fetchWithRetry(groupInfo.masterIp + '/api/generate-keys', {
                    masterGroupId: groupInfo.masterGroupId, 
                    userName: user.name, 
                    totalGB: user.totalGB, 
                    expireDate: user.expireDate
                }, { headers: { 'x-api-key': groupInfo.masterApiKey } });

                if (masterResponse.data && masterResponse.data.keys) {
                    user.accessKeys = masterResponse.data.keys;
                    
                    // If their current server was deleted, switch them to the first available node
                    if (!user.accessKeys[user.currentServer]) {
                        user.currentServer = Object.keys(user.accessKeys)[0] || "None";
                    }
                    
                    user.markModified('accessKeys');
                    await user.save();
                }
            } catch (err) {
                console.log(`❌ Failed to sync nodes for user: ${user.name}`);
            }
        }
        res.redirect('/admin/group/' + encodeURIComponent(groupName));
    } catch (error) {
        res.status(500).send("Error syncing nodes");
    }
});

adminApp.post('/update-group-master', async (req, res) => {
    try {
        const { groupName, masterData } = req.body;
        if(masterData) { 
            const [ip, apiKey, name] = masterData.split('|'); 
            await Group.updateOne({ name: groupName }, { masterIp: ip, masterApiKey: apiKey, masterName: name }); 
        }
        res.redirect('/admin/group/' + encodeURIComponent(groupName));
    } catch (e) { 
        res.status(500).send("Error updating connection"); 
    }
});

adminApp.post('/add-user', async (req, res) => {
    try {
        const { groupName, name, totalGB, expireDate } = req.body;
        const groupInfo = await Group.findOne({ name: groupName });
        
        if(!groupInfo || !groupInfo.masterIp) return res.status(400).send("Invalid Group Setup");

        const lastUser = await User.findOne({ groupName: groupName }).sort({ userNo: -1 });
        const nextNo = (lastUser && lastUser.userNo) ? lastUser.userNo + 1 : 1;

        const masterResponse = await fetchWithRetry(groupInfo.masterIp + '/api/generate-keys', {
            masterGroupId: groupInfo.masterGroupId, userName: name, totalGB, expireDate
        }, { headers: { 'x-api-key': groupInfo.masterApiKey } });

        if (masterResponse.data && masterResponse.data.keys) {
            const token = crypto.randomBytes(16).toString('hex'); 
            const defaultServer = Object.keys(masterResponse.data.keys)[0] || "None";
            await User.create({ 
                name, 
                token, 
                groupName, 
                totalGB: Number(totalGB), 
                usedGB: 0, 
                currentServer: defaultServer, 
                expireDate, 
                accessKeys: masterResponse.data.keys, 
                userNo: nextNo 
            });
            res.redirect('/admin/group/' + encodeURIComponent(groupName));
        } else { 
            res.status(400).send("Master Panel API Error"); 
        }
    } catch (error) { 
        res.status(500).send("Error connecting to Master"); 
    }
});

adminApp.post('/delete-user', async (req, res) => {
    try {
        const token = req.body.token;
        const groupInfo = await Group.findOne({ name: req.body.groupName });
        const user = await User.findOne({ token: token });
        
        if (groupInfo && user) {
            try { 
                await fetchWithRetry(
                    groupInfo.masterIp + '/api/internal/delete-user', 
                    { username: user.name, token: token },
                    { headers: { 'x-api-key': groupInfo.masterApiKey } }
                ); 
                console.log(`✅ Deleted user on Master: ${user.name}`);
            } catch(e) { 
                console.error(`❌ Master Delete Failed for ${user.name}`); 
            }
        }
        await User.deleteOne({ token: token });
        res.redirect('/admin/group/' + encodeURIComponent(req.body.groupName));
    } catch (error) { 
        res.status(500).send("Error deleting user"); 
    }
});

adminApp.post('/api/internal/sync-user-usage', async (req, res) => {
    try {
        const { name, usedGB, totalGB, expireDate, isBlocked } = req.body;
        
        if (!name) return res.status(400).json({ error: "Missing username" });

        const user = await User.findOne({ name: name });
        if (!user) {
            return res.status(404).json({ error: "User not found locally" });
        }

        if (usedGB !== undefined) user.usedGB = Number(usedGB);
        if (totalGB !== undefined) user.totalGB = Number(totalGB);
        if (expireDate !== undefined) user.expireDate = expireDate;
        
        await user.save();
        return res.json({ success: true, message: "Usage synced successfully" });
    } catch (error) { 
        console.error("Sync Webhook Error:", error.message);
        res.status(500).json({ error: "Server Error" }); 
    }
});

// Master Auto-Push Webhook (Fallback) - Token (သို့) Name ဖြင့်ရှာဖွေရန် ပြင်ဆင်ထားသည်
adminApp.post('/api/internal/sync-new-server', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        const { masterGroupId, newServerName, userKeys } = req.body;

        if (!masterGroupId || !newServerName || !userKeys) {
            return res.status(400).json({ error: "Invalid payload data" });
        }

        const validGroup = await Group.findOne({ masterGroupId: masterGroupId, masterApiKey: apiKey });
        if (!validGroup) {
            return res.status(401).json({ error: "Unauthorized API Key or Group Not Found" });
        }

        for (const [identifier, newConfig] of Object.entries(userKeys)) {
            // Master က Token အစစ်မသိလျှင် Name ဖြင့်ပါ လိုက်ရှာပေးမည်
            const user = await User.findOne({ $or: [{ token: identifier }, { name: identifier }] });
            if (user) {
                if (!user.accessKeys) user.accessKeys = {};
                
                user.accessKeys[newServerName] = newConfig;
                user.markModified('accessKeys'); 
                await user.save();
            }
        }
        return res.json({ success: true, message: "Server synced successfully" });
    } catch (error) { 
        res.status(500).json({ error: "Server Error" }); 
    }
});

module.exports = adminApp;
