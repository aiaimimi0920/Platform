ALTER TABLE users
  ADD COLUMN IF NOT EXISTS honor_showcased_issue_ids text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS honor_showcased_investment_issue_ids text;
