-- Hand-written migration. Prisma's @@fulltext is preview-only and cannot
-- express WITH PARSER ngram. This index is owned by this migration
-- exclusively — `migrate diff` drift reports mentioning it are expected;
-- never `db pull` it back into the schema.

-- Chinese/English mixed food name search. Requires ngram_token_size=2,
-- fixed in docker-compose command flags (read-only server variable).
ALTER TABLE `food`
  ADD FULLTEXT INDEX `ft_food_search` (`searchText`) WITH PARSER ngram;

-- NOTE: the dual-form invariant (foodId IS NOT NULL OR description IS NOT
-- NULL) cannot be a CHECK constraint here: MySQL forbids CHECK on columns
-- referenced by a foreign key with a SET NULL action. It is enforced in the
-- application layer (MCP input validation + repos), and foods are never
-- physically deleted (status='retired' instead), so the SET NULL action
-- never fires in practice.
