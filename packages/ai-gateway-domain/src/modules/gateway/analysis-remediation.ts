import type {
  GatewayAnalysisAnomalyIncidentRemediationActionView,
  GatewayAnalysisAnomalyIncidentRemediationPlanView,
  GatewayAnalysisAnomalyIncidentView,
  GatewayAnalysisAnomalyPolicyView,
  GatewayRateLimitDefinition,
  GatewayRoutePolicyView,
} from "@neuro/contracts";

function pushAction(
  actions: GatewayAnalysisAnomalyIncidentRemediationActionView[],
  action: GatewayAnalysisAnomalyIncidentRemediationActionView,
) {
  if (!actions.some((item) => item.actionKey === action.actionKey)) {
    actions.push(action);
  }
}

export function buildGatewayAnalysisAnomalyIncidentRemediationPlan(args: {
  generatedAt: string;
  incident: GatewayAnalysisAnomalyIncidentView;
  policy: GatewayAnalysisAnomalyPolicyView | null;
  routePolicy: GatewayRoutePolicyView | null;
  incidentContext?: {
    entityKey?: string | null;
    snapshotId?: string | null;
  };
}): GatewayAnalysisAnomalyIncidentRemediationPlanView {
  const actions: GatewayAnalysisAnomalyIncidentRemediationActionView[] = [];
  const { incident, policy, routePolicy } = args;
  const routePolicyId = routePolicy?.id ?? policy?.routePolicyId ?? incident.routePolicyId ?? null;
  const entityKey = args.incidentContext?.entityKey?.trim() || null;

  function buildTighterRateLimit(
    current: GatewayRateLimitDefinition | null | undefined,
    fallback: GatewayRateLimitDefinition,
  ): GatewayRateLimitDefinition {
    if (!current?.windowSeconds || !current.maxRequests) {
      return fallback;
    }
    return {
      windowSeconds: current.windowSeconds,
      maxRequests: Math.max(1, current.maxRequests - Math.max(1, Math.ceil(current.maxRequests * 0.2))),
    };
  }

  if (incident.code === "failure_rate_spike" || incident.code === "completion_rate_drop") {
    pushAction(actions, {
      actionKey: "routing-review",
      title: "Review Route Policy Routing Guardrails",
      description:
        "Inspect provider allowlist, fallback settings, provider concurrency caps, and circuit breaker thresholds for the linked route policy.",
      category: "routing",
      priority: "high",
      routePolicyId,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: routePolicy
        ? {
            routePolicyId: routePolicy.id,
            fields: [
              "allowedProviderAccountIds",
              "providerMaxConcurrentRequests",
              "preStreamFallbackEnabled",
              "circuitBreakerThreshold",
              "circuitBreakerCooldownSeconds",
            ],
          }
        : null,
    });
    pushAction(actions, {
      actionKey: "disable-prestream-fallback",
      title: "Disable Pre-stream Fallback",
      description:
        "Temporarily disable pre-stream fallback for this route policy so the gateway stops fan-out fallback before the first byte while you isolate degraded providers.",
      category: "routing",
      priority: "high",
      routePolicyId,
      executable: Boolean(routePolicyId),
      executionMode: routePolicyId ? "route_policy_patch" : "informational",
      defaultExecutionInput: routePolicyId
        ? {
            routePolicyPatch: {
              preStreamFallbackEnabled: false,
            },
          }
        : null,
      recommendedChanges: routePolicyId
        ? {
            routePolicyId,
            patch: {
              preStreamFallbackEnabled: false,
            },
          }
        : null,
    });
    pushAction(actions, {
      actionKey: "reduce-provider-concurrency",
      title: "Reduce Provider Concurrency Cap",
      description:
        "Lower the per-provider concurrency cap for this route policy to reduce blast radius while the suspect provider pool is under investigation.",
      category: "provider",
      priority: "high",
      routePolicyId,
      executable: Boolean(routePolicyId),
      executionMode: routePolicyId ? "route_policy_patch" : "informational",
      defaultExecutionInput: routePolicyId
        ? {
            routePolicyPatch: {
              providerMaxConcurrentRequests:
                routePolicy?.config.providerMaxConcurrentRequests != null
                  ? Math.max(1, routePolicy.config.providerMaxConcurrentRequests - 1)
                  : 1,
            },
          }
        : null,
      recommendedChanges: routePolicyId
        ? {
            routePolicyId,
            patch: {
              providerMaxConcurrentRequests:
                routePolicy?.config.providerMaxConcurrentRequests != null
                  ? Math.max(1, routePolicy.config.providerMaxConcurrentRequests - 1)
                  : 1,
            },
          }
        : null,
    });
    pushAction(actions, {
      actionKey: "provider-isolation",
      title: "Isolate Suspect Providers",
      description:
        "Compare recent routed providers for this policy and temporarily narrow the provider set if one account is degrading completion quality.",
      category: "provider",
      priority: "high",
      routePolicyId,
      executable: Boolean(routePolicyId),
      executionMode: routePolicyId ? "route_policy_patch" : "informational",
      defaultExecutionInput: routePolicy?.config.allowedProviderAccountIds?.length
        ? {
            routePolicyPatch: {
              allowedProviderAccountIds: routePolicy.config.allowedProviderAccountIds.slice(0, 1),
            },
          }
        : null,
      recommendedChanges: routePolicyId ? { routePolicyId, mode: "narrow_provider_pool" } : null,
    });
  }

  if (
    incident.code === "provider_routing_score_drop" ||
    incident.code === "degraded_provider_route_spike" ||
    incident.code === "saturated_provider_route_spike" ||
    incident.code === "breaker_open_provider_route_detected"
  ) {
    pushAction(actions, {
      actionKey: "provider-routing-review",
      title: "Review Provider Routing Degradation",
      description:
        "Inspect provider routing score, degradation reasons, saturation, and breaker-open drift for the linked route policy before traffic keeps concentrating on unhealthy providers.",
      category: "provider",
      priority: "high",
      routePolicyId,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: routePolicy
        ? {
            routePolicyId: routePolicy.id,
            inspect: [
              "allowedProviderAccountIds",
              "providerMaxConcurrentRequests",
              "providerLoadAwareRoutingEnabled",
              "circuitBreakerThreshold",
              "circuitBreakerCooldownSeconds",
            ],
          }
        : { inspect: ["route_policy", "provider_routing_score", "degradation_reasons"] },
    });
    pushAction(actions, {
      actionKey: "disable-prestream-fallback",
      title: "Disable Pre-stream Fallback",
      description:
        "Stop broad pre-stream fallback while unhealthy providers are being isolated, so routing no longer fan-outs across already degraded candidates.",
      category: "routing",
      priority: "high",
      routePolicyId,
      executable: Boolean(routePolicyId),
      executionMode: routePolicyId ? "route_policy_patch" : "informational",
      defaultExecutionInput: routePolicyId
        ? {
            routePolicyPatch: {
              preStreamFallbackEnabled: false,
            },
          }
        : null,
      recommendedChanges: routePolicyId
        ? {
            routePolicyId,
            patch: {
              preStreamFallbackEnabled: false,
            },
          }
        : null,
    });
    pushAction(actions, {
      actionKey: "reduce-provider-concurrency",
      title: "Reduce Provider Concurrency Cap",
      description:
        "Lower the per-provider concurrency cap so unhealthy providers stop receiving the same level of parallel pressure while routing stabilizes.",
      category: "provider",
      priority: "high",
      routePolicyId,
      executable: Boolean(routePolicyId),
      executionMode: routePolicyId ? "route_policy_patch" : "informational",
      defaultExecutionInput: routePolicyId
        ? {
            routePolicyPatch: {
              providerMaxConcurrentRequests:
                routePolicy?.config.providerMaxConcurrentRequests != null
                  ? Math.max(1, routePolicy.config.providerMaxConcurrentRequests - 1)
                  : 1,
            },
          }
        : null,
      recommendedChanges: routePolicyId
        ? {
            routePolicyId,
            patch: {
              providerMaxConcurrentRequests:
                routePolicy?.config.providerMaxConcurrentRequests != null
                  ? Math.max(1, routePolicy.config.providerMaxConcurrentRequests - 1)
                  : 1,
            },
          }
        : null,
    });
    pushAction(actions, {
      actionKey: "provider-isolation",
      title: "Isolate Degraded Providers",
      description:
        "Temporarily narrow the provider allowlist so degraded, saturated, or breaker-open providers are removed from the active route pool.",
      category: "provider",
      priority: "high",
      routePolicyId,
      executable: Boolean(routePolicyId),
      executionMode: routePolicyId ? "route_policy_patch" : "informational",
      defaultExecutionInput:
        routePolicyId && routePolicy?.config.allowedProviderAccountIds?.length
          ? {
              routePolicyPatch: {
                allowedProviderAccountIds: routePolicy.config.allowedProviderAccountIds.slice(0, 1),
              },
            }
          : null,
      recommendedChanges: routePolicyId ? { routePolicyId, mode: "narrow_provider_pool" } : null,
    });
  }

  if (incident.code === "tokens_per_sample_spike") {
    pushAction(actions, {
      actionKey: "prompt-growth-audit",
      title: "Audit Prompt and Tool Growth",
      description:
        "Check prompt templates, tool loops, metadata bloat, and fallback model changes that could inflate tokens per sample.",
      category: "prompt",
      priority: "high",
      routePolicyId,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: {
        inspect: ["prompt_templates", "tool_call_loops", "metadata_payload", "model_alias_fallbacks"],
      },
    });
  }

  if (
    incident.code === "rate_limit_request_spike" ||
    incident.code === "rate_limit_code_concentration" ||
    incident.code === "rate_limit_project_hotspot" ||
    incident.code === "rate_limit_api_key_hotspot" ||
    incident.code === "rate_limit_model_hotspot" ||
    incident.code === "rate_limit_endpoint_hotspot"
  ) {
    pushAction(actions, {
      actionKey: "rate-limit-policy-review",
      title: "Review Route Policy Rate-limit Guardrails",
      description:
        "Inspect project, API key, model, and endpoint rate-limit windows for this route policy so recurring hotspot pressure stops concentrating on one scope.",
      category: "routing",
      priority: "high",
      routePolicyId,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: routePolicy
        ? {
            routePolicyId: routePolicy.id,
            fields: [
              "rateLimitWindowSeconds",
              "rateLimitMaxRequests",
              "apiKeyRateLimit",
              "modelRateLimits",
              "endpointRateLimits",
            ],
          }
        : { inspect: ["rate_limit_policy_scope", "apiKeyRateLimit", "modelRateLimits", "endpointRateLimits"] },
    });
    pushAction(actions, {
      actionKey: "rate-limit-offender-triage",
      title: "Triage Dominant Hotspot Scope",
      description:
        "Use the hotspot code and dominant scope from the snapshot to isolate the top offender before changing global route policy limits.",
      category: "manual",
      priority: "high",
      routePolicyId,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: {
        focusCode: incident.code,
        focusValue: incident.latestValue,
        inspect: ["hotspot_entity_key", "preflight_rate_limits", "requested_model", "api_key_id", "endpoint_kind"],
      },
    });

    if (
      routePolicyId &&
      (incident.code === "rate_limit_request_spike" ||
        incident.code === "rate_limit_code_concentration" ||
        incident.code === "rate_limit_project_hotspot")
    ) {
      const currentProjectRateLimit =
        routePolicy?.config.rateLimitWindowSeconds && routePolicy.config.rateLimitMaxRequests
          ? {
              windowSeconds: routePolicy.config.rateLimitWindowSeconds,
              maxRequests: routePolicy.config.rateLimitMaxRequests,
            }
          : null;
      const targetProjectRateLimit = buildTighterRateLimit(currentProjectRateLimit, {
        windowSeconds: 60,
        maxRequests: 30,
      });
      pushAction(actions, {
        actionKey: "tighten-project-rate-limit",
        title: "Tighten Project Rate Limit",
        description:
          "Apply a stricter route-level request cap so project-wide hotspot pressure stops spilling into the same route policy.",
        category: "routing",
        priority: "high",
        routePolicyId,
        executable: true,
        executionMode: "route_policy_patch",
        defaultExecutionInput: {
          routePolicyPatch: {
            projectRateLimit: targetProjectRateLimit,
          },
        },
        recommendedChanges: {
          routePolicyId,
          patch: {
            projectRateLimit: targetProjectRateLimit,
          },
        },
      });
    }

    if (routePolicyId && incident.code === "rate_limit_api_key_hotspot") {
      const targetApiKeyRateLimit = buildTighterRateLimit(routePolicy?.config.apiKeyRateLimit, {
        windowSeconds: 60,
        maxRequests: 20,
      });
      pushAction(actions, {
        actionKey: "tighten-api-key-rate-limit",
        title: "Tighten Per-key Rate Limit",
        description:
          "Lower the route policy's per-key rate limit so one hot key stops dominating the request budget.",
        category: "routing",
        priority: "high",
        routePolicyId,
        executable: true,
        executionMode: "route_policy_patch",
        defaultExecutionInput: {
          routePolicyPatch: {
            apiKeyRateLimit: targetApiKeyRateLimit,
          },
        },
        recommendedChanges: {
          routePolicyId,
          patch: {
            apiKeyRateLimit: targetApiKeyRateLimit,
          },
        },
      });
    }

    if (routePolicyId && incident.code === "rate_limit_model_hotspot" && entityKey) {
      const targetModelRateLimit = buildTighterRateLimit(routePolicy?.config.modelRateLimits?.[entityKey], {
        windowSeconds: 60,
        maxRequests: 20,
      });
      pushAction(actions, {
        actionKey: "tighten-model-rate-limit",
        title: "Tighten Hot Model Rate Limit",
        description:
          "Apply a stricter model-specific limit for the dominant requested model so hotspot traffic does not keep concentrating on the same model.",
        category: "routing",
        priority: "high",
        routePolicyId,
        executable: true,
        executionMode: "route_policy_patch",
        defaultExecutionInput: {
          routePolicyPatch: {
            modelRateLimitKey: entityKey,
            modelRateLimit: targetModelRateLimit,
          },
        },
        recommendedChanges: {
          routePolicyId,
          patch: {
            modelRateLimitKey: entityKey,
            modelRateLimit: targetModelRateLimit,
          },
          snapshotId: args.incidentContext?.snapshotId ?? null,
        },
      });
    }

    if (routePolicyId && incident.code === "rate_limit_endpoint_hotspot" && entityKey) {
      const targetEndpointRateLimit = buildTighterRateLimit(routePolicy?.config.endpointRateLimits?.[entityKey], {
        windowSeconds: 60,
        maxRequests: 20,
      });
      pushAction(actions, {
        actionKey: "tighten-endpoint-rate-limit",
        title: "Tighten Hot Endpoint Rate Limit",
        description:
          "Apply a stricter endpoint-specific rate limit for the dominant public endpoint so hotspot traffic stops collapsing onto the same call surface.",
        category: "routing",
        priority: "high",
        routePolicyId,
        executable: true,
        executionMode: "route_policy_patch",
        defaultExecutionInput: {
          routePolicyPatch: {
            endpointRateLimitKey: entityKey,
            endpointRateLimit: targetEndpointRateLimit,
          },
        },
        recommendedChanges: {
          routePolicyId,
          patch: {
            endpointRateLimitKey: entityKey,
            endpointRateLimit: targetEndpointRateLimit,
          },
          snapshotId: args.incidentContext?.snapshotId ?? null,
        },
      });
    }
  }

  if (
    incident.code === "request_artifact_coverage_drop" ||
    incident.code === "response_artifact_coverage_drop" ||
    incident.code === "latest_dataset_missing"
  ) {
    pushAction(actions, {
      actionKey: "retention-path-audit",
      title: "Audit Retention and Artifact Path",
      description:
        "Inspect gateway artifact persistence, object storage health, and cleanup policy configuration before training samples degrade further.",
      category: "retention",
      priority: "high",
      routePolicyId,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: {
        inspect: ["requestArtifactObjectKey", "responseArtifactObjectKey", "analysis_export_cleanup", "object_storage"],
      },
    });
  }

  if (incident.escalationStatus === "escalated") {
    pushAction(actions, {
      actionKey: "owner-followup",
      title: "Drive Owner Follow-up",
      description:
        "This incident is escalated. Confirm the assigned owner, follow-up status, and remediation note so it does not stay as an unowned escalated signal.",
      category: "manual",
      priority: "high",
      routePolicyId,
      executable: true,
      executionMode: "incident_follow_up",
      defaultExecutionInput: {
        incidentFollowUp: {
          ownerUserId: incident.ownerUserId,
          followUpStatus: incident.followUpStatus === "pending" ? "investigating" : incident.followUpStatus,
          note: incident.latestNote,
          resolutionNote: incident.resolutionNote,
        },
      },
      recommendedChanges: {
        ownerUserId: incident.ownerUserId,
        followUpStatus: incident.followUpStatus,
      },
    });
  }

  if (!routePolicyId) {
    pushAction(actions, {
      actionKey: "bind-route-policy",
      title: "Bind a Route Policy to the Anomaly Policy",
      description:
        "Link this anomaly policy to a concrete route policy so future anomalies can map directly to routing remediation rather than staying detached.",
      category: "routing",
      priority: "medium",
      routePolicyId: null,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: { field: "routePolicyId" },
    });
  }

  if (actions.length === 0) {
    pushAction(actions, {
      actionKey: "manual-triage",
      title: "Perform Manual Triage",
      description:
        "No specialized remediation rule matched. Review the incident artifacts, trend deltas, and route trace before deciding whether to tune routing, providers, or prompt behavior.",
      category: "manual",
      priority: "medium",
      routePolicyId,
      executable: false,
      executionMode: "informational",
      defaultExecutionInput: null,
      recommendedChanges: null,
    });
  }

  return {
    generatedAt: args.generatedAt,
    incident,
    policy,
    routePolicy,
    overview:
      incident.escalationStatus === "escalated"
        ? "Escalated incident. Prioritize routing and ownership actions first."
        : "Actionable remediation suggestions based on anomaly code, policy scope, and routing context.",
    actions,
  };
}
