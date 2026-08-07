ARG NODE_IMAGE=node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436
FROM ${NODE_IMAGE} AS build

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

RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --no-audit --no-fund

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
RUN npm run build --workspace @neuro/account-domain --ignore-scripts
RUN npm run build --workspace @neuro/worker
RUN npm prune --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE} AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/packages/backend-foundation /app/packages/backend-foundation
COPY --from=build --chown=node:node /app/packages/account-domain /app/packages/account-domain
COPY --from=build --chown=node:node /app/packages/ai-gateway-domain /app/packages/ai-gateway-domain
COPY --from=build --chown=node:node /app/packages/contracts /app/packages/contracts
COPY --from=build --chown=node:node /app/worker /app/worker

WORKDIR /app/worker
USER node
EXPOSE 7301
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:7301/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["npm", "run", "start"]
