# Use Evolution API official image. Pin a known-stable tag — bump cautiously
# após validar mudanças em https://github.com/EvolutionAPI/evolution-api/releases
FROM atendai/evolution-api:v2.3.7

# Railway expõe PORT automaticamente; Evolution respeita SERVER_PORT env.
# (Imagem já vem com EXPOSE 8080.)
ENV NODE_ENV=production
