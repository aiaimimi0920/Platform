-- Remove progression discount: no schema migration needed.
-- discount_source is derived in application code, not stored as a column.
-- The code change removes "progression" from OrderDiscountSource union type.
SELECT 1;
