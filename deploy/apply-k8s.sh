#!/usr/bin/env bash
set -euo pipefail

OVERLAY="${1:-production}"

kubectl apply -k "infra/k8s/overlays/${OVERLAY}"
