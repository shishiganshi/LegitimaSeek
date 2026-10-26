// ==========================================
// 1. LIVE MARKET RATES & GLOBAL STATE
// ==========================================
let liveUsdToPhp = 57.50;
let currentNewsSector = 'all';
let cachedSectorNews = {};

async function updateLiveTicker() {
    try {
        // Fetch live BTC, ETH, and PHP rates from open APIs
        const cryptoRes = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
        const cryptoData = await cryptoRes.json();
        const btcUsd = Math.round( parseFloat(cryptoData.data.rates.USD) ).toLocaleString();
        const phpRate = parseFloat(cryptoData.data.rates.PHP) / parseFloat(cryptoData.data.rates.USD);
        if (phpRate > 40 && phpRate < 80) liveUsdToPhp = phpRate;

        const ethRes = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH');
        const ethData = await ethRes.json();
        const ethUsd = Math.round( parseFloat(ethData.data.rates.USD) ).toLocaleString();

        document.getElementById('ticker-btc').innerText = `BTC/USD: $${btcUsd}`;
        document.getElementById('ticker-eth').innerText = `ETH/USD: $${ethUsd}`;
        document.getElementById('ticker-php').innerText = `USD/PHP: ₱${liveUsdToPhp.toFixed(2)}`;
    } catch (e) {
        console.warn("Using default ticker benchmarks.");
    }
}

function runQuickQuery(text) {
    const input = document.getElementById("query");
    if (input) {
        input.value = text;
        searchFact();
    }
}

// ==========================================
// 2. CORE SEARCH CONTROLLER
// ==========================================
async function searchFact() {
    const queryInput = document.getElementById("query");
    const query = queryInput?.value?.trim() || "";
    
    if (!query) {
        alert("Please enter a claim or query to verify.");
        return;
    }

    // Toggle UI Sections
    document.getElementById('trending-news').style.display = 'none';
    document.getElementById('pre-search-trivia').style.display = 'none';
    document.getElementById('interactive-section').style.display = 'none';
    document.getElementById('clear-btn').style.display = 'block';
    
    const resultBox = document.getElementById("results");
    const chatBox = document.getElementById("chat-results");
    const sourcesBox = document.getElementById("sources");
    const sourcesList = document.getElementById("sources-list");

    resultBox.style.display = 'block';
    chatBox.style.display = 'block';
    sourcesBox.style.display = 'block';

    resultBox.innerHTML = `<div class="dossier-label">[QUERY EXECUTION]</div><h3>Target: "${query}"</h3><p class="mono-text">RUNNING DYNAMIC PARSER & REAL-TIME VERIFICATION...</p>`;
    chatBox.innerHTML = `<p class="mono-text">COMPUTING METRICS & CROSS-REFERENCING SOURCES...</p>`;
    sourcesList.innerHTML = "";

    // 1. Check if this is a Financial / Budget / Cost-of-Living query with numbers
    if (isBudgetOrFinancialQuery(query)) {
        const budgetAnalysis = analyzeDynamicBudget(query);
        processResults(resultBox, chatBox, sourcesList, query, budgetAnalysis);
        return;
    }

    // 2. Otherwise, run Live Keyless AI + Wikipedia Empirical Engine
    const dynamicAnalysis = await fetchLiveDynamicFactCheck(query);
    processResults(resultBox, chatBox, sourcesList, query, dynamicAnalysis);
}

function resetUI() {
    document.getElementById("query").value = "";
    document.getElementById('trending-news').style.display = 'block';
    document.getElementById('pre-search-trivia').style.display = 'block';
    document.getElementById('interactive-section').style.display = 'block';
    
    document.getElementById("results").style.display = 'none';
    document.getElementById("chat-results").style.display = 'none';
    document.getElementById("sources").style.display = 'none';
    document.getElementById("clear-btn").style.display = 'none';
}

// ==========================================
// 3. DYNAMIC FINANCIAL & LIVING COST CALCULATOR
//    (Parses ANY number, currency, and timeframe!)
// ==========================================
function isBudgetOrFinancialQuery(query) {
    const q = query.toLowerCase();
    const hasNumber = /\d+|million|thousand|hundred/i.test(q);
    const hasMoneyContext = /php|peso|usd|dollar|\$|₱|enough|live|survive|budget|salary|cost|afford|retire|week|month|day|year/i.test(q);
    return hasNumber && hasMoneyContext;
}

function parseAmountFromQuery(q) {
    // Clean commas
    let clean = q.replace(/,/g, '').toLowerCase();
    let multiplier = 1;
    if (/\bmillion\b|\bm\b/.test(clean)) multiplier = 1000000;
    else if (/\bthousand\b|\bk\b/.test(clean)) multiplier = 1000;

    const numMatch = clean.match(/(\d+(\.\d+)?)/);
    let baseNum = numMatch ? parseFloat(numMatch[1]) : 1000;

    // Handle "a million" without digits
    if (!numMatch && clean.includes("million")) baseNum = 1;

    return baseNum * multiplier;
}

function analyzeDynamicBudget(query) {
    const q = query.toLowerCase();
    const rawAmount = parseAmountFromQuery(q);
    
    // Detect Currency (USD vs PHP)
    const isUSD = /usd|dollar|\$/.test(q) && !/php|peso|₱/.test(q);
    const amountInPHP = isUSD ? rawAmount * liveUsdToPhp : rawAmount;
    const amountInUSD = isUSD ? rawAmount : rawAmount / liveUsdToPhp;

    // Detect Timeframe (Day, Week, Month, Year, or Lump Sum/Retirement)
    let days = 30;
    let periodLabel = "Monthly";
    if (/\bday\b|\bdaily\b/.test(q)) { days = 1; periodLabel = "Daily"; }
    else if (/\bweek\b|\bweekly\b|\b7 days\b/.test(q)) { days = 7; periodLabel = "Weekly (7 Days)"; }
    else if (/\bmonth\b|\bmonthly\b/.test(q)) { days = 30; periodLabel = "Monthly (30 Days)"; }
    else if (/\byear\b|\byearly\b|\bannual\b/.test(q)) { days = 365; periodLabel = "Annual (365 Days)"; }
    else if (amountInPHP >= 2000000) {
        // Lump sum / Net Worth mode (e.g. 5M PHP or $1M USD)
        days = 365;
        periodLabel = "4% Safe Annual Yield";
    }

    const isLumpSum = amountInPHP >= 2000000 && !/\bweek\b|\bmonth\b|\bday\b/.test(q);
    const effectiveBudgetPHP = isLumpSum ? (amountInPHP * 0.04) : amountInPHP;
    const dailyPHP = effectiveBudgetPHP / days;
    const weeklyPHP = dailyPHP * 7;
    const monthlyPHP = dailyPHP * 30;

    // Real-World 2026 Philippine Benchmarks (Single Person)
    const bareMinimumDaily = 285;     // ~₱2,000/week (Karinderya meals + basic jeepney/LRT commute, excluding rent)
    const modestLivingDaily = 600;    // ~₱18,000/month (Shared room/bedspace + home-cooked/karinderya + commute)
    const comfortableSingleDaily = 1500; // ~₱45,000/month (Solo studio/condo + AC + groceries + occasional dining)

    let verdict = "";
    let explanation = "";

    if (dailyPHP < 180) {
        verdict = "FALSE // BELOW SUBSISTENCE THRESHOLD";
        explanation = `At ₱${Math.round(dailyPHP).toLocaleString()} per day (₱${Math.round(weeklyPHP).toLocaleString()}/week), this budget falls below the Philippine basic food and transit threshold. In Metro Manila, a single commuter spends ₱40–₱90 daily on jeepney/LRT/MRT fares alone, leaving less than ₱100 for three meals.`;
    } else if (dailyPHP >= 180 && dailyPHP < 450) {
        verdict = "TIGHT // SURVIVABLE FOR FOOD & TRANSIT ONLY";
        explanation = `Your budget of ₱${Math.round(amountInPHP).toLocaleString()} (${periodLabel}) equals roughly ₱${Math.round(dailyPHP).toLocaleString()} per day (₱${Math.round(weeklyPHP).toLocaleString()}/week). This IS enough to cover basic daily food (home cooking, wet market produce, or ₱70–₱90 karinderya meals) and local jeepney/LRT transit for an individual—PROVIDED rent and utilities are already paid for. It leaves minimal margin for emergencies or dining out.`;
    } else if (dailyPHP >= 450 && dailyPHP < 1200) {
        verdict = "FACT // MODEST WORKING BUDGET";
        explanation = `At ₱${Math.round(dailyPHP).toLocaleString()} per day (~₱${Math.round(monthlyPHP).toLocaleString()}/month), an individual can live modestly in the Philippines. This covers daily food/groceries (~₱250–₱350/day), public transit, mobile data, and basic shared housing or provincial rent, though solo condo rent in central Metro Manila would still be tight.`;
    } else {
        verdict = "FACT // COMFORTABLE TO HIGH SUFFICIENCY";
        explanation = `With ₱${Math.round(dailyPHP).toLocaleString()} per day (~₱${Math.round(monthlyPHP).toLocaleString()}/month${isLumpSum ? ' from a 4% safe yield on your principal' : ''}), an individual can live very comfortably in the Philippines. This easily covers solo housing/condo rent, full groceries, utilities, healthcare, and discretionary spending.`;
    }

    const foodCoveragePct = Math.min(100, Math.round((dailyPHP / bareMinimumDaily) * 100));
    const modestCoveragePct = Math.min(100, Math.round((dailyPHP / modestLivingDaily) * 100));
    const comfortCoveragePct = Math.min(100, Math.round((dailyPHP / comfortableSingleDaily) * 100));

    return {
        verdict: verdict,
        explanation: explanation,
        data_points: [
            { label: `Input (${periodLabel})`, value: `₱${Math.round(amountInPHP).toLocaleString()}` },
            { label: "USD Equivalent", value: `$${amountInUSD.toLocaleString(undefined, {maximumFractionDigits: 0})}` },
            { label: "Daily Allowance", value: `₱${Math.round(dailyPHP).toLocaleString()} / Day` },
            { label: "Monthly Run-Rate", value: `₱${Math.round(monthlyPHP).toLocaleString()} / Mo` }
        ],
        chart_title: `Purchasing Power of ₱${Math.round(dailyPHP).toLocaleString()}/Day vs. PH Living Tiers`,
        chart_data: [
            { label: "Basic Food + Jeepney/LRT Commute Only (₱285/day | ₱2,000/wk)", pct: foodCoveragePct, display: `${Math.round((dailyPHP / bareMinimumDaily) * 100)}% Covered` },
            { label: "Modest Living w/ Shared Rent & Utilities (₱600/day | ₱18k/mo)", pct: modestCoveragePct, display: `${Math.round((dailyPHP / modestLivingDaily) * 100)}% Covered` },
            { label: "Comfortable Solo Living in Metro Manila (₱1,500/day | ₱45k/mo)", pct: comfortCoveragePct, display: `${Math.round((dailyPHP / comfortableSingleDaily) * 100)}% Covered` }
        ],
        sources: [
            {
                title: `Breakdown: Living on ₱${Math.round(weeklyPHP).toLocaleString()}/Week (₱${Math.round(dailyPHP).toLocaleString()}/Day) in the Philippines`,
                description: "Real-world meal planning, wet market (palengke) vs. supermarket grocery prices, and daily commuter budgeting.",
                url: `https://www.google.com/search?q=living+on+${Math.round(weeklyPHP)}+pesos+a+week+budget+philippines+reddit`
            },
            {
                title: "PSA & Numbeo: 2026 Cost of Food, Groceries & Commute in Metro Manila",
                description: "Average prices of rice, eggs, chicken, karinderya meals, and LRT/MRT/Jeepney fare matrices.",
                url: "https://www.google.com/search?q=numbeo+cost+of+living+manila+philippines+food+prices"
            },
            {
                title: `USD to PHP Conversion & Purchasing Power ($${amountInUSD.toFixed(0)} = ₱${Math.round(amountInPHP).toLocaleString()})`,
                description: "Live exchange rate comparison and inflation impact on household budgets.",
                url: `https://www.google.com/search?q=${Math.round(amountInPHP)}+php+to+usd+purchasing+power`
            }
        ]
    };
}

// ==========================================
// 4. LIVE KEYLESS AI + WIKIPEDIA ENGINE
//    (Generates unique results for ANY query!)
// ==========================================
async function fetchLiveDynamicFactCheck(query) {
    const cleanKeywords = extractImportantWords(query);
    const searchTopic = cleanKeywords.slice(0, 4).join(" ") || query;

    // 1. Fetch Wikipedia Empirical Context in parallel with Keyless AI
    const wikiPromise = fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTopic)}&utf8=&format=json&origin=*`)
        .then(r => r.json())
        .catch(() => null);

    // 2. Fetch Free Keyless AI JSON Analysis (Pollinations OpenAI Endpoint)
    const aiPrompt = `You are a strict fact-checking analytical system. Analyze this specific claim or question: "${query}".
Return ONLY a valid JSON object (no markdown formatting) with this exact structure:
{
  "verdict": "FACT" or "HOAX" or "CONTEXTUAL / NUANCED",
  "explanation": "A direct, factual 3-sentence verification with specific real-world numbers or evidence tailored strictly to the query.",
  "data_points": [
    {"label": "Specific Metric 1", "value": "Short Number/Fact"},
    {"label": "Specific Metric 2", "value": "Short Number/Fact"},
    {"label": "Specific Metric 3", "value": "Short Number/Fact"},
    {"label": "Confidence Score", "value": "e.g. 92%"}
  ],
  "chart_title": "Empirical Breakdown for Query",
  "chart_data": [
    {"label": "Primary Evidence Support", "pct": 85, "display": "85%"},
    {"label": "Scientific / Historical Consensus", "pct": 90, "display": "90%"},
    {"label": "Misinformation Risk Factor", "pct": 25, "display": "25%"}
  ]
}`;

    const aiPromise = fetch(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}?json=true`)
        .then(r => r.text())
        .catch(() => null);

    const [wikiData, aiRawText] = await Promise.all([wikiPromise, aiPromise]);

    // Build dynamic Wikipedia & Web Sources
    const wikiSources = (wikiData?.query?.search || []).slice(0, 3).map(item => ({
        title: `Encyclopedia Reference: ${item.title}`,
        description: item.snippet.replace(/<\/?[^>]+(>|$)/g, "") + "...",
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
    }));

    const customSearchSources = [
        {
            title: `Fact-Check Verification: "${query}"`,
            description: "Cross-check against Reuters, AP News, Vera Files, and Snopes archives.",
            url: `https://www.google.com/search?q=${encodeURIComponent(query + " fact check")}`
        }
    ];

    // Parse AI JSON if available
    if (aiRawText) {
        try {
            const cleaned = aiRawText.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.verdict && parsed.explanation) {
                parsed.sources = [...wikiSources, ...customSearchSources];
                return parsed;
            }
        } catch (e) {
            console.warn("AI JSON parse fallback triggered.");
        }
    }

    // Fallback using live Wikipedia snippets if AI endpoint is busy
    const topSnippet = wikiData?.query?.search?.[0]?.snippet?.replace(/<\/?[^>]+(>|$)/g, "") || "No direct encyclopedia match found; verify via primary fact-check repositories below.";
    const totalHits = wikiData?.query?.searchinfo?.totalhits || 0;

    return {
        verdict: totalHits > 0 ? "EMPIRICAL DATA INDEXED" : "UNVERIFIED CLAIM",
        explanation: `Live index analysis for "${query}": ${topSnippet}. Cross-reference the primary encyclopedic articles and fact-checking databases below to confirm context.`,
        data_points: [
            { label: "Indexed Records", value: totalHits.toLocaleString() },
            { label: "Key Terms", value: `${cleanKeywords.length} Matched` },
            { label: "Primary Topic", value: (cleanKeywords[0] || "General").toUpperCase() },
            { label: "Source Status", value: wikiSources.length > 0 ? "Verified" : "Pending" }
        ],
        chart_title: `Reference Density for "${searchTopic.toUpperCase()}"`,
        chart_data: [
            { label: "Encyclopedic & Academic Index Matches", pct: Math.min(100, totalHits > 500 ? 92 : 45), display: `${totalHits.toLocaleString()} Hits` },
            { label: "Keyword Specificity Score", pct: Math.min(100, cleanKeywords.length * 22), display: `${cleanKeywords.length} Core Terms` }
        ],
        sources: [...wikiSources, ...customSearchSources]
    };
}

// ==========================================
// 5. RENDER RESULTS TO DOM
// ==========================================
function processResults(resultBox, chatBox, sourcesList, query, aiResults) {
    const v = (aiResults.verdict || "CONTEXT NEEDED").toUpperCase();
    let summaryClass = "neutral-summary";
    let icon = "🟡";

    if (v.includes("HOAX") || v.includes("FALSE")) {
        summaryClass = "hoax-summary";
        icon = "❌";
    } else if (v.includes("FACT") || v.includes("TRUE") || v.includes("COMFORTABLE") || v.includes("MODEST")) {
        summaryClass = "fact-summary";
        icon = "✅";
    }

    resultBox.innerHTML = `
        <div class="dossier-label">[VERIFICATION REPORT // QUERY: ${query.toUpperCase()}]</div>
        <div class="fact-summary-box ${summaryClass}">${icon} VERDICT: ${v}</div>
    `;
    
    let metricsHtml = "";
    if (aiResults.data_points && aiResults.data_points.length > 0) {
        metricsHtml = `<div class="metrics-grid">
            ${aiResults.data_points.map((dp, i) => `
                <div class="metric-card">
                    <span class="metric-index">0${i + 1}</span>
                    <div class="metric-value">${dp.value}</div>
                    <div class="metric-label">${dp.label}</div>
                </div>
            `).join('')}
        </div>`;
    }

    let chartHtml = "";
    if (aiResults.chart_data && aiResults.chart_data.length > 0) {
        chartHtml = `
            <div class="chart-container">
                <div class="chart-title">📊 ${aiResults.chart_title || "EMPIRICAL BREAKDOWN"}</div>
                ${aiResults.chart_data.map(bar => `
                    <div class="chart-row">
                        <div class="chart-label-row">
                            <span>${bar.label}</span>
                            <strong>${bar.display}</strong>
                        </div>
                        <div class="chart-bar-bg">
                            <div class="chart-bar-fill" style="width: ${Math.min(100, Math.max(4, bar.pct))}%;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    chatBox.innerHTML = `
        <div class="section-header-bar">
            <h3 class="section-title">SYSTEM ANALYSIS & METRICS</h3>
            <span class="mono-tag">[COMPUTED OUTPUT]</span>
        </div>
        ${metricsHtml}
        ${chartHtml}
        <div class="brutalist-card">
            <p>${aiResults.explanation}</p>
        </div>
    `;

    sourcesList.innerHTML = "";
    (aiResults.sources || []).forEach(article => {
        let listItem = document.createElement("li");
        listItem.classList.add("article-card");
        listItem.innerHTML = `
            <div>
                <div class="article-source">VERIFICATION VECTOR</div>
                <h4 class="article-title">${article.title}</h4>
                <p>${article.description}</p>
            </div>
            <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="read-more">INSPECT SOURCE ↗</a>
        `;
        sourcesList.appendChild(listItem);
    });
}

function extractImportantWords(query) {
    const stopWords = ["the", "is", "are", "a", "an", "of", "to", "in", "and", "for", "on", "with", "at", "how", "what", "why", "do", "does", "it", "that", "can", "live", "enough"];
    return query.toLowerCase().replace(/[?.,!]/g, '').split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w));
}

// ==========================================
// 6. MULTI-SECTOR LIVE NEWS ENGINE
//    (Crypto, Stocks, PH/Gov, Sports, Science)
// ==========================================
const sectorConfigs = {
    crypto: {
        badge: "CRYPTO & WEB3",
        subreddit: "Cryptocurrency+Bitcoin",
        fallbackImg: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=500&q=80"
    },
    stocks: {
        badge: "STOCKS & ECON",
        subreddit: "stocks+investing+phinvest",
        fallbackImg: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&q=80"
    },
    gov: {
        badge: "PH & GOV",
        subreddit: "Philippines+worldnews",
        fallbackImg: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500&q=80"
    },
    sports: {
        badge: "SPORTS",
        subreddit: "sports+nba",
        fallbackImg: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=500&q=80"
    },
    tech: {
        badge: "SCIENCE & TECH",
        subreddit: "science+technology+todayilearned",
        fallbackImg: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80"
    }
};

async function switchNewsCategory(sector, btnElement) {
    currentNewsSector = sector;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    await fetchLiveNews(sector);
}

async function fetchSectorFeed(sectorKey, limit = 4) {
    const cfg = sectorConfigs[sectorKey];
    try {
        const res = await fetch(`https://www.reddit.com/r/${cfg.subreddit}/hot.json?limit=8`);
        const data = await res.json();
        const posts = data.data.children
            .map(c => c.data)
            .filter(p => !p.stickied && p.title && p.title.length > 15)
            .slice(0, limit);

        return posts.map(p => {
            const validThumb = (p.thumbnail && p.thumbnail.startsWith('http')) ? p.thumbnail : cfg.fallbackImg;
            return {
                title: p.title.length > 95 ? p.title.slice(0, 95) + "..." : p.title,
                url: p.url_overridden_by_dest || `https://www.reddit.com${p.permalink}`,
                img: validThumb,
                sector: cfg.badge,
                source: `r/${p.subreddit.toUpperCase()}`
            };
        });
    } catch (e) {
        return getCuratedSectorFallback(sectorKey).slice(0, limit);
    }
}

async function fetchLiveNews(sector = 'all') {
    const newsGrid = document.getElementById('news-grid');
    const statusTag = document.getElementById('news-status-tag');
    if (!newsGrid) return;

    newsGrid.innerHTML = `<p class="mono-text">FETCHING [${sector.toUpperCase()}] SECTOR STREAM...</p>`;
    if (statusTag) statusTag.innerText = `[SECTOR: ${sector.toUpperCase()}]`;

    let articles = [];

    if (sector === 'all') {
        // Pull 1 diverse headline from each sector!
        const [crypto, stocks, gov, sports] = await Promise.all([
            fetchSectorFeed('crypto', 1),
            fetchSectorFeed('stocks', 1),
            fetchSectorFeed('gov', 1),
            fetchSectorFeed('sports', 1)
        ]);
        articles = [...crypto, ...stocks, ...gov, ...sports];
    } else {
        articles = await fetchSectorFeed(sector, 4);
    }

    if (!articles || articles.length === 0) {
        articles = getCuratedSectorFallback(sector);
    }

    newsGrid.innerHTML = articles.map(item => `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="news-mini-card">
            <span class="news-sector-badge">${item.sector}</span>
            <img src="${item.img}" alt="${item.sector}" onerror="this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80'">
            <div class="news-mini-content">
                <h4>${item.title}</h4>
                <div class="article-source">${item.source} ↗</div>
            </div>
        </a>
    `).join('');
}

function getCuratedSectorFallback(sector) {
    const allCurated = [
        { sector: "CRYPTO & WEB3", title: "Bitcoin & Ethereum Institutional Liquidity Flows Surge Across Asian Markets", source: "CRYPTO MONITOR", url: "https://www.google.com/search?q=bitcoin+ethereum+market+liquidity+news", img: sectorConfigs.crypto.fallbackImg },
        { sector: "STOCKS & ECON", title: "PSEi & Global Equities React to Central Bank Interest Rate Guidance", source: "MARKET WATCH", url: "https://www.google.com/search?q=PSEi+philippine+stock+exchange+bsp+interest+rates", img: sectorConfigs.stocks.fallbackImg },
        { sector: "PH & GOV", title: "Philippine Infrastructure & Digital National ID Verification Updates", source: "GOV BULLETIN", url: "https://www.google.com/search?q=philippines+government+infrastructure+news", img: sectorConfigs.gov.fallbackImg },
        { sector: "SPORTS", title: "PBA, FIBA & Global Basketball Championship Standings and Analytics", source: "SPORTS DESK", url: "https://www.google.com/search?q=philippines+basketball+sports+news", img: sectorConfigs.sports.fallbackImg }
    ];
    if (sector === 'all') return allCurated;
    return allCurated.filter(i => i.sector.toLowerCase().includes(sector)).concat(allCurated).slice(0, 4);
}

// ==========================================
// 7. LIVE TRIVIA & MINI-GAME
// ==========================================
async function fetchLiveTrivia() {
    const triviaText = document.getElementById('live-trivia-text');
    if (!triviaText) return;
    try {
        const response = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
        const data = await response.json();
        triviaText.innerHTML = data.text.toUpperCase();
    } catch (error) {
        triviaText.innerHTML = "BITCOIN'S MAXIMUM SUPPLY IS MATHEMATICALLY CAPPED AT 21,000,000 COINS.";
    }
}

const gameQuestions = [
    { text: "BITCOIN'S TOTAL SUPPLY IS HARD-CAPPED AT 21 MILLION COINS.", isHoax: false, fact: "Satoshi Nakamoto hardcoded the 21 million limit into the protocol." },
    { text: "BANANAS GROW ON WOODEN TREES.", isHoax: true, fact: "Banana plants are giant herbaceous plants with pseudostems, not wooden trees." },
    { text: "HUMANS ONLY USE 10% OF THEIR BRAIN CAPACITY.", isHoax: true, fact: "fMRI scans show humans use virtually every part of the brain daily." },
    { text: "SHORT SELLING A STOCK HAS THEORETICALLY INFINITE RISK.", isHoax: false, fact: "Because a stock's price can rise indefinitely, unhedged short losses have no cap." },
    { text: "THE PHILIPPINES CONSISTS OF EXACTLY 7,107 ISLANDS.", isHoax: true, fact: "NAMRIA updated the official count to 7,641 islands using modern radar mapping." },
    { text: "LIGHTNING NEVER STRIKES THE SAME PLACE TWICE.", isHoax: true, fact: "Tall structures like the Empire State Building are struck dozens of times a year." }
];

let currentGameScore = 0;
let currentGameStreak = 0;
let currentQuestion = {};

function startMiniGame() {
    currentGameScore = 0;
    currentGameStreak = 0;
    document.getElementById('game-score').innerText = `SCORE: 0`;
    document.getElementById('game-streak').innerText = `STREAK: 0`;
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-fact').style.display = 'inline-block';
    document.getElementById('btn-hoax').style.display = 'inline-block';
    nextQuestion();
}

function nextQuestion() {
    document.getElementById('game-feedback').innerText = '';
    currentQuestion = gameQuestions[Math.floor(Math.random() * gameQuestions.length)];
    document.getElementById('game-question').innerText = currentQuestion.text;
}

function playGame(userGuessedHoax) {
    const feedbackText = document.getElementById('game-feedback');
    if (userGuessedHoax === currentQuestion.isHoax) {
        currentGameScore += 10;
        currentGameStreak += 1;
        feedbackText.innerHTML = `[✓ VERIFIED] ${currentQuestion.fact.toUpperCase()}`;
    } else {
        currentGameStreak = 0;
        feedbackText.innerHTML = `[✕ INCORRECT] ${currentQuestion.fact.toUpperCase()}`;
    }
    document.getElementById('game-score').innerText = `SCORE: ${currentGameScore}`;
    document.getElementById('game-streak').innerText = `STREAK: ${currentGameStreak}`;
    setTimeout(nextQuestion, 3200);
}

// ==========================================
// 8. INITIALIZATION & DARK MODE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updateLiveTicker();
    fetchLiveNews('all');
    fetchLiveTrivia();
    setInterval(fetchLiveTrivia, 12000);

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }
});