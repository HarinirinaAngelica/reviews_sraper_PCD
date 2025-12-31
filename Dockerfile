FROM mcr.microsoft.com/playwright:v1.57.0-jammy

# Création utilisateur non-root
RUN groupadd -r appuser && useradd -r -g appuser appuser
WORKDIR /app

# Dépendances
COPY package*.json ./
RUN npm ci --omit=dev

# Code
COPY . .

# Entrypoint (copié avant USER)
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Permissions
RUN chown -R appuser:appuser /app
USER appuser

CMD ["/app/entrypoint.sh"]