# UI: roadline-auth

**Mockups** (all approved 2026-10-01):
- `mockups/signin.html`
- `mockups/signup.html`
- `mockups/update-password.html`
- `mockups/header-roles.html`
- `mockups/admin.html`

**References**: no external images. Siblings: the header `src/client/components/app-header.tsx` (`AppHeader`, `Brand`), the target-page header bar with `.crumbs` (`src/client/pages/target-page.tsx`), and the v2 empty state `src/client/components/import-states.tsx:EmptyState`.

**Style source**: tokens and classes from `src/client/styles.css` (CRT arcade theme: `--bg`, `--surface`, `--line`, `--line-strong`, `--ink`, `--on-ink`, `--chip`, `--s-<tone>-fg/-bg`, `--font-body`; square corners).
- Reused classes: `.app-header`, `.brand`, `.wordmark`, `.divider`, `.plan-meta`, `.spacer`, `.crumbs`, `.btn`, `.btn.primary`, `.card`, `.badge`, `.tone-*`, `.seg`, `.empty-state`, `.intro`, `.drop`, `.ico`.
- There's no component library. New pieces are small plain components plus new classes in `styles.css`.

## Auth pages: shared card
`/signin`, `/signup` and forced `/update-password` are full pages with no app header. Each is a centred `.card.auth-card` (max-width 420px) holding the `Brand`, an `h2` and an `.intro`, an optional `.notice`, a `<form>` of `.field`s, and a full-width 44px `.btn.primary`. A `.foot` row (top border) carries the cross-link.
- `.field`: a label plus an input (42px); `.hint` (muted) below it; error state `.field.bad` with `.err` text below.
- `.notice`: left-border box in a tone, with `role="alert"` for errors and `role="status"` for info.

## signin (`/signin`): `signin.html`
```
[logo] Roadline
Sign in
AXC objectives & action plan.
[notice?]
Email     [__________]
Password  [__________]
[        Sign in        ]
─────────────────────────
No account yet?   Create an account →
```
States:
1. **default**
2. **submitting**: inputs and button are disabled, and the button reads "Signing in…" with a spinner.
3. **wrong credentials**: a `.notice.tone-behind` reading "Email or password is wrong" / "Check both and try again. Forgot your password? Ask an admin to reset it." The message is the same for an unknown email and a wrong password. The password field is cleared.
4. **disabled**: a `.notice.tone-at_risk` reading "Your access is turned off" / "An admin has disabled this account. Ask an admin to enable it."
5. **signed out** (`?signedout=1`): the heading becomes "You're signed out" and the intro "Sign in again to view the plan."
6. **session ended** (`?expired=1`): a `.notice.tone-at_risk` with `role="status"` reading "Your session ended" / "Sign in again to continue where you were."

Interactions:
- Enter submits. Email gets `autocomplete="username"` and password gets `autocomplete="current-password"`.
- On success the page goes to `safeNext(?next)`, or to `/update-password?next=…` when `mustChangePassword` is set.
- The "Create an account" link keeps `?next`.
- A signed-in user who opens `/signin` is sent to `next`.

## signup (`/signup`): `signup.html`
Fields: Name, Email, Password (hint "At least 10 characters."), Repeat password. The intro reads "You'll start as a `Viewer` badge — an admin can give you more access." The button is "Create account" and the foot reads "Already have an account? Sign in →".

States:
1. **default**
2. **field errors** on submit, shown under each field: "Enter your name." / "Enter a valid email address." / "At least 10 characters." / "Passwords don't match."
3. **email taken**: a `.notice.tone-behind` reading "This email already has an account" / "Sign in instead. Forgot the password? Ask an admin to reset it."
4. **submitting**: the button reads "Creating account…".
5. **success**: the user is signed in immediately and goes to `safeNext(?next)` (default `/`), with a one-time `.toast.tone-on_track` reading "✓ Welcome, <name>. You're signed in as a Viewer — ask an admin if you need to import the plan." (or "…as an Admin." for an `ADMIN_EMAILS` sign-up).

The server re-checks every rule. Client checks are only for quick feedback.

## update password (`/update-password`): `update-password.html`
- **Forced** (A): the user is signed in with `mustChangePassword`.
  - It uses the auth card with no header.
  - Heading "Set a new password", intro "An admin reset your password. Choose a new one to continue, <first name>."
  - A `.notice.tone-at_risk` reading "Required before you can open the plan" / "Signed in as <email>".
  - Fields: New password and Repeat new password, with the button "Save and continue". There's no current-password field.
  - Foot: "Not you? Sign out".
  - The client gate sends every other route here while the flag is set.
- **Voluntary** (B): reached from the user menu's "Change password".
  - The app header shows with crumbs "Timeline / Change password" and the `UserMenu`.
  - Heading "Change password", intro "For <email>".
  - Fields: Current password, New password and Repeat new password, with the button "Save". A "Cancel" link goes back.
- **Errors** (C): "Current password is wrong." / "At least 10 characters." / "Passwords don't match." / "The new password can't be the same as the current one."
- **Success** (D):
  - The toast reads "✓ Password updated. You're still signed in here; other devices were signed out."
  - In forced mode the user continues to `safeNext(?next)`. In voluntary mode they go back to the previous page, or `/`.

## app header by role (timeline + target pages): `header-roles.html`
```
[logo] Roadline │ title / meta (ellipsis)   …spacer…  [page actions] [HL Hung Lay [Editor] ▾]
```
- **Editor or Admin** (A): the page actions are unchanged ("Import workbook" on the timeline), and the user chip comes last.
- **Viewer** (B): there's no Import button. A `.readonly` hint (eye icon plus "Read-only") takes its place.
- **User chip**:
  - `button.user-chip` with `aria-haspopup="menu"`, `aria-expanded` and `aria-label="Account: <name> (<Role>)"`.
  - It holds a 30px `.avatar` with initials, the `.name` and a role `.badge`: Admin is `tone-done`, Editor is `tone-on_track`, Viewer is `tone-not_started`.
- **Menu** (C, and `admin.html` F):
  - A `.card.menu` with `role="menu"`, holding the avatar, name, email and a role line:
    - Viewer: "Viewer — you can view the plan. Ask an editor to import a new workbook."
    - Editor: "Editor — you can import and replace the plan for everyone."
    - Admin: "Admin — you can import the plan and manage who has access."
  - Then, for admins only, a `.btn` link "Admin · users & import log" to `/admin`.
  - Then, for everyone, a `.btn` link "Change password" to `/update-password`.
  - Last, a `.btn` "Sign out" (a POST form to `/auth/signout`).
  - Esc, an outside click or a route change closes the menu.
- **Narrow**: `.plan-meta` text is ellipsised. Below 900px the chip name and the "Read-only" label hide.

## viewer empty state (no plan imported): `header-roles.html` D
- The `.empty-state` section with `aria-label="No plan loaded"` keeps the heading "No plan loaded yet".
- The intro reads "An editor hasn't imported… Once they do, the timeline shows up here for everyone."
- Below it, a solid-border `.drop.static` holds a person icon, **"Ask an editor to import the workbook"**, and "Only editors can import or replace the plan."
- There's no file picker, drag/drop or formats cards. Editors and admins see the existing v2 `EmptyState`.

## admin (`/admin`, `/admin/imports`, admins only): `admin.html`
**Layout**: a header bar with crumbs "Timeline / Admin" and the `UserMenu`; `h2` "Admin" with the intro "Who can open Roadline and who can import the plan."; then `.tabs` **Users** (count) | **Import log**. The tab comes from the route.

**Users tab** (A): a `.card` with `aria-label="Users"`.
- Toolbar: a `.search` input that filters name/email on the client, a `.seg` role filter `All · Admins · Editors · Viewers · Disabled` with counts, and the hint "People appear here once they create an account."
- `table.users` columns: User (avatar, name, email, plus a `tone-at_risk` "Must update password" badge while the flag is set) · Role · Last sign-in · Signed up · actions.
- Role cell: a `select.role-sel` with Viewer / Editor / Admin and `aria-label="Role for <name>"`.
  - **Locked** rows (emails in `ADMIN_EMAILS`) show an Admin badge plus "🔒 from server settings" instead.
  - **Your own row** shows "You" in the actions cell, with no select and no actions.
- Actions (`.btn.sm`): **Reset password**, **Sign out everywhere**, **Disable**. A disabled row is dimmed, shows a `tone-behind` "Disabled" badge plus "was <Role>", and has a single **Enable** button.
- Order: admins, editors, viewers, disabled; then by name.

**Saving** (B):
- A role change saves at once, and the select is disabled while it saves.
- A `.toast.tone-on_track` (`role="status"`) confirms, e.g. "✓ An Nguyen is now an Editor. It applies on their next page load." After a reset it reads "✓ <name>'s password is now **1111**. Tell them — they'll set a new one at next sign-in."
- On failure, a `.toast.tone-behind` (`role="alert"`) appears and the select reverts.
- Toasts auto-hide after 5 s.

**Confirm dialogs** (C, C2) use `.card.dialog` with `role="dialog"`. Escape cancels.

| Action | Title | Body | Buttons |
|---|---|---|---|
| Disable | "Disable <name>?" | as in the mockup | Cancel / Disable |
| Sign out everywhere | "Sign out <name> everywhere?" | — | Cancel / Sign out |
| Reset password | "Reset <name>'s password?" | "The password becomes 1111. <email> is signed out everywhere now and must choose a new password at next sign-in." | Cancel / Reset to 1111 |

Enable needs no confirm.

**Import log tab** (D): columns When · Who · File (name · size) · Outcome badge · Details.

| Outcome | Badge |
|---|---|
| `ok` | `tone-on_track` "Imported" |
| `needs_mapping` | `tone-at_risk` "Needed mapping" |
| `invalid_mapping` | `tone-at_risk` "Mapping refused" |
| `forbidden` | `tone-behind` "Not allowed" |
| `invalid_plan`, `no_file`, `file_too_large`, `unsupported_type` | `tone-behind` "Rejected" |

- Details: "plan #<id>" (plus "(current)"), "<n> new words", or the first problem (80 chars max, then "…").
- 50 per page, with Newer / Older buttons.

**States** (E):
- Loading: skeleton rows with "Loading users…".
- Empty log: "No imports yet".
- A non-admin at `/admin` sees the "Admins only" card ("You're signed in as a <Role>…") and "Back to timeline".

**Components**:
- New: `src/client/pages/admin-page.tsx:AdminPage`, `components/users-table.tsx:UsersTable`, `components/import-log.tsx:ImportLog`, `components/confirm-dialog.tsx:ConfirmDialog`.
- Reused: `UserMenu`, `.card`, `.btn`, `.seg`, `.badge`, `.tone-*`, `.avatar`, `.crumbs`.
- New classes from `admin.html`: `.btn.sm`, `.tabs`, `.toolbar`, `.search`, `table.users`, `.role-sel`, `.lock`, `.toast`, `.dialog-back`, `.dialog`, `.skeleton`.

## Auth components
- New: `src/client/pages/signin-page.tsx:SignInPage`, `pages/signup-page.tsx:SignUpPage`, `pages/update-password-page.tsx:UpdatePasswordPage`, `components/auth-card.tsx:AuthCard` (Brand + heading + intro + notice + children + foot, shared by the three pages), `components/field.tsx:Field` (label, input, hint, error), `components/user-menu.tsx:UserMenu`.
- Classes from `signin.html`: `.auth`, `.auth-card`, `.field`, `.hint`, `.err`, `.notice`, `.foot`, `.spin`.

## Gate (no visible screen)
- While `/api/me` loads: `<p className="muted">Loading…</p>`.
- 401 → `<Navigate to="/signin?next=<path+search>">`.
- `mustChangePassword` → every route except `/update-password` redirects to `/update-password?next=<path+search>`.
