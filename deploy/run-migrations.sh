#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-neuroloom-production}"
: "${IMAGE:?Set IMAGE to a digest-pinned core image, for example ghcr.io/aiaimimi0920/neuroloom-platform-core@sha256:<digest>}"
: "${ACCOUNT_IMAGE:?Set ACCOUNT_IMAGE to a digest-pinned account-api image, for example ghcr.io/aiaimimi0920/neuroloom-platform-account-api@sha256:<digest>}"

if [[ "${IMAGE}" != *@sha256:* || "${ACCOUNT_IMAGE}" != *@sha256:* ]]; then
  echo "IMAGE and ACCOUNT_IMAGE must be digest-pinned." >&2
  exit 1
fi

JOB_NAME="neuroloom-db-migrate-$(date +%s)"
GATEWAY_JOB_NAME="neuroloom-gateway-db-migrate-$(date +%s)"
ACCOUNT_JOB_NAME="neuroloom-account-db-migrate-$(date +%s)"

kubectl create job "${JOB_NAME}" \
  --namespace "${NAMESPACE}" \
  --image "${IMAGE}" \
  -- /bin/sh -c "cd /app && npm run db:migrate --workspace @neuro/core"

kubectl wait --namespace "${NAMESPACE}" --for=condition=complete "job/${JOB_NAME}" --timeout=10m

kubectl create job "${GATEWAY_JOB_NAME}" \
  --namespace "${NAMESPACE}" \
  --image "${ACCOUNT_IMAGE}" \
  -- /bin/sh -c "cd /app && npm run db:migrate --workspace @neuro/ai-gateway-domain"

kubectl wait --namespace "${NAMESPACE}" --for=condition=complete "job/${GATEWAY_JOB_NAME}" --timeout=10m

kubectl create job "${ACCOUNT_JOB_NAME}" \
  --namespace "${NAMESPACE}" \
  --image "${ACCOUNT_IMAGE}" \
  -- /bin/sh -c "cd /app && npm run db:migrate --workspace @neuro/account-domain"

kubectl wait --namespace "${NAMESPACE}" --for=condition=complete "job/${ACCOUNT_JOB_NAME}" --timeout=10m
