-- Add tags column (jsonb string array) to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';

-- Migrate old category values to canonical benefit-family keys
UPDATE products SET category = 'artificial_intelligence'
  WHERE category IN ('membership', 'account', 'qualification');

-- Align seeded discount code targeting the old "account" category
UPDATE discount_codes SET target_product_category = 'artificial_intelligence'
  WHERE id = 'discount_trusted_account_10'
    AND target_product_category = 'account';
