// test.js
console.log(`[TEST] ✅ Script démarré à ${new Date().toISOString()}`);

// Simule une tâche de scraping (rapide)
function scrape() {
    const now = new Date();
    console.log(`[TEST] 🕒 Scraping simulé à ${now.toLocaleTimeString()} — OK`);
}

scrape();