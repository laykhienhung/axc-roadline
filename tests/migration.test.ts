import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  path.join(process.cwd(), 'migrations', '1759300000000_init.sql'),
  'utf8'
);

const authMigration = readFileSync(
  path.join(process.cwd(), 'migrations', '1759400000000_auth.sql'),
  'utf8'
);

describe('initial database migration', () => {
  it('creates the Roadline schema tables and indexes', () => {
    expect(migration).toMatch(/create\s+table\s+plans\b/i);
    expect(migration).toMatch(/create\s+table\s+value_mappings\b/i);
    expect(migration).toMatch(/create\s+table\s+template_versions\b/i);
    expect(migration).toMatch(/create\s+table\s+imports\b/i);
    expect(migration).toMatch(/create\s+index\s+plans_imported_at_idx\b/i);
    expect(migration).toMatch(/create\s+index\s+imports_at_idx\b/i);
  });

  it('keeps import history when a plan is deleted', () => {
    expect(migration).toMatch(
      /plan_id\s+bigint\s+references\s+plans\s*\(\s*id\s*\)\s+on\s+delete\s+set\s+null/i
    );
  });

  it('limits audit outcomes to every API import outcome', () => {
    expect(migration).toMatch(
      /outcome\s+text\s+not\s+null\s+check\s*\(\s*outcome\s+in\s*\(\s*'ok'\s*,\s*'invalid_plan'\s*,\s*'needs_mapping'\s*,\s*'invalid_mapping'\s*,\s*'no_file'\s*,\s*'file_too_large'\s*,\s*'unsupported_type'\s*,\s*'forbidden'\s*\)\s*\)/is
    );
  });

  it('is forward-only', () => {
    expect(migration).not.toMatch(/\b(drop|truncate)\b/i);
  });
});

describe('auth database migration', () => {
  it('creates users and revocable sessions with the required constraints', () => {
    expect(authMigration).toMatch(/create\s+table\s+users\b/i);
    expect(authMigration).toMatch(/create\s+table\s+sessions\b/i);
    expect(authMigration).toMatch(/email\s*=\s*lower\s*\(\s*email\s*\)/i);
    expect(authMigration).toMatch(
      /role\s+text\s+not\s+null\s+default\s+'viewer'\s+check\s*\(\s*role\s+in\s*\(\s*'viewer'\s*,\s*'editor'\s*,\s*'admin'\s*\)\s*\)/i
    );
    expect(authMigration).toMatch(
      /user_id\s+bigint\s+not\s+null\s+references\s+users\s*\(\s*id\s*\)\s+on\s+delete\s+cascade/i
    );
    expect(authMigration).toMatch(/create\s+index\s+sessions_user_id_idx\b/i);
    expect(authMigration).toMatch(/create\s+index\s+sessions_expires_at_idx\b/i);
  });

  it('is forward-only', () => {
    expect(authMigration).not.toMatch(/\b(drop|truncate)\b/i);
  });
});
