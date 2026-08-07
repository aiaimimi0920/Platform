FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/backend-foundation/package.json packages/backend-foundation/package.json
COPY packages/account-domain/package.json packages/account-domain/package.json
COPY packages/ai-gateway-domain/package.json packages/ai-gateway-domain/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY core/package.json core/package.json
COPY executor/package.json executor/package.json
COPY services/account-api/package.json services/account-api/package.json
COPY services/account-worker/package.json services/account-worker/package.json
COPY worker/package.json worker/package.json
COPY web/package.json web/package.json

RUN npm ci

COPY packages/backend-foundation packages/backend-foundation
COPY packages/account-domain packages/account-domain
COPY packages/ai-gateway-domain packages/ai-gateway-domain
COPY packages/contracts packages/contracts
COPY core core
COPY executor executor
COPY services/account-api services/account-api
COPY services/account-worker services/account-worker
COPY worker worker
COPY web web

RUN npm run build --workspace @neuro/contracts
RUN npm run build --workspace @neuro/backend-foundation
RUN npm run build --workspace @neuro/ai-gateway-domain
RUN npm run build --workspace @neuro/account-domain
RUN npm run build --workspace @neuro/account-api
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/packages/backend-foundation /app/packages/backend-foundation
COPY --from=build --chown=node:node /app/packages/account-domain /app/packages/account-domain
COPY --from=build --chown=node:node /app/packages/ai-gateway-domain /app/packages/ai-gateway-domain
COPY --from=build --chown=node:node /app/packages/contracts /app/packages/contracts
COPY --from=build --chown=node:node /app/services/account-api /app/services/account-api

WORKDIR /app/services/account-api
USER node
EXPOSE 4000
CMD ["npm", "run", "start"]
