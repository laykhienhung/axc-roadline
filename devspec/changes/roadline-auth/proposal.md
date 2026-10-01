# Proposal: roadline-auth

## Why

Roadline has no login. Anyone who can reach the server can view the plan, and anyone can **replace it for everyone** through Import. Imports can't be traced to a person. The team wants people to sign in with their own account, and wants an admin to decide who may import and who manages access. They don't want a dependency on Google Workspace or any other external identity provider.

## What it delivers

- **Local accounts.**
  - Anyone can **create an account** at `/signup` with name, email (any domain) and a password of at least 10 characters.
  - They're signed in **immediately as Viewer**, with no approval step.
  - Sign-in at `/signin` is by email and password.
- **Everything behind sign-in.**
  - Every page and `/api/*` route needs a session, except the sign-in and sign-up pages, `/auth/*` and the static JS/CSS bundle.
  - Signed-out page requests go to `/signin` and return to the original page afterwards. API calls answer `401`.
- **Three roles, set by an admin.**
  - **Viewer**: view the plan.
  - **Editor**: also import.
  - **Admin**: also manage users.
  - Emails in **`ADMIN_EMAILS`** (server setting) become admins when they sign up and are locked in the UI. That's how the first admin gets in, and it keeps one admin who can't be locked out.
- **Server-side sessions** (`sessions` table): a random token in an httpOnly cookie, valid 12 hours. **Sign out** ends it.
- **Passwords.**
  - Hashed with scrypt (built into Node, no new dependency).
  - Anyone can **change their password** from the user menu.
  - An admin can **reset** a password to `1111`. The user must then set a new one on the **Update password** screen before they can open anything else.
  - Changing a password signs out the user's other devices.
- **Admin page** `/admin`:
  - **Users** tab: change role, reset password, sign out everywhere, disable/enable. Nobody is deleted.
  - **Import log** tab: who imported which file, and the outcome. Refused viewer imports are logged as "Not allowed".
- **UI** (approved mockups `signin.html`, `signup.html`, `update-password.html`, `header-roles.html`, `admin.html`):
  - Sign-in, sign-up and update-password pages.
  - Header user chip with role badge and menu.
  - "Read-only" in place of Import for viewers.
  - The viewer "no plan yet" screen and the admin page.
- **Database or files.** Users and sessions live in Postgres (`postgres.roadline`, from `roadline-db`). Without `DATABASE_URL` they live in JSON files, which is what `npm test` uses. **Tests never touch a database.**

## Scope

**In**:
- Server: auth routes, password hashing, middleware, auth store (Postgres and files), admin API, migration for `users`/`sessions`.
- Client: the gate, the three auth pages, the user menu, role-aware import, the admin page.
- Tests, README and context-pack updates.

**Out** (decided by the user):
- External identity providers (Google, Microsoft).
- Email verification and "forgot password" email; an admin resets instead.
- Approval of new accounts.
- Restricting sign-up to a company domain.
- Sign-in attempt throttling.
- Deleting users or audit rows.
- Inviting users ahead of sign-up.
- Per-target permissions and API tokens.
- A dedicated DB role (the pilot runs as `postgres`, per `roadline-db`).

## Notes

- **Accepted risk** (the user's decision): open sign-up, any domain and no throttle mean anyone who can reach the server can create an account and **read** the plan, and guessing passwords isn't slowed down.
  - Import and user management still need a role an admin grants.
  - Admins can disable unknown accounts from the Users tab.
  - A reset to `1111` can be used by anyone who knows that user's email until the user signs in. It only opens the Update password screen, which then sets a password of the attacker's choosing. Admins should tell the user immediately after a reset.
- **Depends on `roadline-db`** (pool, `Storage` switch, `imports` table, migrations dir) and on **`roadline-v2`** (the header and import screens it extends).
- **Migration**: applying the `users`/`sessions` migration to `postgres.roadline` is done by a person.
- **Replaces** the earlier Google-based capture of this change, which was never built.
- **Context pack**: this reverses "no auth by design" in `devspec/context/rules.md`, and the pack is updated in this change.
