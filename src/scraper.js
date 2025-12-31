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
            await page.waitForURL(/google\.com\/maps/, { timeout: 15000 });
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
        try {
            const consentErrorScreenshot = await page.screenshot({ type: 'png', fullPage: true });
            console.log(`[SCREENSHOT:consent-error] image/png;base64,${consentErrorScreenshot.toString('base64')}`);
        } catch (e) { }

        return false;
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

async function debugPageHTML(page, label = "state") {
    try {
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button'))
                .filter(btn => {
                    const style = window.getComputedStyle(btn);
                    return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetWidth > 0;
                })
                .map(btn => ({
                    text: btn.innerText.trim(),
                    ariaLabel: btn.getAttribute('aria-label') || '',
                    dataId: btn.getAttribute('data-id') || '',
                    jsname: btn.getAttribute('jsname') || ''
                }))
                .filter(btn => btn.text || btn.ariaLabel);
        });

        if (buttons.length === 0) {
            console.log(`[BUTTONS:${label}] ❌ Aucun bouton visible`);
        } else {
            console.log(`[BUTTONS:${label}] ✅ ${buttons.length} bouton(s) trouvé(s):`);
            buttons.forEach((btn, i) => {
                console.log(`  ${i + 1}. "${btn.text}" | aria="${btn.ariaLabel}" | jsname="${btn.jsname}"`);
            });
        }
    } catch (err) {
        console.warn(`[BUTTONS:${label}] ⚠️ Erreur:`, err.message);
    }
}
function generateStableReviewId(author, date, text, fallbackId) {
    if (fallbackId) return fallbackId;
    const input = `${author || ''}|${date || ''}|${(text || '').substring(0, 200)}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function humanDelay(min = 800, max = 1800) {
    return new Promise((res) => setTimeout(res, Math.random() * (max - min) + min));
}

async function launchBrowser() {
    const MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 10; SM-G970F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
    const browser = await chromium.launch({
        headless: false,
        executablePath: process.env.CHROME_PATH || undefined,
    });
    const context = await browser.newContext({
        userAgent: MOBILE_USER_AGENT,
        viewport: { width: 375, height: 768 },
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

        // 🔥 Supprimer les spinners Google Wiz (non intrusif, safe)
        const observer = new MutationObserver(() => {
            document.querySelectorAll('.wiz-spinner, [jsname="wiz-spinner"]').forEach(el => {
                if (el.style.display !== 'none') {
                    el.style.display = 'none';
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
    console.log("[MOBILE] ✅ Navigateur lancé en mode mobile");
    return { browser, context };
}

async function diagnosePage(page) {
    return await page.evaluate(() => {
        const count = document.querySelectorAll('div.hjmQqc').length;
        const authors = [...document.querySelectorAll('.IaK8zc.CVo7Bb')].slice(0, 3).map(el => el.textContent?.trim());
        return { version: count > 0 ? 'mobile' : 'unknown', reviewCount: count, sampleAuthors: authors, url: window.location.href };
    });
}

async function clickReviewAndGetResponse(page, reviewElement, index) {
    try {
        console.log(`[MOBILE] 🔍 Traitement de l'avis #${index}...`);
        await reviewElement.scrollIntoViewIfNeeded();
        await humanDelay(300, 500);

        const authorButton = reviewElement.locator('.IaK8zc.CVo7Bb, button.IaK8zc').first();
        if (await authorButton.count() === 0) {
            console.log(`[MOBILE] ⚠️ Impossible de trouver le nom de l'utilisateur`);
            return null;
        }

        await authorButton.click();
        console.log(`[MOBILE] ✅ Clic sur le nom de l'utilisateur`);
        await humanDelay(2000, 3000);

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

            // RETOUR AVEC LA MÊME LOGIQUE QUE LE RESTE DU CODE
            console.log(`[MOBILE] ⬅️ Retour en arrière (utilisateur sans avis)...`);

            // Premier retour: fermer le profil utilisateur
            let firstBack = false;
            try {
                const backBtn = page.locator('button.wrp8Qd, button[class*="wrp8Qd"]').first();
                if (await backBtn.count() > 0) {
                    await backBtn.click({ timeout: 2000, force: true });
                    console.log(`[MOBILE] ✅ Retour avec bouton`);
                    firstBack = true;
                }
            } catch (e) { }

            if (!firstBack) {
                await page.keyboard.press('Escape');
                console.log(`[MOBILE] ✅ Retour avec Escape`);
            }
            await humanDelay(2000, 3000);

            // Vérifier qu'on est bien revenu
            const backOnList = await page.evaluate(() => {
                const count = document.querySelectorAll('div.hjmQqc').length;
                console.log(`Vérification: ${count} avis visibles`);
                return count > 0;
            });

            if (!backOnList) {
                console.log(`[MOBILE] ⚠️ Pas revenu sur la liste, tentative de récupération...`);
                await page.keyboard.press('Escape');
                await humanDelay(1500, 2000);
            } else {
                console.log(`[MOBILE] ✅ De retour sur la liste des avis`);
            }

            return null;
        }

        console.log(`[MOBILE] ✅ L'utilisateur a des avis`);
        await humanDelay(2000, 3000);

        const securicarReview = await page.evaluate(() => {
            const addressElements = document.querySelectorAll('div.csaqw');
            console.log(`Recherche parmi ${addressElements.length} adresses`);

            for (let i = 0; i < addressElements.length; i++) {
                const address = addressElements[i].innerText || '';
                if (address.includes('5 Rue Henri') && address.includes('Cenon')) {
                    console.log(`✅ SecuriCar trouvé à l'index ${i}`);
                    return i;
                }
            }
            return -1;
        });

        if (securicarReview === -1) {
            console.log(`[MOBILE] ⚠️ Avis SecuriCar non trouvé`);

            // RETOUR AVEC BOUTON/ESCAPE
            console.log(`[MOBILE] ⬅️ Retour en arrière...`);

            let backSuccess = false;
            try {
                const backBtn = page.locator('button.wrp8Qd, button[class*="wrp8Qd"]').first();
                if (await backBtn.count() > 0) {
                    await backBtn.click({ timeout: 2000, force: true });
                    console.log(`[MOBILE] ✅ Retour avec bouton`);
                    backSuccess = true;
                }
            } catch (e) { }

            if (!backSuccess) {
                await page.keyboard.press('Escape');
                console.log(`[MOBILE] ✅ Retour avec Escape`);
            }
            await humanDelay(2000, 3000);

            // Vérifier retour
            const backOnList = await page.evaluate(() => {
                const count = document.querySelectorAll('div.hjmQqc').length;
                console.log(`Vérification: ${count} avis visibles`);
                return count > 0;
            });

            if (!backOnList) {
                console.log(`[MOBILE] ⚠️ Pas revenu sur la liste, tentative supplémentaire...`);
                await page.keyboard.press('Escape');
                await humanDelay(1500, 2000);
            } else {
                console.log(`[MOBILE] ✅ De retour sur la liste des avis`);
            }

            return null;
        }

        console.log(`[MOBILE] ✅ Avis trouvé à l'index ${securicarReview}`);

        const selectorsToTry = ['div[jsaction*="review"]', 'div[data-review-id]', 'div.OXdGle', 'div.csaqw'];
        let clicked = false;
        for (const selector of selectorsToTry) {
            const elements = await page.locator(selector).all();
            if (elements.length > securicarReview) {
                const reviewToClick = page.locator(selector).nth(securicarReview);
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

            // RETOUR AVEC BOUTON/ESCAPE
            console.log(`[MOBILE] ⬅️ Retour en arrière...`);

            let backSuccess = false;
            try {
                const backBtn = page.locator('button.wrp8Qd, button[class*="wrp8Qd"]').first();
                if (await backBtn.count() > 0) {
                    await backBtn.click({ timeout: 2000, force: true });
                    console.log(`[MOBILE] ✅ Retour avec bouton`);
                    backSuccess = true;
                }
            } catch (e) { }

            if (!backSuccess) {
                await page.keyboard.press('Escape');
                console.log(`[MOBILE] ✅ Retour avec Escape`);
            }
            await humanDelay(2000, 3000);

            // Vérifier retour
            const backOnList = await page.evaluate(() => {
                const count = document.querySelectorAll('div.hjmQqc').length;
                console.log(`Vérification: ${count} avis visibles`);
                return count > 0;
            });

            if (!backOnList) {
                console.log(`[MOBILE] ⚠️ Pas revenu sur la liste, tentative supplémentaire...`);
                await page.keyboard.press('Escape');
                await humanDelay(1500, 2000);
            } else {
                console.log(`[MOBILE] ✅ De retour sur la liste des avis`);
            }

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

        // Retour en arrière (2 fois)
        console.log(`[MOBILE] ⬅️ Retour en arrière...`);

        let firstBack = false;
        try {
            const backBtn = page.locator('button.wrp8Qd, button[class*="wrp8Qd"]').first();
            if (await backBtn.count() > 0) {
                await backBtn.click({ timeout: 2000, force: true });
                console.log(`[MOBILE] ✅ Premier retour avec bouton`);
                firstBack = true;
            }
        } catch (e) { }

        if (!firstBack) {
            await page.keyboard.press('Escape');
            console.log(`[MOBILE] ✅ Premier retour avec Escape`);
        }
        await humanDelay(2000, 3000);

        let secondBack = false;
        try {
            const backBtn = page.locator('button.wrp8Qd, button[class*="wrp8Qd"]').first();
            if (await backBtn.count() > 0) {
                await backBtn.click({ timeout: 2000, force: true });
                console.log(`[MOBILE] ✅ Deuxième retour avec bouton`);
                secondBack = true;
            }
        } catch (e) { }

        if (!secondBack) {
            await page.keyboard.press('Escape');
            console.log(`[MOBILE] ✅ Deuxième retour avec Escape`);
        }
        await humanDelay(2000, 3000);

        const backOnList = await page.evaluate(() => {
            const count = document.querySelectorAll('div.hjmQqc').length;
            console.log(`Vérification: ${count} avis visibles`);
            return count > 0;
        });

        if (!backOnList) {
            console.log(`[MOBILE] ⚠️ Pas revenu sur la liste, tentative de récupération...`);
            await page.keyboard.press('Escape');
            await humanDelay(1500, 2000);
        } else {
            console.log(`[MOBILE] ✅ De retour sur la liste des avis`);
        }

        if (response) {
            console.log(`[MOBILE] ✅ Réponse trouvée`);
        } else {
            console.log(`[MOBILE] ℹ️ Pas de réponse`);
        }

        return response;

    } catch (error) {
        console.log(`[MOBILE] ⚠️ Erreur: ${error.message}`);

        // Tentative de récupération avec boutons + Escape
        console.log(`[MOBILE] 🔄 Tentative de récupération...`);

        try {
            const backBtn = page.locator('button.wrp8Qd, button[class*="wrp8Qd"]').first();
            if (await backBtn.count() > 0) {
                await backBtn.click({ timeout: 2000 });
                await humanDelay(1500, 2000);
            }
        } catch (e) { }

        await page.keyboard.press('Escape');
        await humanDelay(1000, 1500);
        await page.keyboard.press('Escape');
        await humanDelay(1000, 1500);

        return null;
    }
}
async function handleMobilePopup(page) {
    try {
        const stayWebButton = page.getByRole('button', { name: /Rester sur le Web|Stay on web/i });
        if (await stayWebButton.count() > 0) {
            await stayWebButton.click();
            await humanDelay(1500, 2500);
        }
    } catch (e) {
        console.log('[POPUP]', e);

    }
}

async function getTotalReviewCount(page) {
    return await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/(\d+)\s+avis/i);
        return match ? parseInt(match[1], 10) : null;
    });
}

async function clickReviewsTab(page) {
    console.log("[MOBILE] 🔍 Clic sur onglet Avis...");
    await humanDelay(2000, 3000);

    const strategies = [
        async () => {
            const btn = page.locator('button').filter({ hasText: /^Avis$/i });
            if (await btn.count() > 0) {
                await btn.first().click({ timeout: 5000 });
                return true;
            }
            return false;
        },
        async () => {
            const btn = page.locator('button[aria-label*="avis" i]');
            if (await btn.count() > 0) {
                await btn.first().click({ timeout: 5000 });
                return true;
            }
            return false;
        }
    ];

    for (const strategy of strategies) {
        try {
            if (await strategy()) {
                console.log(`[MOBILE] ✅ Onglet cliqué`);
                await humanDelay(3000, 4000);
                return true;
            }
        } catch (e) { }
    }
    return false;
}

async function ensureAllReviewsVisible(page) {
    try {
        await humanDelay(1500, 2000);
        const sortButton = page.locator('button[aria-label*="Trier"]').first();
        if (await sortButton.count() > 0) {
            await sortButton.click();
            await humanDelay(1000, 1500);
            const newestOption = page.locator('div[role="menuitemradio"]:has-text("récents")').first();
            if (await newestOption.count() > 0) {
                await newestOption.click();
                await humanDelay(2000, 3000);
            }
        }
    } catch (e) { }
}

async function findScrollablePanel(page) {
    const panel = page.locator('div.nkePVe').first();
    if (await panel.count() > 0) return panel;
    return page.locator('div[tabindex="-1"]').first();
}

// ========================================================================
// ✅ SCRAPER PRINCIPAL (AVEC GESTION DU CONSENTEMENT)
// ========================================================================
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

async function scrape(url) {
    const { browser, context } = await launchBrowser();
    const page = await context.newPage();
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

    try {
        // ✅ ÉTAPE 1: Injecter cookie CONSENT
        await page.context().addCookies([
            {
                name: 'CONSENT',
                value: 'YES+cb.20210720-07-p0.fr+FX+410',
                domain: '.google.com',
                path: '/',
                expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
                httpOnly: false,
                secure: true,
                sameSite: 'Lax'
            }
        ]);
        console.log('[COOKIE] ✅ Cookie CONSENT injecté');

        // ✅ ÉTAPE 2: Navigation
        console.log("[MOBILE] ➡️ Navigation...");
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // ✅ ÉTAPE 4: Vérifier si on est sur consent.google.com
        const currentUrl = page.url();
        console.log(`[SCRAPER] URL courante: ${currentUrl}`);

        if (currentUrl.includes('consent.google.com')) {
            console.log('[CONSENT] ⚠️ Écran de consentement détecté, tentative d\'acceptation...');
            const accepted = await acceptGoogleConsent(page);

            if (!accepted) {
                throw new Error('❌ Impossible d\'accepter le consentement Google');
            }

            // Vérifier qu'on est bien sur Maps après acceptation
            const newUrl = page.url();
            if (!newUrl.includes('google.com/maps')) {
                throw new Error('❌ Toujours bloqué après acceptation du consentement');
            }
            console.log('[CONSENT] ✅ Consentement accepté, sur Google Maps');
        } else {
            console.log('[CONSENT] ✅ Pas de consentement requis');
        }

        await handleMobilePopup(page);
        await bypassMapsPopupWithRetry(page)

        await clickReviewsTab(page);
        await ensureAllReviewsVisible(page);

        // ✅ ÉTAPE 11: Diagnostics
        const diagnostics = await diagnosePage(page);
        const totalExpected = await getTotalReviewCount(page);
        console.log(`[MOBILE] 📊 ${diagnostics.reviewCount} visibles / ${totalExpected || '?'} total`);
        console.log(`[MOBILE] 🎯 Objectif: Collecter TOUS les ${totalExpected} avis`);

        const panel = await findScrollablePanel(page);

        console.log("[MOBILE] 🚀 Scraping démarré");
        console.log(`[MOBILE] 🎯 Objectif: Collecter ${totalExpected || '?'} avis`);

        // ... Suite du scraping (code existant)

        const reviewsMap = new Map();
        let currentIndex = 0;
        let consecutiveNoNewReviews = 0;
        const MAX_CONSECUTIVE_FAILS = 5;
        console.log("[MOBILE] 🚀 Scraping démarré");

        // Prendre une capture d'écran et retourner la base64 ici
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const screenshotBase64 = screenshotBuffer.toString('base64');
        console.log(`[MOBILE] 📸 Screenshot (base64 longueur=${screenshotBase64.length})`);
        //console.log(`[MOBILE] 📸 Screenshot (base64 ${screenshotBase64})`);

        while (true) {
            const reviewNodes = await page.locator('div.hjmQqc').all();
            console.log(reviewNodes.length);


            if (currentIndex >= reviewNodes.length) {
                console.log(`[MOBILE] 📜 Scroll... (${reviewsMap.size}/${totalExpected || '?'} traités)`);
                await panel.evaluate(el => el.scrollBy(0, 1500));
                await humanDelay(3000, 4000);

                const newCount = await page.locator('div.hjmQqc').count();

                if (newCount <= reviewNodes.length) {
                    consecutiveNoNewReviews++;
                    console.log(`[MOBILE] ⚠️ Pas de nouveaux avis (${consecutiveNoNewReviews}/${MAX_CONSECUTIVE_FAILS})`);

                    if (consecutiveNoNewReviews >= MAX_CONSECUTIVE_FAILS) {
                        console.log(`[MOBILE] ✅ Fin: ${MAX_CONSECUTIVE_FAILS} scrolls sans nouveaux avis`);
                        break;
                    }
                } else {
                    consecutiveNoNewReviews = 0;
                    console.log(`[MOBILE] ✅ ${newCount - reviewNodes.length} nouveaux avis chargés`);
                }
                continue;
            }

            const reviewNode = reviewNodes[currentIndex];
            const reviewData = await reviewNode.evaluate(el => ({
                author: el.querySelector('.IaK8zc.CVo7Bb')?.textContent?.trim() || '',
                date: el.querySelector('.bHyEBc')?.textContent?.trim() || '',
                rating: parseInt(el.querySelector('.HeTgld')?.getAttribute('aria-label')?.match(/(\d+)/)?.[1] || '0', 10),
                text: el.querySelector('.d5K5Pd')?.textContent?.trim() || '',
                rawId: el.getAttribute('data-review-id') || null
            }));

            const id = generateStableReviewId(reviewData.author, reviewData.date, reviewData.text, reviewData.rawId);

            if (reviewsMap.has(id)) {
                console.log(`[MOBILE] ⏭️ Avis déjà traité: ${reviewData.author}`);
                currentIndex++;
                continue;
            }

            const progressPercent = totalExpected ? Math.round((reviewsMap.size / totalExpected) * 100) : '?';
            console.log(`[MOBILE] 🔍 Avis #${reviewsMap.size + 1}/${totalExpected || '?'} (${progressPercent}%) — ${reviewData.author}`);

            const ownerResponse = await clickReviewAndGetResponse(page, reviewNode, reviewsMap.size + 1);
            reviewsMap.set(id, { ...reviewData, ownerResponse });
            currentIndex++;

            if (totalExpected && reviewsMap.size >= totalExpected) {
                console.log(`\n[MOBILE] 🎉 Tous les avis collectés (${reviewsMap.size}/${totalExpected})`);
                break;
            }

            // Vérification de l'état de la page
            await humanDelay(1000, 1500);
            const currentState = await diagnosePage(page);
            console.log(`[MOBILE] 📊 État: ${currentState.reviewCount} avis visibles`);

            if (currentState.reviewCount === 0) {
                console.log(`[MOBILE] ⚠️ Liste perdue, restauration...`);
                await clickReviewsTab(page);
                await humanDelay(3000, 4000);

                // Vérifier que la restauration a fonctionné
                const restoredState = await diagnosePage(page);
                if (restoredState.reviewCount > 0) {
                    console.log(`[MOBILE] ✅ Liste restaurée: ${restoredState.reviewCount} avis visibles`);
                    currentIndex = 0;
                    consecutiveNoNewReviews = 0;
                } else {
                    console.log(`[MOBILE] ❌ Impossible de restaurer la liste`);
                    break;
                }
            }

            await humanDelay(1000, 1500);
        }


        const reviews = Array.from(reviewsMap.values());
        console.log(`\n[MOBILE] 📊 ${reviews.length}/${totalExpected || '?'} avis collectés`);
        await browser.close();
        await sendDataToN8N(reviews);
        return reviews;

    } catch (error) {
        console.error("[MOBILE] ❌ Erreur:", error.message);

        await browser.close();
        throw error;
    }
}

// ========================================================================
// ✅ EXÉCUTION
// ========================================================================

scrape(CLEAN_URL)
    .then(reviews => {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`✅ ${reviews.length} avis collectés`);
        console.log("=".repeat(80));
    })
    .catch(err => {
        console.error("\n❌ Échec:", err.message);
        process.exit(1);
    });