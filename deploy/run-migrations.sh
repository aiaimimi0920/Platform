#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-neuroloom}"
IMAGE="${IMAGE:-ghcr.io/example/neuroloom-core:latest}"
ACCOUNT_IMAGE="${ACCOUNT_IMAGE:-ghcr.io/example/neuroloom-account-api:latest}"
JOB_NAME="neuroloom-db-migrate-$(date +%s)"
ACCOUNT_JOB_NAME="neuroloom-account-db-migrate-$(date +%s)"

kubectl create job "${JOB_NAME}" \
  --namespace "${NAMESPACE}" \
  --image "${IMAGE}" \
  -- /bin/sh -c "cd /app/core && npm run db:migrate"

kubectl wait --namespace "${NAMESPACE}" --for=condition=complete "job/${JOB_NAME}" --timeout=10m

kubectl create job "${ACCOUNT_JOB_NAME}" \
  --namespace "${NAMESPACE}" \
  --image "${ACCOUNT_IMAGE}" \
  -- /bin/sh -c "cd /app && npm run db:migrate --workspace @neuro/ai-gateway-domain && npm run db:migrate --workspace @neuro/account-domain"

kubectl wait --namespace "${NAMESPACE}" --for=condition=complete "job/${ACCOUNT_JOB_NAME}" --timeout=10m
