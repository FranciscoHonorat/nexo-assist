FROM node:24-alpine AS construcao
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN touch VERSAO && npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=construcao /app/dist dist
COPY --from=construcao /app/web/dist web/dist
COPY --from=construcao /app/VERSAO VERSAO
COPY drizzle drizzle
USER node
CMD ["node", "dist/composicao/principal.js"]
