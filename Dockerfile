FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --fetch-retries=1 --fetch-timeout=15000
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --offline

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
RUN chmod -R a+rX /app
USER node
ENTRYPOINT ["node", "dist/cli.js"]
