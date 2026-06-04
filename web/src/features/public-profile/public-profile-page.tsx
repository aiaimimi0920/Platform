import Link from "next/link";

import type { AgentMarketplaceListingView } from "@neuro/contracts";

import { NtBadge } from "@/components/nt-primitives";
import { ProfileHeader } from "@/features/public-profile/shared/profile-header";

import type { PublicProfilePageData } from "./types";

type PublicProfilePageProps = {
  profile: PublicProfilePageData;
};

function formatHostingModeLabel(listing: AgentMarketplaceListingView) {
  if (listing.agentHostingMode === "managed_heavy" || listing.agentHostingMode === "registry_only") {
    return "平台重型";
  }
  if (listing.agentHostingMode === "open_protocol" || listing.agentHostingMode === "external_runtime") {
    return "OpenAgent";
  }
  return "平台轻量";
}

function formatBillingModeLabel(listing: AgentMarketplaceListingView) {
  if (listing.billingMode === "token_metered") {
    return `按 token / ${listing.billingUnit || "1k_tokens"}`;
  }
  if (listing.billingMode === "property_metered") {
    return `按属性 / ${listing.meterKey || listing.billingUnit || "task_units"}`;
  }
  return `按任务 / ${listing.billingUnit || "task"}`;
}

function formatCurrencyLabel(currency: AgentMarketplaceListingView["priceCurrency"]) {
  return currency === "obsidian" ? "曜石" : "米拉";
}

function buildTaskIntentHref(listing: AgentMarketplaceListingView) {
  const params = new URLSearchParams();
  params.set("title", `委托 ${listing.publicTitle}`);
  params.set(
    "description",
    listing.publicDescription ||
      `请调用 ${listing.agentName} / ${listing.capabilityTitle}，按 ${listing.priceAmount} ${formatCurrencyLabel(listing.priceCurrency)} 报价交付。`,
  );
  params.set("preferredCapabilityCodes", listing.capabilityCode);
  params.set("rewardCurrency", listing.priceCurrency);
  params.set("rewardAmount", String(listing.priceAmount));
  if (listing.billingUnit) {
    params.set("billingUnit", listing.billingUnit);
  }
  if (listing.meterKey) {
    params.set("meterKey", listing.meterKey);
  }
  return `/tasks?${params.toString()}`;
}

function groupShowcasedAgents(profile: PublicProfilePageData) {
  const listingsByAgentId = new Map<string, AgentMarketplaceListingView[]>();
  for (const listing of profile.showcasedAgentListings) {
    const bucket = listingsByAgentId.get(listing.agentId) ?? [];
    bucket.push(listing);
    listingsByAgentId.set(listing.agentId, bucket);
  }

  return (profile.profile.showcasedAgentIds ?? [])
    .map((agentId) => {
      const listings = listingsByAgentId.get(agentId) ?? [];
      if (listings.length === 0) {
        return null;
      }
      const primaryListing = listings[0];
      const routingTags = [...new Set(listings.flatMap((listing) => listing.routingTags ?? []))].slice(0, 6);
      return {
        agentId,
        agentName: primaryListing.agentName,
        hostingLabel: formatHostingModeLabel(primaryListing),
        listings,
        primaryListing,
        routingTags,
        directInvokeCount: listings.filter((listing) => listing.externalInvocationEnabled).length,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export function PublicProfilePage({ profile }: PublicProfilePageProps) {
  const showcasedAgents = groupShowcasedAgents(profile);
  const publicProfile = profile.profile;

  return (
    <div className="mg-theme public-profile">
      <div className="nt-shell public-profile__shell">
        <ProfileHeader
          username={publicProfile.username}
          avatarUrl={publicProfile.avatarUrl}
          createdAt={publicProfile.createdAt}
          profileTagline={publicProfile.profileTagline}
          progression={publicProfile.progression}
          reputation={publicProfile.reputation}
          trustLevel={publicProfile.trustLevel}
        />

        <div className="public-profile__body">
          {showcasedAgents.length > 0 ? (
            <section className="nt-card public-profile__section public-profile__section--agents">
              <div className="public-profile__section-head public-profile__section-head--spread">
                <div className="public-profile__section-copy">
                  <span className="nt-kicker">公开 Agent 面板</span>
                  <h2 className="public-profile__section-title">已公开供给</h2>
                  <p className="public-profile__section-note">
                    这是该用户主动展示的 Agent 供给摘要。访客可以先查看能力、计费方式和公开描述，再决定是否进一步协作。
                  </p>
                </div>
                <NtBadge tone="cyan">{`${showcasedAgents.length} 个展示位`}</NtBadge>
              </div>

              <div className="public-profile__agent-grid">
                {showcasedAgents.map((agent) => (
                  <article className="nt-card public-profile__agent-card" key={agent.agentId}>
                    <div className="public-profile__agent-head">
                      <div className="public-profile__agent-title-block">
                        <strong className="public-profile__agent-name">{agent.agentName}</strong>
                        <p className="public-profile__agent-summary">
                          {agent.primaryListing.publicDescription ||
                            agent.primaryListing.routingSummary ||
                            `${agent.agentName} 已公开 ${agent.listings.length} 条供给。`}
                        </p>
                      </div>
                      <div className="public-profile__agent-badges">
                        <NtBadge tone="violet">{agent.hostingLabel}</NtBadge>
                        <NtBadge tone="success">{`${agent.listings.length} 条供给`}</NtBadge>
                        <NtBadge tone={agent.directInvokeCount > 0 ? "warning" : "secondary"}>
                          {agent.directInvokeCount > 0 ? `${agent.directInvokeCount} 条可直连` : "仅任务模式"}
                        </NtBadge>
                      </div>
                    </div>

                    <div className="public-profile__agent-stats">
                      <div className="public-profile__agent-stat">
                        <span>主报价</span>
                        <strong>{`${agent.primaryListing.priceAmount} ${formatCurrencyLabel(agent.primaryListing.priceCurrency)}`}</strong>
                      </div>
                      <div className="public-profile__agent-stat">
                        <span>主计费</span>
                        <strong>{formatBillingModeLabel(agent.primaryListing)}</strong>
                      </div>
                      <div className="public-profile__agent-stat">
                        <span>路由标签</span>
                        <strong>{agent.routingTags.length > 0 ? agent.routingTags.join(" / ") : "未定义"}</strong>
                      </div>
                    </div>

                    <div className="public-profile__agent-list">
                      {agent.listings.map((listing) => (
                        <div className="public-profile__agent-listing" key={listing.id}>
                          <div className="public-profile__agent-listing-head">
                            <div>
                              <strong>{listing.publicTitle}</strong>
                              <p>{listing.capabilityCode}</p>
                            </div>
                            <div className="public-profile__agent-badges">
                              <NtBadge tone="cyan">{formatBillingModeLabel(listing)}</NtBadge>
                              {listing.externalInvocationEnabled ? <NtBadge tone="warning">可直连</NtBadge> : null}
                            </div>
                          </div>
                          <div className="public-profile__agent-listing-meta">
                            <span>{`${listing.priceAmount} ${formatCurrencyLabel(listing.priceCurrency)}`}</span>
                            <span>{listing.routingSummary || "未填写路由描述"}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="public-profile__agent-actions">
                      <Link className="nt-btn nt-btn--outline" href={buildTaskIntentHref(agent.primaryListing)}>
                        登录后委托
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {publicProfile.showcasedProjectIds && publicProfile.showcasedProjectIds.length > 0 ? (
            <section className="nt-card public-profile__section">
              <div className="public-profile__section-head">
                <span className="nt-kicker">展示项目</span>
              </div>
              <div className="public-profile__showcase-grid">
                {publicProfile.showcasedProjectIds.map((id) => (
                  <div className="public-profile__showcase-card" key={id}>
                    <span className="public-profile__showcase-id">{id}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {publicProfile.showcasedIssueIds && publicProfile.showcasedIssueIds.length > 0 ? (
            <section className="nt-card public-profile__section">
              <div className="public-profile__section-head">
                <span className="nt-kicker">公开议题</span>
              </div>
              <div className="public-profile__showcase-grid">
                {publicProfile.showcasedIssueIds.map((id) => (
                  <div className="public-profile__showcase-card" key={id}>
                    <span className="public-profile__showcase-id">{id}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {showcasedAgents.length === 0 &&
          !publicProfile.showcasedProjectIds?.length &&
          !publicProfile.showcasedIssueIds?.length ? (
            <div className="nt-card public-profile__empty">
              <p>该用户暂未公开展示内容</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
