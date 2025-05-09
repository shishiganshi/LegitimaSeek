function searchFact() {
    const queryInput = document.getElementById("query");
    const query = queryInput?.value?.trim() || "";
    
    if (!query) {
        alert("Please enter a claim to verify.");
        return;
    }

    // Check if a previous search exists and refresh if needed
    const previousQuery = sessionStorage.getItem('lastSearchQuery');
    if (previousQuery && previousQuery !== query) {
        // Store new query and reload page
        sessionStorage.setItem('lastSearchQuery', query);
        sessionStorage.setItem('pendingSearch', query);
        window.location.reload();
        return;
    }

    // Clear previous query
    sessionStorage.setItem('lastSearchQuery', query);

    // Clear any existing interactive sections
    const existingInteractive = document.getElementById('interactive-section');
    if (existingInteractive) {
        existingInteractive.remove();
    }

    const resultBox = document.getElementById("results");
    const chatBox = document.getElementById("chat-results");
    const sourcesBox = document.getElementById("sources-list");

    resultBox.innerHTML = '';
    chatBox.innerHTML = '';
    sourcesBox.innerHTML = '';

    const phraseQuery = `"${query}"`;
    const importantWords = extractImportantWords(query);

    initializeUI(resultBox, chatBox, sourcesBox, query);
    
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000);
    });

    Promise.race([
        fetchAllSources(phraseQuery, query, importantWords),
        timeoutPromise
    ])
    .then(([newsDataResults, newsApiResults, mayoClinicResults, aiResults]) => {
        processResults(resultBox, chatBox, sourcesBox, query, newsDataResults, newsApiResults, mayoClinicResults, aiResults, importantWords);
    })
    .catch(error => {
        console.error("Search error:", error);
        handleError(error, resultBox, chatBox);
        sourcesBox.innerHTML = '';
    });
}

function initializeUI(resultBox, chatBox, sourcesBox, query) {
    resultBox.innerHTML = `<h3>Search results for: "${query}"</h3><p>Loading...</p>`;
    chatBox.innerHTML = `<h3>Chat Results</h3><p>Loading...</p>`;
    sourcesBox.innerHTML = "";
}

function fetchGeminiAnalysis(query) {
    const prompt = `Analyze this claim: "${query}"
        Please provide a structured response in this format:
        VERDICT: (True/False)
        EXPLANATION: (Detailed analysis)
        
        Consider both international and Philippine perspectives where applicable.
        
        SOURCES:
        1. [Source Name] - full URL
        2. [Source Name] - full URL
        3. [Source Name] - full URL
        
        Include sources from:
        - International: Reuters, APNews, WHO, CDC, Mayo Clinic, Nature
        - Philippine: ABS-CBN News, GMA News, Inquirer, PhilStar, PNA, DOH
        - Academic: Educational institutions (.edu domains)
        - Fact-checking: Vera Files, TSEK.ph, FactCheck.org
        
        Ensure all URLs link to specific articles, not homepages.`;

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyAt_szaSHaHiw1e9G7TpUXzBxw--cUZVx8", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache"
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            })
            .then(res => {
                if (!res.ok) throw new Error(`Gemini API error! Status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                const response = processGeminiResponse(data);
                if (!response || response.length === 0) {
                    throw new Error('No valid response from Gemini');
                }
                resolve(response);
            })
            .catch(error => {
                console.error("Error fetching Gemini:", error);
                reject(error);
            });
        }, 1000);
    });
}

function processGeminiResponse(data) {
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    
    // Format the response
    const analysis = responseText
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\*/g, '')
        .replace(/VERDICT:/gi, '<strong>Verdict:</strong>')
        .replace(/EXPLANATION:/gi, '<strong>Explanation:</strong>')
        .replace(/SOURCES:/gi, '<strong>Sources:</strong>');

    // Extract URLs
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const urls = responseText.match(urlPattern) || [];

    const aiSources = urls.map(url => ({
        title: getDomainFromURL(url),
        description: `Source from ${getDomainFromURL(url)}`,
        link: url,
        source: "AI Analysis"
    })).filter(source => source.link);

    return [{
        title: "AI Analysis (GEMINI)",
        description: analysis,
        link: "#",
        sources: aiSources
    }];
}

function fetchAllSources(phraseQuery, query, importantWords) {
    return Promise.all([
        Promise.resolve([]),
        fetchNewsAPI(phraseQuery),
        fetchMayoClinic(query),
        fetchGeminiAnalysis(query)
    ]);
}

function fetchNewsAPI(phraseQuery) {
    return fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(phraseQuery)}&language=en&apiKey=75d69b58956f4fdab4461c234783d981`)
        .then(res => res.json())
        .then(data => {
            if (!data?.articles?.length) return [];
            return data.articles.map(article => ({
                title: article.title,
                description: article.description,
                link: article.url
            }));
        })
        .catch(error => {
            console.error("Error fetching NewsAPI.org:", error);
            return [];
        });
}

function fetchMayoClinic(query) {
    return fetch(`https://www.mayoclinic.org/rss/all-health-information-and-news.xml`)
        .then(res => res.text())
        .then(str => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(str, "text/xml");
            return Array.from(xmlDoc.querySelectorAll("item"))
                .map(item => ({
                    title: item.querySelector("title")?.textContent || "",
                    description: item.querySelector("description")?.textContent || "",
                    link: item.querySelector("link")?.textContent || "",
                    source: "Mayo Clinic"
                }))
                .filter(article => {
                    const content = (article.title + " " + article.description).toLowerCase();
                    return query.toLowerCase().split(" ").some(word => content.includes(word));
                });
        })
        .catch(error => {
            console.error("Error fetching Mayo Clinic RSS:", error);
            return [];
        });
}

function processResults(resultBox, chatBox, sourcesBox, query, newsDataResults, newsApiResults, mayoClinicResults, aiResults, importantWords) {
    let allArticles = [
        ...newsDataResults, 
        ...newsApiResults, 
        ...mayoClinicResults
    ];

    if (aiResults && aiResults[0] && aiResults[0].sources) {
        const chatSources = aiResults[0].sources.map(source => ({
            title: source.title,
            description: `Verified source from chat analysis`,
            link: source.link,
            source: "AI Verified"
        }));
        allArticles.push(...chatSources);
    }

    let articles = filterRelevantArticles(allArticles, importantWords);
    let summary = analyzeArticles(articles, aiResults);

    let verificationResult = summary.includes('✅ Likely Fact') ? 'FACT' : 
                            summary.includes('❌ Likely Hoax') ? 'HOAX' : 
                            'INCONCLUSIVE';

    let sourceUrls = allArticles
        .map(article => article.link)
        .filter(url => url && url !== '#')
        .filter((url, index, self) => self.indexOf(url) === index);

    const resultData = {
        query: query,
        verification_result: verificationResult,
        sources: JSON.stringify(sourceUrls)
    };

    fetch('backend-search.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(resultData)
    })
    .then(response => response.json())
    .then(data => console.log('Saved to database:', data))
    .catch(error => console.error('Error saving:', error));

    fetch(`backend-search.php?query=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            console.log("Query saved to database:", data);
        })
        .catch(error => {
            console.error("Error saving to database:", error);
        });

    resultBox.innerHTML = `<h3>Search results for: "${query}"</h3><div class="fact-summary-box">${summary}</div>`;

    if (aiResults && aiResults.length > 0) {
        const formattedResponse = aiResults[0].description
            .split('\n')
            .map(line => {
                if (line.trim().startsWith('http')) {
                    return '';
                }
                return `<p>${line.replace(/^\d+\.\s+\[(.*?)\]/g, '<span class="source-reference">$1</span>')}</p>`;
            })
            .filter(line => line)
            .join('');

        chatBox.innerHTML = `
            <h3>AI Analysis</h3>
            <div class="chat-response">
                ${formattedResponse}
            </div>
        `;

        if (aiResults[0].sources && aiResults[0].sources.length > 0) {
            chatBox.innerHTML += `
                <div class="chat-sources">
                    <h4>Verified Sources:</h4>
                    <ul>
                        ${aiResults[0].sources.map(source => `
                            <li>
                                <a href="${source.link}" target="_blank" rel="noopener noreferrer">
                                    ${source.title}
                                </a>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
    } else {
        chatBox.innerHTML = `
            <h3>AI Analysis</h3>
            <p class="error-message">No analysis available at this moment.</p>
        `;
    }

    if (articles.length === 0) {
        sourcesBox.innerHTML = `<p>No sources found for "${query}". Try different keywords.</p>`;
    } else {
        sourcesBox.innerHTML = `
            <ul id="sources-list"></ul>
        `;
        
        articles.forEach(article => {
            if (article.link && article.link !== "#") {
                addArticleToDOM(article);
            }
        });
    }

    // Generate quiz after processing results
    if (aiResults && aiResults.length > 0) {
        generateQuiz(query, aiResults);
    }
}

function handleError(error, resultBox, chatBox) {
    const errorMessage = error?.message || "Error fetching results. Please try again.";
    resultBox.innerHTML = `<h3>Search Results</h3><p class="error-message">${errorMessage}</p>`;
    chatBox.innerHTML = `<h3>Chat Results</h3><p class="error-message">${errorMessage}</p>`;
}

function extractImportantWords(query) {
    const stopWords = ["the", "is", "are", "a", "an", "of", "to", "in", "and", "for", "on", "with", "at"];
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => !stopWords.includes(word))
        .slice(0, 5); 
}

function filterRelevantArticles(articles, importantWords) {
    if (!articles || articles.length === 0) return [];

    const queryPhrase = importantWords.join(" ");

    const trustedPhDomains = [
        'abs-cbn.com',
        'gmanetwork.com',
        'inquirer.net',
        'philstar.com',
        'pna.gov.ph',
        'doh.gov.ph',
        'rappler.com',
        'verafiles.org',
        'tsek.ph',
        'up.edu.ph',
        'ateneo.edu',
        'dlsu.edu.ph',
        'ust.edu.ph'
    ];

    return articles
        .map(article => {
            let text = ((article.title || "") + " " + (article.description || "")).toLowerCase();
            let relevance = 0;

            relevance += 0.1;

            if (text.includes(queryPhrase)) {
                relevance += 5;
            }

            if (article.source === "Mayo Clinic" || 
                (article.link && /mayoclinic\.org|who\.int|nih\.gov|cdc\.gov|reuters\.com|apnews\.com|pna\.gov\.ph|wikipedia\.org|scholar\.google\.com/i.test(article.link)) ||
                (article.link && trustedPhDomains.some(domain => article.link.includes(domain)))) {
                relevance += 2;
            }

            let words = text.split(/\s+/);
            let foundWords = new Set();
            let consecutiveMatches = 0;

            words.forEach((word, index) => {
                importantWords.forEach(queryWord => {
                    if (word.includes(queryWord)) {
                        foundWords.add(queryWord);
                        relevance += 1;

                        if (index > 0 && words[index - 1].includes(queryWord)) {
                            consecutiveMatches++;
                            relevance += 0.5;
                        }
                    }
                });
            });

            if (foundWords.size === importantWords.length) {
                relevance += 3;
            }

            if (article.publishedAt) {
                const daysAgo = (new Date() - new Date(article.publishedAt)) / (1000 * 60 * 60 * 24);
                if (daysAgo < 7) relevance += 1;
                if (daysAgo < 30) relevance += 0.5;
            }

            return {
                ...article,
                relevance: Math.round(relevance * 100) / 100,
                matchedWords: Array.from(foundWords)
            };
        })
        .filter(article => article.relevance > 0.1)
        .sort((a, b) => b.relevance - a.relevance);
}

function analyzeArticles(articles, aiResults) {
    // Source check
    const hasSourcesInDOM = articles && articles.length > 0;
    const hasChatSources = aiResults?.[0]?.sources?.length > 0;

    if (!hasSourcesInDOM && !hasChatSources) {
        return `<span class='neutral-summary'>Conclusion: 🟡 Inconclusive (No Supporting Sources Available)</span>`;
    }

    // Extract verdict first
    const chatText = aiResults?.[0]?.description.toLowerCase() || '';
    const verdictMatch = chatText.match(/verdict:?\s*(\w+)/i);
    
    // Check for strong hoax indicators in the explanation
    const hasHoaxEvidence = chatText.includes("false") || 
                           chatText.includes("hoax") || 
                           chatText.includes("debunk") || 
                           chatText.includes("misleading") ||
                           chatText.includes("fabricated");
    
    // If we have sources and a verdict
    if (verdictMatch && (hasSourcesInDOM || hasChatSources)) {
        const verdict = verdictMatch[1].toLowerCase();
        const confidence = (hasSourcesInDOM && hasChatSources) ? "High" : "Medium";

        // Prioritize FALSE verdict when there's supporting evidence
        if (verdict === 'false' || (verdict === 'false' && hasHoaxEvidence)) {
            return `<span class='hoax-summary'>👾 AI-Assisted ${confidence} confidence: ❌ Likely Hoax (100% Hoax)</span>`;
        } else if (verdict === 'true' && !hasHoaxEvidence) {
            return `<span class='fact-summary'>👾 AI-Assisted ${confidence} confidence: ✅ Likely Fact (100% Fact)</span>`;
        }
    }

    // Only proceed to scoring if needed
    let factScore = 0;
    let hoaxScore = 0;
    let inconclusiveScore = 0;

    if (aiResults && aiResults.length > 0) {
        // Heavily weight hoax indicators
        if (hasHoaxEvidence) {
            hoaxScore += 50;
        }
        
        // Score based on keywords in explanation
        const chatText = aiResults[0].description.toLowerCase();
        
        if (chatText.includes("confirmed true") || chatText.includes("verified fact")) {
            factScore += 30;
        } else if (chatText.includes("confirmed false") || chatText.includes("debunked")) {
            hoaxScore += 30;
        }
        
        if (chatText.includes("insufficient evidence") || 
            chatText.includes("cannot determine") || 
            chatText.includes("no clear evidence")) {
            inconclusiveScore += 15;
        }
    }

    // Additional scoring from articles
    articles.forEach(article => {
        let text = ((article.title || "") + " " + (article.description || "")).toLowerCase();
        
        if (text.includes("debunked") || text.includes("false claim")) {
            hoaxScore += 10;
        } else if (text.includes("confirmed") || text.includes("verified")) {
            factScore += 10;
        }
        
        if (text.includes("inconclusive") || text.includes("unclear")) {
            inconclusiveScore += 5;
        }
    });

    let total = factScore + hoaxScore + inconclusiveScore;
    
    if (total === 0) {
        return `<span class='neutral-summary'>Conclusion: 🟡 Inconclusive based on available evidence</span>`;
    }

    let factPercent = Math.round((factScore / total) * 100);
    let hoaxPercent = Math.round((hoaxScore / total) * 100);
    
    let confidence = total > 40 ? "High confidence: " : 
                    total > 20 ? "Medium confidence: " : 
                    "Low confidence: ";

    let aiIndicator = "👾 AI-Assisted ";

    if (factScore > hoaxScore && factScore > inconclusiveScore) {
        return `<span class='fact-summary'>${aiIndicator}${confidence}✅ Likely Fact (${factPercent}% Fact)</span>`;
    } else if (hoaxScore > factScore && hoaxScore > inconclusiveScore) {
        return `<span class='hoax-summary'>${aiIndicator}${confidence}❌ Likely Hoax (${hoaxPercent}% Hoax)</span>`;
    } else {
        return `<span class='neutral-summary'>${aiIndicator}${confidence}🟡 Inconclusive (Needs More Research)</span>`;
    }
}

function addArticleToDOM(article) {
    let sourcesBox = document.getElementById("sources-list");
    let listItem = document.createElement("li");

    let anchor = document.createElement("a");
    anchor.href = article.link;
    anchor.textContent = article.title || "Untitled";
    anchor.target = "_blank";

    let description = document.createElement("div");
    description.classList.add("source-description");
    description.textContent = article.description || "No description available.";

    let previewContainer = document.createElement("div");
    previewContainer.classList.add("source-preview");

    previewContainer.innerHTML = `
        <div class="article-card">
            <div class="article-source">${article.source || getDomainFromURL(article.link)}</div>
            <h4 class="article-title">${article.title}</h4>
            <p class="article-description">${article.description?.slice(0, 200)}${article.description?.length > 200 ? '...' : ''}</p>
            <div class="article-footer">
                <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more">
                    Read Full Article ↗
                </a>
                <span class="article-domain">${getDomainFromURL(article.link)}</span>
            </div>
        </div>
    `;

    listItem.appendChild(anchor);
    listItem.appendChild(description);
    listItem.appendChild(previewContainer);
    sourcesBox.appendChild(listItem);
}

function getDomainFromURL(url) {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
        return 'Source';
    }
}

function generateContextTrivia(query, aiResults) {
    const triviaList = [
        { fact: "Coffee is actually a fruit! The coffee beans are the pit of a cherry-like berry.", emoji: "☕" },
        { fact: "The first webcam was invented to monitor a coffee pot at the University of Cambridge.", emoji: "📸" },
        { fact: "A day on Venus is longer than its year!", emoji: "🌟" },
        { fact: "Honey never spoils. Archaeologists have found 3000-year-old honey still preserved.", emoji: "🍯" },
        { fact: "The Philippines is home to the smallest primate in the world - the Philippine tarsier.", emoji: "🦊" }
    ];

    try {
        const description = aiResults[0]?.description || '';
        const explanation = description.match(/explanation:?(.*?)(?=sources:|$)/is)?.[1]?.trim() || '';
        
        const facts = explanation
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => {
                const lower = s.toLowerCase();
                return s.length > 20 && 
                       !lower.includes('verdict') && 
                       !lower.includes('source') &&
                       !lower.includes('http');
            });
        
        if (facts.length > 0) {
            const fact = facts[Math.floor(Math.random() * Math.min(3, facts.length))];
            return `
                <div class="trivia-box">
                    <span class="trivia-emoji">💡</span>
                    <p>Related to your search: ${fact}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error generating contextual trivia:', error);
    }
    
    const randomTrivia = triviaList[Math.floor(Math.random() * triviaList.length)];
    return `
        <div class="trivia-box">
            <span class="trivia-emoji">${randomTrivia.emoji}</span>
            <p>${randomTrivia.fact}</p>
        </div>
    `;
}

function generateQuiz(query, aiResults) {
    const quizContainer = document.getElementById('quiz-content');
    if (!quizContainer) return;
    
    try {
        const quiz = createQuizFromResults(aiResults[0].description);
        
        quizContainer.innerHTML = `
            <div class="quiz-question">${quiz.question}</div>
            <div class="options">
                ${quiz.options.map((option, index) => `
                    <div class="quiz-option" onclick="checkAnswer(${index}, ${quiz.correct})">
                        ${option}
                    </div>
                `).join('')}
            </div>
            <div class="quiz-feedback"></div>
        `;
    } catch (error) {
        console.error('Error generating quiz:', error);
        quizContainer.innerHTML = '<p>Quiz not available for this result.</p>';
    }
}

function createQuizFromResults(analysisText) {
    try {
        const explanation = analysisText.match(/explanation:?(.*?)(?=sources:|$)/is)?.[1]?.trim() || '';
        const verdict = analysisText.match(/verdict:?\s*(\w+)/i)?.[1]?.toLowerCase() || '';
        
        const statements = explanation
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20 && !s.toLowerCase().includes('verdict'))
            .slice(0, 4);

        if (statements.length > 0) {
            const correctStatement = statements[0];
            const options = [
                correctStatement,
                verdict === 'true' ? 'This claim needs more verification' : 'This claim appears to be accurate',
                verdict === 'true' ? 'The evidence is inconclusive' : 'The sources are unreliable',
                'More research is needed to confirm this'
            ];

            return {
                question: "Based on the fact-check analysis, which statement is most accurate?",
                options: shuffle(options),
                correct: options.indexOf(correctStatement)
            };
        }
    } catch (error) {
        console.error('Error generating quiz:', error);
    }

    return {
        question: "Based on the analysis, which statement is most likely true?",
        options: shuffle([
            "The claim requires additional verification",
            "More evidence is needed to confirm this",
            "The sources suggest further research is needed",
            "This information needs thorough fact-checking"
        ]),
        correct: 0
    };
}

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function checkAnswer(selected, correct) {
    const feedback = document.querySelector('.quiz-feedback');
    if (selected === correct) {
        feedback.textContent = 'Correct! ✅';
        feedback.className = 'quiz-feedback correct';
    } else {
        feedback.textContent = 'Incorrect. Try again! ❌';
        feedback.className = 'quiz-feedback incorrect';
    }
}

const preSearchQuizzes = [
    {
        question: "Drinking water during meals dilutes stomach acid and impairs digestion.",
        isHoax: true,
        explanation: "Did you know? This is a myth! Scientific research shows that water consumption during meals does not significantly affect digestion. Your stomach is designed to handle both food and liquids efficiently."
    },
    {
        question: "The Great Wall of China is visible from space with the naked eye.",
        isHoax: true,
        explanation: "Did you know? Despite popular belief, the Great Wall is not visible from space with the naked eye! Astronauts have confirmed this, though it may be visible from low Earth orbit under perfect conditions."
    },
    {
        question: "Honey is the only food that never spoils.",
        isHoax: false,
        explanation: "Did you know? This is true! Archaeologists have found 3000-year-old honey in ancient Egyptian tombs that is still perfectly edible. Its low moisture content and acidic pH make it impossible for bacteria to grow."
    },
    {
        question: "The Philippines has the smallest primate in the world.",
        isHoax: false,
        explanation: "Did you know? This is true! The Philippine Tarsier is one of the smallest known primates, measuring only about 4-6 inches tall. These nocturnal creatures are found primarily in the southeastern Philippines."
    },
    // Add more quizzes here
];

let currentScore = 0;
let totalQuestions = 0;

function initializePreSearchQuiz() {
    const quizContainer = document.getElementById('pre-search-quiz');
    if (!quizContainer) return;

    const randomQuiz = preSearchQuizzes[Math.floor(Math.random() * preSearchQuizzes.length)];
    totalQuestions++;

    quizContainer.innerHTML = `
        <div class="quiz-question">${randomQuiz.question}</div>
        <div class="options">
            <button onclick="checkPreSearchAnswer(true, ${randomQuiz.isHoax})" class="quiz-option">Hoax</button>
            <button onclick="checkPreSearchAnswer(false, ${randomQuiz.isHoax})" class="quiz-option">Fact</button>
        </div>
        <div class="quiz-feedback"></div>
        <div class="quiz-explanation" style="display: none;">${randomQuiz.explanation}</div>
    `;

    updateScore();
}

function checkPreSearchAnswer(userAnswer, isHoax) {
    const feedback = document.querySelector('.quiz-feedback');
    const explanation = document.querySelector('.quiz-explanation');
    const isCorrect = userAnswer === isHoax;

    if (isCorrect) {
        currentScore++;
        feedback.innerHTML = `<span class="correct">Correct! ✅</span>`;
    } else {
        feedback.innerHTML = `<span class="incorrect">Incorrect! ❌</span>`;
    }

    explanation.style.display = 'block';
    updateScore();

    // Show next quiz after 3 seconds
    setTimeout(() => {
        initializePreSearchQuiz();
    }, 3000);
}

function updateScore() {
    const scoreDisplay = document.getElementById('quiz-score');
    if (scoreDisplay) {
        scoreDisplay.innerHTML = `Score: ${currentScore}/${totalQuestions}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const hasSeenLoading = sessionStorage.getItem('hasSeenLoading');
    
    if (!hasSeenLoading) {
        sessionStorage.setItem('hasSeenLoading', 'true');
        window.location.href = 'loading-screen.html';
        return;
    }

    // Initialize pre-search trivia
    const preSearchTrivia = document.getElementById('pre-search-trivia');
    if (preSearchTrivia) {
        const shuffledTrivia = getShuffledTrivia();
        let currentTriviaIndex = 0;

        function updateTrivia() {
            const currentTrivia = shuffledTrivia[currentTriviaIndex];
            const triviaContent = document.getElementById('initial-trivia-content');
            if (triviaContent) {
                triviaContent.innerHTML = `
                    <div class="trivia-box">
                        <span class="trivia-emoji">${currentTrivia.emoji}</span>
                        <p>${currentTrivia.fact}</p>
                    </div>
                `;
            }
            currentTriviaIndex = (currentTriviaIndex + 1) % shuffledTrivia.length;
        }

        // Initial trivia display
        updateTrivia();
        // Rotate trivia every 5 seconds
        setInterval(updateTrivia, 5000);
    }

    // Initialize pre-search quiz
    initializePreSearchQuiz();

    // Check for pending search from refresh
    const pendingSearch = sessionStorage.getItem('pendingSearch');
    if (pendingSearch) {
        const queryInput = document.getElementById("query");
        if (queryInput) {
            queryInput.value = pendingSearch;
        }
        sessionStorage.removeItem('pendingSearch');
        searchFact();
    }
});

function getShuffledTrivia() {
    const preSearchTriviaList = [
        { fact: "Over 90% of the information on the internet was created in just the last few years.", emoji: "🌐" },
        { fact: "The average person spends about 6 hours and 58 minutes online each day.", emoji: "⏰" },
        { fact: "The first known internet hoax was spread in 1984 about a computer virus.", emoji: "🦠" },
        { fact: "About 70% of viral fake news spreads through social media sharing.", emoji: "📱" },
        { fact: "Critical thinking can reduce the chances of believing false information by up to 80%.", emoji: "🤔" },
        { fact: "The term 'fake news' was first used in the late 19th century.", emoji: "📰" },
        { fact: "Most fact-checking organizations follow the same international verification standards.", emoji: "✅" },
        { fact: "Digital literacy skills can help prevent the spread of misinformation.", emoji: "📚" }
    ];
    
    // Shuffle the trivia list
    const shuffled = [...preSearchTriviaList].sort(() => Math.random() - 0.5);
    return shuffled;
}