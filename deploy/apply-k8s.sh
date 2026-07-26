#!/usr/bin/env bash
set -euo pipefail

OVERLAY="${1:-production}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OVERLAY_DIR="${ROOT_DIR}/infra/k8s/overlays/${OVERLAY}"
RENDERED="$(mktemp "${TMPDIR:-/tmp}/neuroloom-k8s-${OVERLAY}.XXXXXX.yaml")"
TIMEOUT="${KUBECTL_TIMEOUT:-10m}"
SMOKE_IMAGE="${SMOKE_IMAGE:-curlimages/curl:8.11.1}"

cleanup() {
  rm -f "${RENDERED}"
}
trap cleanup EXIT

case "${OVERLAY}" in
  staging|production) ;;
  *)
    echo "Unsupported overlay: ${OVERLAY}. Expected staging or production." >&2
    exit 2
    ;;
esac

if [[ ! -d "${OVERLAY_DIR}" ]]; then
  echo "Missing overlay directory: ${OVERLAY_DIR}" >&2
  exit 2
fi

NAME_PREFIX="$(awk '/^namePrefix:/ { print $2; exit }' "${OVERLAY_DIR}/kustomization.yaml")"
if [[ -z "${NAME_PREFIX}" ]]; then
  echo "Overlay ${OVERLAY} must define namePrefix." >&2
  exit 1
fi

echo "Rendering ${OVERLAY} Kustomize overlay..." >&2
kubectl kustomize "${OVERLAY_DIR}" > "${RENDERED}"

PLACEHOLDER_PATTERN='example\.com|replace-me|ghcr\.io/example|:latest'
if grep -E "${PLACEHOLDER_PATTERN}" "${RENDERED}" >/dev/null; then
  echo "Rendered manifest still contains placeholder/example/latest values:" >&2
  grep -nE "${PLACEHOLDER_PATTERN}" "${RENDERED}" >&2
  exit 1
fi

if ! grep -E '@sha256:[a-f0-9]{64}' "${RENDERED}" >/dev/null; then
  echo "Rendered manifest does not contain digest-pinned images." >&2
  exit 1
fi

NAMESPACE="$(awk '/^kind: Namespace$/ { in_namespace=1; next } in_namespace && /^metadata:$/ { next } in_namespace && /^  name:/ { print $2; exit } /^---$/ { in_namespace=0 }' "${RENDERED}")"
if [[ -z "${NAMESPACE}" ]]; then
  echo "Rendered manifest does not define a Namespace." >&2
  exit 1
fi

kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

require_secret() {
  local name="$1"
  if ! kubectl -n "${NAMESPACE}" get secret "${name}" >/dev/null 2>&1; then
    echo "Missing required secret ${name} in namespace ${NAMESPACE}. Copy infra/k8s/templates/secrets.example.yaml, fill values, set namespace ${NAMESPACE}, and apply it first." >&2
    exit 1
  fi
}

for secret in \
  neuroloom-account-edge-tls \
  neuroloom-account-api-secret \
  neuroloom-gateway-secret \
  neuroloom-account-worker-secret \
  neuroloom-web-secret \
  neuroloom-core-secret \
  neuroloom-worker-secret \
  neuroloom-executor-secret; do
  require_secret "${secret}"
done

echo "Applying rendered manifest into namespace ${NAMESPACE}..." >&2
kubectl apply -f "${RENDERED}"

for job in \
  neuroloom-core-migrate \
  neuroloom-gateway-domain-migrate \
  neuroloom-account-domain-migrate; do
  echo "Waiting for migration job/${NAME_PREFIX}${job}..." >&2
  kubectl wait -n "${NAMESPACE}" --for=condition=complete "job/${NAME_PREFIX}${job}" --timeout="${TIMEOUT}"
done

for deployment in \
  neuroloom-account-api \
  neuroloom-gateway \
  neuroloom-web \
  neuroloom-core \
  neuroloom-account-worker \
  neuroloom-worker \
  neuroloom-executor \
  neuroloom-account-edge; do
  echo "Waiting for rollout deployment/${NAME_PREFIX}${deployment}..." >&2
  kubectl rollout status -n "${NAMESPACE}" "deployment/${NAME_PREFIX}${deployment}" --timeout="${TIMEOUT}"
done

SMOKE_NAME="neuroloom-${OVERLAY}-smoke-$(date +%s)"
echo "Running in-cluster smoke ${SMOKE_NAME}..." >&2
kubectl -n "${NAMESPACE}" run "${SMOKE_NAME}" \
  --rm \
  -i \
  --restart=Never \
  --image="${SMOKE_IMAGE}" \
  --command -- sh -c "curl -fsS http://${NAME_PREFIX}neuroloom-web:3000/ready && curl -fsS http://${NAME_PREFIX}neuroloom-core:4000/ready && curl -fsS http://${NAME_PREFIX}neuroloom-account-api:4000/ready && curl -fsS http://${NAME_PREFIX}neuroloom-gateway:4200/readyz"
