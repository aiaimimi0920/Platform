alter table users
  add column if not exists honor_showcased_project_ids text;

alter table users
  add column if not exists honor_showcased_investment_project_ids text;
