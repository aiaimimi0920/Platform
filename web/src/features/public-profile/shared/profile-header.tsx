/**
 * Shared profile header — used by both owner and visitor views.
 * Pure display component, no editing logic.
 */
type ProfileHeaderProps = {
  username: string;
  avatarUrl: string | null;
  profileTagline: string | null;
  trustLevel: number | null;
  createdAt: string;
  reputation: {
    score: number;
    tier: string;
    completionRate: number;
  } | null;
  progression: {
    level: number;
    experience: number;
    nextLevelExperience: number | null;
  } | null;
};

function tierLabel(tier: string) {
  const labels: Record<string, string> = {
    bronze: "青铜",
    silver: "白银",
    gold: "黄金",
    platinum: "铂金",
  };
  return labels[tier] || tier;
}

export function ProfileHeader({
  username,
  avatarUrl,
  profileTagline,
  createdAt,
  trustLevel,
  reputation,
  progression,
}: ProfileHeaderProps) {
  const joinedAtLabel = new Date(createdAt).toLocaleDateString("zh-CN");
  return (
    <div className="nt-card public-profile__header">
      <div className="public-profile__identity">
        <div className="public-profile__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="public-profile__avatar-img" />
          ) : (
            <span className="public-profile__avatar-placeholder">
              {username.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="public-profile__info">
          <h1 className="public-profile__username">{username}</h1>
          {profileTagline ? (
            <p className="public-profile__tagline">{profileTagline}</p>
          ) : (
            <p className="public-profile__tagline public-profile__tagline--empty">这个人很懒，什么都没写</p>
          )}
        </div>
      </div>
      <div className="public-profile__stats">
        {trustLevel !== null ? (
          <div className="public-profile__stat-cell">
            <span className="public-profile__stat-label">信任等级</span>
            <span className="public-profile__stat-value">{trustLevel}</span>
          </div>
        ) : null}
        {reputation ? (
          <>
            <div className="public-profile__stat-cell">
              <span className="public-profile__stat-label">信誉分</span>
              <span className="public-profile__stat-value">{reputation.score}</span>
            </div>
            <div className="public-profile__stat-cell">
              <span className="public-profile__stat-label">信誉段位</span>
              <span className="public-profile__stat-value">{tierLabel(reputation.tier)}</span>
            </div>
            <div className="public-profile__stat-cell">
              <span className="public-profile__stat-label">完成率</span>
              <span className="public-profile__stat-value">
                {(reputation.completionRate * 100).toFixed(0)}%
              </span>
            </div>
          </>
        ) : null}
        {progression ? (
          <div className="public-profile__stat-cell">
            <span className="public-profile__stat-label">等级</span>
            <span className="public-profile__stat-value">Lv.{progression.level}</span>
          </div>
        ) : null}
        <div className="public-profile__stat-cell">
          <span className="public-profile__stat-label">加入时间</span>
          <span className="public-profile__stat-value">{joinedAtLabel}</span>
        </div>
      </div>
    </div>
  );
}
