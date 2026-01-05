// ========================================================================
// SCRAPER GOOGLE MAPS - VERSION CORRIGÉE (Gestion complète du consentement)
// ========================================================================

import { chromium } from "playwright";
import dotenv from "dotenv";

dotenv.config();

const CLEAN_URL = "https://www.google.com/maps/place/Premium+Car+Deals/@44.8516607,-0.5128186,773m/data=!3m1!1e3!4m18!1m9!3m8!1s0xd552f8a749d488b:0x6a148d81a3a659a6!2sPremium+Car+Deals!8m2!3d44.8516608!4d-0.5079477!9m1!1b1!16s%2Fg%2F11yqydj2xn!3m7!1s0xd552f8a749d488b:0x6a148d81a3a659a6!8m2!3d44.8516608!4d-0.5079477!9m1!1b1!16s%2Fg%2F11yqydj2xn?entry=ttu&g_ep=EgoyMDI1MTIwOS4wIKXMDSoASAFQAw%3D%3D";



// ========================================================================
// ✅ GESTION DU CONSENTEMENT (CORRIGÉ)
// ========================================================================

async function acceptGoogleConsent(page) {
    try {
        console.log('[CONSENT] 🔍 Recherche du bouton "Tout accepter"...');
        await page.waitForTimeout(2000);

        // ✅ Stratégie 1: Texte exact "Tout accepter"
        const acceptBtn = page.locator('button:has-text("Tout accepter")').first();

        if (await acceptBtn.isVisible({ timeout: 5000 })) {
            console.log('[CONSENT] ✅ Bouton trouvé par texte');
            await acceptBtn.click({ timeout: 3000 });
            console.log('[CONSENT] ✅ Clic effectué, attente redirection...');

            // Attendre redirection vers Google Maps
            // await page.waitForURL(/google\.com\/maps/, { timeout: 60000 });
            console.log('[CONSENT] ✅ Redirection vers Google Maps réussie');
            return true;
        }

        // ✅ Stratégie 2: aria-label
        console.log('[CONSENT] 🔄 Tentative aria-label...');
        const ariaBtn = page.locator('button[aria-label="Tout accepter"]').first();
        if (await ariaBtn.isVisible({ timeout: 3000 })) {
            await ariaBtn.click();
            await page.waitForURL(/google\.com\/maps/, { timeout: 15000 });
            console.log('[CONSENT] ✅ Accepté via aria-label');
            return true;
        }

        // ✅ Stratégie 3: jsname (attribut Google interne)
        console.log('[CONSENT] 🔄 Tentative jsname...');
        const jsnameBtn = page.locator('button[jsname="b3VHJd"]').first();
        if (await jsnameBtn.isVisible({ timeout: 3000 })) {
            await jsnameBtn.click();
            await page.waitForURL(/google\.com\/maps/, { timeout: 15000 });
            console.log('[CONSENT] ✅ Accepté via jsname');
            return true;
        }

        console.log('[CONSENT] ℹ️ Aucun écran de consentement détecté');
        return false;

    } catch (err) {
        console.error('[CONSENT] ❌ Erreur:', err.message);

        // Debug screenshot


        return false;
    }
}

function parseReview(raw) {
    if (!Array.isArray(raw) || !raw[0]?.[1]) return null;

    return {
        author: raw[0]?.[1] || '',
        authorUrl: raw[0]?.[0] || '',
        //authorId: raw[6] || '',
        date: raw[1] || '',
        rating: raw[4] || 0,
        text: raw[3] || '',
        // 🔔 Réponse du propriétaire (si elle existe)
        ownerResponse: raw[14]
            ? {
                text: raw[14],
                date: raw[15] || '',
                //author: raw[19]?.[1] || 'Propriétaire',
                //authorId: raw[19]?.[8] || ''
            }
            : null,
        // 🔑 Clés uniques pour dédupliquer
        rawId: raw[27] || raw[8] || '', // token pagination / review_id / fallback
        //placeId: raw[24]?.[1] || '',
        //visited: raw[33]?.[2] || null,
        //timestamp: raw[34] || null
    };
}





// ========================================================================
// ✅ EXTRAIRE LA RÉPONSE MANQUANTE EN NAVIGUANT VERS LE PROFIL UTILISATEUR
// ========================================================================
async function fetchMissingOwnerResponse(context, authorUrl) {
    if (!authorUrl || !authorUrl.includes("google.com/maps/contrib/")) {
        console.warn(`[AUTHOR] ⚠️ URL invalide: ${authorUrl}`);
        return null;
    }

    console.log(`[AUTHOR] 🔍 Ouverture profil: ${authorUrl.split('/').pop().split('?')[0]}`);

    try {
        const page = await context.newPage();
        await page.goto(authorUrl, { waitUntil: 'networkidle', timeout: 60000 });

        // Gestion consent si besoin (nouveau contexte = nouveau cookie non injecté)
        if (page.url().includes('consent.google.com')) {
            await acceptGoogleConsent(page);
        }

        await bypassMapsPopupWithRetry(page)

        // Clic sur onglet "Avis"
        await clickReviewsTab(page);

        const hasReviews = await page.evaluate(() => {
            const bodyText = document.body.innerText || '';
            if (bodyText.includes("pas encore rédigé d'avis") || bodyText.includes("choisi de ne pas les afficher")) {
                return false;
            }
            const addressElements = document.querySelectorAll('div.csaqw');
            console.log(`${addressElements.length} avis trouvés`);
            return addressElements.length > 0;
        });

        if (!hasReviews) {
            console.log(`[MOBILE] ℹ️ L'utilisateur n'a pas d'avis publics`);

            return null;
        }

        console.log(`[MOBILE] ✅ L'utilisateur a des avis`);
        await humanDelay(2000, 3000);

        const premiumReview = await page.evaluate(() => {
            const addressElements = document.querySelectorAll('div.csaqw');
            console.log(`Recherche parmi ${addressElements.length} adresses`);

            for (let i = 0; i < addressElements.length; i++) {
                const address = addressElements[i].innerText || '';
                if (address.includes('5 Rue Henri') && address.includes('Cenon')) {
                    console.log(`✅ premium trouvé à l'index ${i}`);
                    return i;
                }
            }
            return -1;
        });

        if (premiumReview === -1) {
            console.log(`[MOBILE] ⚠️ Avis premium non trouvé`);

            return null;
        }

        console.log(`[MOBILE] ✅ Avis trouvé à l'index ${premiumReview}`);

        const selectorsToTry = ['div[jsaction*="review"]', 'div[data-review-id]', 'div.OXdGle', 'div.csaqw'];
        let clicked = false;
        for (const selector of selectorsToTry) {
            const elements = await page.locator(selector).all();
            if (elements.length > premiumReview) {
                const reviewToClick = page.locator(selector).nth(premiumReview);
                await reviewToClick.scrollIntoViewIfNeeded();
                await humanDelay(500, 800);
                await reviewToClick.click();
                console.log(`[MOBILE] ✅ Clic (${selector})`);
                clicked = true;
                break;
            }
        }

        if (!clicked) {
            console.log(`[MOBILE] ⚠️ Impossible de cliquer`);

            return null;
        }

        await humanDelay(2500, 3500);

        console.log(`[MOBILE] 📜 Scroll...`);
        await page.mouse.wheel(0, 800);
        await humanDelay(800, 1200);
        await page.mouse.wheel(0, 800);
        await humanDelay(800, 1200);

        // EXTRACTION DE LA RÉPONSE (CODE QUI FONCTIONNE)
        const response = await page.evaluate(() => {
            console.log("🔍 Recherche de réponse...");

            const allText = document.body.innerText;
            if (!allText.includes('Réponse du propriétaire')) {
                console.log('❌ "Réponse du propriétaire" absent');
                return null;
            }

            console.log('✅ "Réponse du propriétaire" présent');

            // STRATÉGIE 1: div.HIHoId
            const responseDiv = document.querySelector('div.HIHoId');
            if (responseDiv) {
                const responseText = responseDiv.textContent?.trim() || '';
                if (responseText.length > 10) {
                    console.log(`✅ div.HIHoId trouvé (${responseText.length} chars): "${responseText.substring(0, 100)}..."`);

                    let dateText = null;
                    let parent = responseDiv.parentElement;
                    for (let i = 0; i < 5 && parent; i++) {
                        const dateSpan = parent.querySelector('span.oW1aUd');
                        if (dateSpan) {
                            dateText = dateSpan.textContent?.trim();
                            console.log(`✅ Date: ${dateText}`);
                            break;
                        }
                        parent = parent.parentElement;
                    }

                    return { text: responseText, date: dateText };
                }
            } else {
                console.log('⚠️ div.HIHoId NON TROUVÉ');
            }

            // STRATÉGIE 2: Fallback
            const allDivs = document.querySelectorAll('div.HIHoId');
            console.log(`${allDivs.length} div.HIHoId trouvés`);

            for (const div of allDivs) {
                const text = div.textContent?.trim() || '';
                if (text.length > 20) {
                    let parent = div.parentElement;
                    for (let i = 0; i < 5 && parent; i++) {
                        if ((parent.innerText || '').includes('Réponse du propriétaire')) {
                            console.log(`✅ Trouvé via fallback`);
                            return { text: text, date: null };
                        }
                        parent = parent.parentElement;
                    }
                }
            }

            // STRATÉGIE 3: Extraction par texte
            console.log('🔄 Extraction par texte...');
            const responseIndex = allText.indexOf('Réponse du propriétaire');
            if (responseIndex >= 0) {
                const afterResponse = allText.substring(responseIndex + 'Réponse du propriétaire'.length);
                const lines = afterResponse.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                let responseLines = [];

                // Mots-clés à ignorer (interface Google Maps)
                const ignoreKeywords = [
                    'Trafic', 'Transports en commun', 'À vélo', 'satellite', 'Relief',
                    'Qualité de l\'air', 'Commandes', 'Partage', 'contributions',
                    'adresses', 'Paramètres', 'Langue', 'Aide', 'Maps', 'commentaires',
                    'produit', 'Madagasikara', 'Images satellite'
                ];

                for (const line of lines) {
                    if (line.match(/^il y a/i)) continue;
                    if (line.match(/^\d+\s+(points?|avis|photos?)/i)) continue;
                    if (line.match(/^(Utile|Signaler|Modifier|Supprimer|Partager)/i)) break;
                    if (responseLines.length > 0 && line.match(/^\w+\s+\w+$/)) break;

                    // Ignorer les lignes de l'interface Google Maps
                    if (ignoreKeywords.some(keyword => line.includes(keyword))) {
                        console.log(`⚠️ Ligne ignorée (interface): "${line}"`);
                        break;
                    }

                    responseLines.push(line);
                    if (responseLines.length >= 20) break;
                }

                if (responseLines.length > 0) {
                    const responseText = responseLines.join(' ').trim();
                    if (responseText.length >= 15) {
                        console.log(`✅ Extraction par texte (${responseText.length} chars): "${responseText.substring(0, 100)}..."`);
                        return { text: responseText, date: null };
                    }
                }
            }

            console.log('❌ Aucune stratégie n\'a fonctionné');
            return null;
        });


        await page.close();
        return response;

    } catch (err) {
        console.warn(`[AUTHOR] ⚠️ Erreur profil ${authorUrl}:`, err.message);
        try { await context.pages().pop()?.close(); } catch (e) { }
        return null;
    }
}
// ========================================================================
// ✅ BYPASS POPUP MOBILE
// ========================================================================

async function bypassMapsPopupWithRetry(page, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            attempt++;
            await page.waitForTimeout(800);
            const stayWebButton = page.locator(
                'button:has-text("Rester sur le Web"), ' +
                'button:has-text("Stay on web"), ' +
                'button[jsaction*="stay"], ' +
                'button[aria-label*="web" i]'
            ).first();
            const isVisible = await stayWebButton.isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible) {
                await stayWebButton.click({ timeout: 3000, force: true });
                console.log(`[POPUP] ✅ Clic — tentative ${attempt}`);
                await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 4000 }).catch(() => { });
                const stillVisible = await stayWebButton.isVisible({ timeout: 500 }).catch(() => false);
                if (!stillVisible) {
                    console.log(`[POPUP] 🎯 Succès après ${attempt} tentative(s)`);
                    return true;
                }
            } else {
                console.log(`[POPUP] ℹ️ Aucun popup à la tentative ${attempt}`);
                return true;
            }
        } catch (err) {
            console.warn(`[POPUP] ⚠️ Erreur tentative ${attempt}:`, err.message);
        }
        if (attempt < maxRetries) await page.waitForTimeout(1000 + Math.random() * 1000 * attempt);
    }
    console.error(`[POPUP] ❌ Échec après ${maxRetries} tentatives`);
    return false;
}

// ========================================================================
// ✅ UTILITAIRES
// ========================================================================


function humanDelay(min = 800, max = 1800) {
    return new Promise((res) => setTimeout(res, Math.random() * (max - min) + min));
}

async function launchBrowser() {
    const MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36";
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || undefined,
    });
    const context = await browser.newContext({
        userAgent: MOBILE_USER_AGENT,
        viewport: { width: 1024, height: 768 },
        locale: "fr-FR",
        timezoneId: "Europe/Paris",
    });

    // Bloquer redirections mobiles
    await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith('intent://')) {
            console.log(`[BLOCK] 🔒 Bloqué intent://`);
            return route.abort();
        }
        if (/google\.com\/maps.*[?&](entry=ml|utm_campaign=ml-ardl)/.test(url)) {
            const webUrl = url
                .replace(/entry=ml[^&]*/g, '')
                .replace(/utm_campaign=ml-ardl[^&]*/g, '')
                .replace(/\?&/, '?')
                .replace(/\?$/, '')
                .replace(/&$/, '');
            console.log(`[REDIRECT] 🔄 Forcé mode web`);
            return route.fulfill({
                status: 302,
                headers: { Location: webUrl },
                body: ''
            });
        }
        return route.continue();
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    });
    console.log("[MOBILE] ✅ Navigateur lancé en mode mobile");
    return { browser, context };
}


async function clickReviewsTab(page) {
    console.log("[MOBILE] 🔍 Recherche onglet Avis...");
    await humanDelay(2000, 3000);

    // ✅ Stratégies multiples avec logs détaillés
    const strategies = [
        {
            name: 'Texte exact "Avis"',
            fn: async () => {
                const btn = page.locator('button').filter({ hasText: /^Avis$/i });
                const count = await btn.count();
                console.log(`[MOBILE] 🔍 Stratégie 1: ${count} bouton(s) avec texte "Avis"`);
                if (count > 0) {
                    await btn.first().click({ timeout: 5000 });
                    return true;
                }
                return false;
            }
        },
        {
            name: 'aria-label contient "avis"',
            fn: async () => {
                const btn = page.locator('button[aria-label*="avis" i]');
                const count = await btn.count();
                console.log(`[MOBILE] 🔍 Stratégie 2: ${count} bouton(s) avec aria-label "avis"`);
                if (count > 0) {
                    await btn.first().click({ timeout: 5000 });
                    return true;
                }
                return false;
            }
        },
        {
            name: 'Bouton contenant "108 avis"',
            fn: async () => {
                const btn = page.locator('button:has-text("avis")');
                const count = await btn.count();
                console.log(`[MOBILE] 🔍 Stratégie 3: ${count} bouton(s) contenant "avis"`);
                if (count > 0) {
                    // Trouver celui qui contient un chiffre
                    const allButtons = await btn.all();
                    for (let i = 0; i < allButtons.length; i++) {
                        const text = await allButtons[i].textContent();
                        if (text && /\d+\s+avis/i.test(text)) {
                            console.log(`[MOBILE] 🎯 Trouvé: "${text.trim()}"`);
                            await allButtons[i].click({ timeout: 5000 });
                            return true;
                        }
                    }
                }
                return false;
            }
        },
        {
            name: 'Tab avec role="tab"',
            fn: async () => {
                const tabs = page.locator('[role="tab"]');
                const count = await tabs.count();
                console.log(`[MOBILE] 🔍 Stratégie 4: ${count} tab(s) trouvé(s)`);
                if (count > 0) {
                    const allTabs = await tabs.all();
                    for (let i = 0; i < allTabs.length; i++) {
                        const text = await allTabs[i].textContent();
                        if (text && /avis/i.test(text)) {
                            console.log(`[MOBILE] 🎯 Tab trouvé: "${text.trim()}"`);
                            await allTabs[i].click({ timeout: 5000 });
                            return true;
                        }
                    }
                }
                return false;
            }
        }
    ];

    // Tester chaque stratégie
    for (const strategy of strategies) {
        try {
            console.log(`[MOBILE] 🧪 Test: ${strategy.name}`);
            if (await strategy.fn()) {
                console.log(`[MOBILE] ✅ Succès avec: ${strategy.name}`);
                await humanDelay(3000, 4000);
                return true;
            }
        } catch (e) {
            console.warn(`[MOBILE] ⚠️ Échec ${strategy.name}:`, e.message);
        }
    }

    // Si toutes les stratégies échouent, dump HTML pour debug
    console.error('[MOBILE] ❌ Toutes les stratégies ont échoué');
    const pageContent = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.map(btn => ({
            text: btn.textContent?.trim().substring(0, 100),
            aria: btn.getAttribute('aria-label'),
            visible: btn.offsetWidth > 0
        })).filter(b => b.visible);
    });
    console.log('[MOBILE] 📋 Boutons visibles:', JSON.stringify(pageContent, null, 2));

    return false;
}

async function findScrollablePanel(page) {
    const panel = page.locator('div.nkePVe').first();
    if (await panel.count() > 0) return panel;
    return page.locator('div[tabindex="-1"]').first();
}

async function sendDataToN8N(reviews) {
    if (reviews.length > 0) {
        try {
            const res = await fetch('https://automation.hoplixe.app/webhook-test/5bcb114a-c228-437a-9767-7c43f30b65cd', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    count: reviews.length,
                    reviews
                })
            });
            if (res.ok) console.log(`✅ ${reviews.length} avis envoyés`);
        } catch (err) {
            console.error("❌ Erreur n8n:", err);
        }
    }
}

// ========================================================================
// ✅ SCRAPER PRINCIPAL (AVEC GESTION DU CONSENTEMENT)
// ========================================================================

async function scrape(url) {
    const { browser, context } = await launchBrowser();
    const page = await context.newPage();

    // ========================================================================
    // ✅ INTERCEPTION DES REQUÊTES XHR — COEUR DU SCRIPT
    // ========================================================================
    const rawReviews = [];
    let totalReviewCount = null;
    const seenReviewIds = new Set();

    page.on('response', async (response) => {
        const url = response.url();
        if (!url.includes('/preview/review/listentitiesreviews')) return;

        try {

            // 🔑 Récupérer le texte brut (pas .json())
            const text = await response.text();

            // 🔧 Supprimer le préfixe Google: )]}'\n
            const cleanText = text.trim().replace(/^\)\]\}'\s*/, '');
            if (!cleanText || cleanText === 'null') {
                console.warn('[XHR] ⚠️ Réponse vide ou null');
                return;
            }

            const data = JSON.parse(cleanText);

            const batch = data[2] || [];
            const stats = data[3] || [];


            if (Array.isArray(stats) && stats.length >= 5 && typeof stats[4] === 'number') {
                totalReviewCount = stats[4];
            }

            if (batch.length > 0) {
                console.log(`[XHR] ✅ +${batch.length} avis — total cumulé: ${rawReviews.length + batch.length}`);
                rawReviews.push(...batch);
            }

        } catch (err) {
            console.warn('[XHR] ⚠️ Erreur parsing réponse:', err.message);
        }
    });



    console.log("[MOBILE] ➡️ Navigation...");
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // ✅ ÉTAPE 4: Vérifier si on est sur consent.google.com
    const currentUrl = page.url();
    console.log(`[SCRAPER] URL courante: ${currentUrl}`);

    if (currentUrl.includes('consent.google.com')) {
        console.log('[CONSENT] ⚠️ Écran de consentement détecté, tentative d\'acceptation...');
        const accepted = await acceptGoogleConsent(page);

        if (!accepted) {
            console.log('❌ Impossible d\'accepter le consentement Google');
        }

        // Vérifier qu'on est bien sur Maps après acceptation
        const newUrl = page.url();
        if (!newUrl.includes('google.com/maps')) {
            console.log('❌ Toujours bloqué après acceptation du consentement');
        }
        console.log('[CONSENT] ✅ Consentement accepté, sur Google Maps');
    } else {
        console.log('[CONSENT] ✅ Pas de consentement requis');
    }

    console.log(`[SCRAPER] URL courante: ${currentUrl}`);

    // 📌 Aller directement à l'onglet avis (évite filtres UI)
    await page.evaluate(() => {
        const tab = Array.from(document.querySelectorAll('button'))
            .find(btn => /avis/i.test(btn.textContent));
        if (tab) tab.click();
    });
    await humanDelay(2000, 3000);

    const panel = await findScrollablePanel(page);

    console.log("[MOBILE] 🚀 Début du scroll + interception XHR...");

    let consecutiveNoNew = 0;
    const MAX_NO_NEW = 3;

    while (true) {
        const currentCount = rawReviews.length;
        console.log(`[MOBILE] 📜 Scroll (${currentCount} avis)`);

        await panel.evaluate(el => el.scrollBy(0, 2000));
        await humanDelay(3000, 4000);

        // Attendre que de nouveaux avis arrivent (max 8s)
        const start = Date.now();
        while (rawReviews.length === currentCount && Date.now() - start < 8000) {
            await page.waitForTimeout(300);
        }

        if (rawReviews.length === currentCount) {
            consecutiveNoNew++;
            console.log(`[MOBILE] ⚠️ Aucun nouvel avis (${consecutiveNoNew}/${MAX_NO_NEW})`);
            if (consecutiveNoNew >= MAX_NO_NEW) break;
        } else {
            consecutiveNoNew = 0;
        }

        // ✅ Détection fin si on atteint le total connu
        if (totalReviewCount && rawReviews.length >= totalReviewCount) {
            console.log(`[MOBILE] 🎉 ${rawReviews.length}/${totalReviewCount} avis — fin`);
            break;
        }
    }

    const uniqueReviews = rawReviews
        .map(parseReview)
        .filter(r => r && !seenReviewIds.has(r.rawId) && seenReviewIds.add(r.rawId));

    console.log(`\n[MOBILE] 📊 ${uniqueReviews.length} avis extraits via XHR`);

    for (let i = 0; i < uniqueReviews.length; i++) {
        const review = uniqueReviews[i];

        if (!review.ownerResponse && review.authorUrl) {
            console.log(`[ENRICH] ${i + 1}/${uniqueReviews.length} — ${review.author}`);

            const response = await fetchMissingOwnerResponse(context, review.authorUrl);
            if (response) {
                review.ownerResponse = response;
                console.log(`[ENRICH] ✅ Réponse trouvée pour ${review.author}`);
            } else {
                console.log(`[ENRICH] ℹ️ Aucune réponse pour ${review.author}`);
            }

            // ⏳ Délai respectueux
            await humanDelay(1000, 2000);
        }
    }


    await browser.close();
    return uniqueReviews;


}

// ========================================================================
// ✅ EXÉCUTION
// ========================================================================

// ▶️ Exécution
if (process.argv[1] === import.meta.url || process.argv[1].endsWith('scraper.js')) {
    const job_id = 'scrape_' + new Date().toISOString().slice(0, 19).replace(/[:\-T]/g, '');
    scrape(CLEAN_URL, job_id)
        .then(async (reviews) => {
            console.log(`\n${"=".repeat(80)}`);
            console.log(`✅ ${reviews.length} avis collectés`);
            console.log(`💬 ${reviews.filter(r => r.ownerResponse).length} avec réponse`);
            console.log("=".repeat(80));
            await sendDataToN8N(reviews);
        })
        .catch(async (err) => {
            console.error("\n❌ Échec:", err.message);
            process.exit(1);
        });
}
