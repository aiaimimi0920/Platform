-- Gateway User Credentials
-- 用户凭证表，用于管理用户购买"无限续杯"后颁发的临时凭证

CREATE TABLE gateway_user_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES gateway_projects(id) ON DELETE CASCADE,
  credential_key TEXT NOT NULL UNIQUE,
  credential_type TEXT NOT NULL, -- 'unlimited_refill', 'pay_per_use', etc.
  status TEXT NOT NULL, -- 'active', 'expired', 'revoked'
  expires_at TIMESTAMPTZ NOT NULL,
  scope JSONB NOT NULL, -- ["codex", "chat", etc.]
  metadata JSONB, -- 存储订单信息等
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);

-- 索引优化
CREATE INDEX gateway_user_credentials_user_id_idx ON gateway_user_credentials(user_id);
CREATE INDEX gateway_user_credentials_credential_key_idx ON gateway_user_credentials(credential_key);
CREATE INDEX gateway_user_credentials_status_expires_at_idx ON gateway_user_credentials(status, expires_at);
CREATE INDEX gateway_user_credentials_project_id_status_idx ON gateway_user_credentials(project_id, status);

-- 注释
COMMENT ON TABLE gateway_user_credentials IS '用户凭证表，管理购买后颁发的临时访问凭证';
COMMENT ON COLUMN gateway_user_credentials.credential_key IS '用户使用的凭证 key，格式：gw-user-{random}';
COMMENT ON COLUMN gateway_user_credentials.credential_type IS '凭证类型：unlimited_refill（无限续杯）、pay_per_use（按量付费）';
COMMENT ON COLUMN gateway_user_credentials.scope IS '权限范围，JSON 数组，如 ["codex", "chat"]';
COMMENT ON COLUMN gateway_user_credentials.metadata IS '元数据，存储订单 ID、产品名称等信息';
