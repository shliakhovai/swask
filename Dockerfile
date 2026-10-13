FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN HUSKY=0 npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/lib/tasks.ts src/lib/date.ts src/lib/sync-protocol.ts ./src/lib/
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
