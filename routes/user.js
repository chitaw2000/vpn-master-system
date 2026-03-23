// ==========================================
// 3. OUTLINE APP JSON ENDPOINT (Robust Format Handling)
// ==========================================
userApp.get('/:token.json', async (req, res) => {
    const token = req.params.token;
    try {
        // 1. Cache ထဲမှာ ရှာမည်
        const cachedKey = await redisClient.get(token);
        if (cachedKey) {
            try {
                // Cache က JSON အမှန်ဖြစ်ရင် ပြန်ပို့မည်
                return res.json(JSON.parse(cachedKey));
            } catch (parseError) {
                // Cache ထဲက အဟောင်း (ss://) တွေ ဖြစ်နေရင် Error မတက်စေဘဲ Cache ကို ဖျက်ပစ်မည်
                await redisClient.del(token);
            }
        }
        
        // 2. Cache ထဲမရှိလျှင် Database ထဲ သွားရှာမည်
        const user = await User.findOne({ token: token });
        
        if (user && user.accessKeys && user.accessKeys[user.currentServer]) {
            let rawConfig = user.accessKeys[user.currentServer];
            
            // အခြေအနေ (က) - Master Panel က String အနေနဲ့ ပို့လိုက်မိရင် JSON ပြန်ဖြည်မည်
            if (typeof rawConfig === 'string' && rawConfig.startsWith('{')) {
                try { rawConfig = JSON.parse(rawConfig); } catch(e){}
            }
            
            // အခြေအနေ (ခ) - Master Panel က အရင်လို 'ss://...' အဟောင်းကြီး ပို့နေသေးရင် Outline App လက်ခံမည့်ပုံစံ အလိုလို ပြောင်းပေးမည်
            if (typeof rawConfig === 'string' && rawConfig.startsWith('ss://')) {
                const fallbackFormat = { server: rawConfig };
                await redisClient.setEx(token, 300, JSON.stringify(fallbackFormat));
                return res.json(fallbackFormat);
            }

            // အခြေအနေ (ဂ) - JSON အမှန်ဆိုလျှင် ပုံမှန်အတိုင်း သွားမည်
            await redisClient.setEx(token, 300, JSON.stringify(rawConfig));
            return res.json(rawConfig);
        }
        
        res.status(404).json({ error: "Configuration Not Found" });
    } catch (error) { 
        // 🌟 အရေးကြီး - Error အစစ်အမှန်ကို Terminal တွင် ပြပေးမည်
        console.error("❌ JSON Endpoint Error:", error.message); 
        res.status(500).json({ error: "System Error" }); 
    }
});
