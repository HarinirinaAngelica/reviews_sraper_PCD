#!/bin/bash
set -e

echo "✅ Scraper démarré"
echo "🔄 Exécution toutes les 4h (14400 secondes)"

while true; do
  echo "⏰ $(date -Iseconds) → Lancement du scraping..."
  npm start
  echo "✅ $(date -Iseconds) → Scraping terminé. Attente 4h..."
  sleep 14400
done