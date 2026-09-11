# FEAT 5 — CRM User Configuration: Implementation Plan

> **Scope:** Roles, Teams, Groups (chat + meetings), Organization profile, User profiles  
> **Architecture:** Frontend-only Angular (signals), no HTTP calls, fully seeded  
> **Prompting strategy:** 8 isolated micro-prompts, sequenced — each targets a single file

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Feature Scope](#2-feature-scope)
3. [Data Model](#3-data-model)
4. [State Mutation Methods](#4-state-mutation-methods)
5. [Micro-Prompts (Isolated, Sequenced)](#5-micro-prompts-isolated-sequenced)
6. [UI Specification](#6-ui-specification)
7. [Seed Data Reference](#7-seed-data-reference)
8. [File Map](#8-file-map)
9. [Verification Plan](#9-verification-plan)

---

## 1. Executive Summary

FEAT 5 introduces full user configuration management to the CRM. Since the application is frontend-only (no backend, no HTTP), all state lives in Angular signals and is pre-populated with realistic seed data so every screen is non-empty on first load.

The feature delivers five capabilities:

- **Organization profile** — name, logo initials, industry, timezone, fiscal year
- **Roles** — 5 predefined roles (admin, manager, salesperson, support, viewer) with permission matrices
- **Teams** — department-scoped groups of users with a designated lead, full member management
- **Groups** — cross-team groups for simulated group chat and meeting scheduling
- **User profiles** — per-user settings, preferences, role/team assignment, deactivation

**Key architectural decisions:**
- Roles are a **constant** (`CRM_ROLES`), not a signal — they are app-defined, not user-editable
- Avatar colors and initials are **derived programmatically** from user data — never stored
- All panels are **in-flow** (no `position: fixed`) to avoid iframe viewport collapse in Angular
- `currentUserId` is the single source of truth for permission-gated UI
- The sidebar user widget (bottom of sidebar) sets the "active user" for the demo — defaults to the seeded admin

---

## 2. Feature Scope

### 2.1 Organization Profile
Name, logo initials, logo color, industry, timezone, fiscal year start month. Displayed in the sidebar header and on the `/settings/organization` page. Editable by admin only.

### 2.2 Roles
Five predefined roles with a permissions object controlling which actions and UI elements are available:

| Role | Key capabilities |
|---|---|
| `admin` | Full access — manage users, roles, teams, delete records |
| `manager` | Manage their team's members, view all deals |
| `salesperson` | Create/update leads and deals, create groups |
| `support` | Manage tickets, create groups, schedule meetings |
| `viewer` | Read-only access across all modules |

### 2.3 Teams
Named groups scoped to a department (Sales, Operations, Finance, Support, Custom). Each team has:
- One Team Lead (must have `manager` role)
- Any number of members (users with any role)
- A color for UI differentiation

A user belongs to one primary team. Removing a team lead requires first transferring the lead role.

### 2.4 Groups — Chat & Meetings
Cross-team groups for communication. Any user can create a group and add members from any team. Each group has:
- A simulated **chat thread** (messages stored in `groupMessages` signal)
- A **meetings list** with scheduling (meetings stored in `groupMeetings` signal)

All send/receive/schedule actions write to signals — zero HTTP.

### 2.5 User Profile & Settings
Each user has a full profile page with:
- Editable: display name, job title, phone
- Role and team assignment (admin-only for role changes)
- Notification preferences (4 toggles, saved immediately on change)
- Language preference
- Activity summary (member since, last active, group memberships)
- Deactivation (admin-only, two-step confirmation)

---

## 3. Data Model

All interfaces are added to `crm-state.service.ts`. Signals are initialized with seed data imported from `src/app/data/seed-data.ts`.

### 3.1 Organization

```typescript
export interface Organization {
  id: string;
  name: string;
  logoInitials: string;      // e.g. "ACG" for Achraf Consulting Group
  logoColor: string;         // hex accent for avatar background
  industry: string;
  timezone: string;          // e.g. "Africa/Casablanca"
  fiscalYearStart: number;   // 1–12 (month number)
  createdAt: Date;
}

// Signal:
organization = signal<Organization>(SEED_ORG);
```

### 3.2 Role (constant, not a signal)

```typescript
export type RoleId = 'admin' | 'manager' | 'salesperson' | 'support' | 'viewer';

export interface CrmRole {
  id: RoleId;
  label: string;
  description: string;
  permissions: {
    canManageUsers: boolean;
    canManageTeams: boolean;
    canManageRoles: boolean;
    canViewAllDeals: boolean;
    canDeleteRecords: boolean;
    canCreateGroups: boolean;
    canScheduleMeetings: boolean;
  };
}

// Constant — roles are app-defined, never user-editable:
export const CRM_ROLES: CrmRole[] = [
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full access to all settings and records',
    permissions: {
      canManageUsers: true,
      canManageTeams: true,
      canManageRoles: true,
      canViewAllDeals: true,
      canDeleteRecords: true,
      canCreateGroups: true,
      canScheduleMeetings: true,
    },
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Manage team members and view all deals',
    permissions: {
      canManageUsers: true,       // own team only
      canManageTeams: true,       // own team only
      canManageRoles: false,
      canViewAllDeals: true,
      canDeleteRecords: false,
      canCreateGroups: true,
      canScheduleMeetings: true,
    },
  },
  {
    id: 'salesperson',
    label: 'Sales',
    description: 'Create and update leads and deals',
    permissions: {
      canManageUsers: false,
      canManageTeams: false,
      canManageRoles: false,
      canViewAllDeals: false,
      canDeleteRecords: false,
      canCreateGroups: true,
      canScheduleMeetings: true,
    },
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Manage support tickets and communications',
    permissions: {
      canManageUsers: false,
      canManageTeams: false,
      canManageRoles: false,
      canViewAllDeals: false,
      canDeleteRecords: false,
      canCreateGroups: true,
      canScheduleMeetings: true,
    },
  },
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access across all modules',
    permissions: {
      canManageUsers: false,
      canManageTeams: false,
      canManageRoles: false,
      canViewAllDeals: false,
      canDeleteRecords: false,
      canCreateGroups: false,
      canScheduleMeetings: false,
    },
  },
];
```

### 3.3 User

```typescript
export interface CrmUser {
  id: string;
  displayName: string;
  email: string;
  initials: string;          // auto-derived on creation: first + last name initials
  avatarColor: string;       // one of 6 palette colors, cycled by userId hash
  roleId: RoleId;
  teamId: string | null;     // null = unassigned
  isActive: boolean;
  phone?: string;
  jobTitle?: string;
  preferences: {
    language: 'en' | 'fr' | 'ar' | 'es';
    notifyOnLeadAssign: boolean;
    notifyOnDealUpdate: boolean;
    notifyOnMention: boolean;
  };
  createdAt: Date;
  lastActiveAt: Date;
}

// Signal:
users = signal<CrmUser[]>(SEED_USERS);

// Computed:
activeUsers = computed(() => this.users().filter(u => u.isActive));
```

### 3.4 Team

```typescript
export interface CrmTeam {
  id: string;
  name: string;
  department: 'Sales' | 'Operations' | 'Finance' | 'Support' | 'Custom';
  description?: string;
  leadUserId: string;        // must reference a user with roleId 'manager'
  memberUserIds: string[];   // includes the lead
  color: string;             // team badge color (hex)
  createdAt: Date;
}

// Signal:
teams = signal<CrmTeam[]>(SEED_TEAMS);

// Computed:
teamMemberMap = computed(() =>
  new Map(this.teams().map(t => [t.id, t.memberUserIds]))
);
```

### 3.5 Group, Messages & Meetings

```typescript
export interface CrmGroup {
  id: string;
  name: string;
  description?: string;
  createdByUserId: string;
  memberUserIds: string[];   // cross-team — any active user
  createdAt: Date;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderUserId: string;
  content: string;
  sentAt: Date;
  readByUserIds: string[];
}

export interface GroupMeeting {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes: number;
  organizerUserId: string;
  attendeeUserIds: string[];
  status: 'scheduled' | 'cancelled' | 'completed';
}

// Signals:
groups        = signal<CrmGroup[]>(SEED_GROUPS);
groupMessages = signal<GroupMessage[]>(SEED_MESSAGES);
groupMeetings = signal<GroupMeeting[]>(SEED_MEETINGS);
```

### 3.6 Avatar Color Utility

```typescript
// Palette — 6 colors cycled by userId hash
const AVATAR_COLORS = [
  '#7F77DD',  // purple
  '#1D9E75',  // teal
  '#D85A30',  // coral
  '#378ADD',  // blue
  '#BA7517',  // amber
  '#D4537E',  // pink
];

function getAvatarColor(userId: string): string {
  const hash = userId.charCodeAt(userId.length - 1);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function deriveInitials(displayName: string): string {
  const parts = displayName.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
```

---

## 4. State Mutation Methods

All methods are added to `CrmStateService`. Guards are enforced inside each method — never in the component.

| Method | Signature | Side effects & guards |
|---|---|---|
| `addUser` | `(draft: Omit<CrmUser,'id'\|'initials'\|'createdAt'>) → CrmUser` | Auto-derives initials and avatarColor, generates id, appends to users signal |
| `updateUser` | `(id: string, patch: Partial<CrmUser>) → void` | Merges patch; re-derives initials if displayName changed |
| `deactivateUser` | `(id: string) → void` | Guard: throws if user is the last active admin. Sets `isActive=false`, removes from all `team.memberUserIds` |
| `addTeam` | `(draft: Omit<CrmTeam,'id'\|'createdAt'>) → CrmTeam` | Generates id, appends to teams signal, sets `leadUser.teamId` |
| `updateTeam` | `(id: string, patch: Partial<CrmTeam>) → void` | Merges patch |
| `addTeamMember` | `(teamId: string, userId: string) → void` | Appends userId to `team.memberUserIds`, sets `user.teamId` |
| `removeTeamMember` | `(teamId: string, userId: string) → void` | Guard: throws if userId === team.leadUserId ("Transfer lead first"). Removes from memberUserIds, nulls `user.teamId` |
| `updateUserRole` | `(userId: string, roleId: RoleId) → void` | Guard: throws if demoting the last active admin. Updates `user.roleId` |
| `createGroup` | `(draft: Omit<CrmGroup,'id'\|'createdAt'>) → CrmGroup` | Generates id, appends to groups signal |
| `sendGroupMessage` | `(groupId: string, senderId: string, content: string) → void` | Creates GroupMessage with `sentAt = new Date()`, appends to groupMessages signal |
| `scheduleMeeting` | `(draft: Omit<GroupMeeting,'id'\|'status'>) → GroupMeeting` | Creates GroupMeeting with `status = 'scheduled'`, appends to groupMeetings signal |

### Guard implementations

```typescript
// Last-admin guard (reused in deactivateUser and updateUserRole)
private assertNotLastAdmin(userId: string): void {
  const activeAdmins = this.users().filter(u => u.isActive && u.roleId === 'admin');
  if (activeAdmins.length === 1 && activeAdmins[0].id === userId) {
    throw new Error("Can't remove the last admin. Assign another admin first.");
  }
}

// Team lead guard (reused in removeTeamMember)
private assertNotTeamLead(teamId: string, userId: string): void {
  const team = this.teams().find(t => t.id === teamId);
  if (team?.leadUserId === userId) {
    throw new Error("Transfer team lead before removing this member.");
  }
}
```

### Permission-gated UI pattern

```typescript
// Add to CrmStateService
currentUserId = signal<string>('usr_rachid');  // default: seeded admin

currentUserPermissions = computed(() => {
  const user = this.users().find(u => u.id === this.currentUserId());
  return CRM_ROLES.find(r => r.id === user?.roleId)?.permissions ?? {};
});
```

In templates:
```html
<button *ngIf="crmState.currentUserPermissions().canManageUsers">
  Add user
</button>
```

---

## 5. Micro-Prompts (Isolated, Sequenced)

Each prompt is self-contained. Run them in order — later prompts depend on interfaces and signals from earlier ones.

---

### Prompt 1 of 8 — State service: data model & signals

**File:** `src/app/services/crm-state.service.ts`

```
In crm-state.service.ts, add the following without removing any existing signals or methods:

1. Export these interfaces: Organization, CrmRole (with RoleId union type), CrmUser, CrmTeam,
   CrmGroup, GroupMessage, GroupMeeting. Use the exact field names from the data model spec.

2. Export a constant CRM_ROLES: CrmRole[] with entries for: admin, manager, salesperson,
   support, viewer — each with a complete permissions object (all boolean fields).

3. Add signals initialized to empty arrays or null (seed data wired in prompt 2):
   - organization = signal<Organization | null>(null)
   - users = signal<CrmUser[]>([])
   - teams = signal<CrmTeam[]>([])
   - groups = signal<CrmGroup[]>([])
   - groupMessages = signal<GroupMessage[]>([])
   - groupMeetings = signal<GroupMeeting[]>([])
   - currentUserId = signal<string>('')

4. Add computed:
   - activeUsers = computed(() => users filtered by isActive === true)
   - currentUserPermissions = computed(() => permissions object of the currentUserId user)

5. Add utility functions (not signals, just class methods):
   - usersByTeam(teamId: string): CrmUser[]  — returns members of that team
   - groupsByUser(userId: string): CrmGroup[] — returns groups where userId is in memberUserIds
   - deriveInitials(name: string): string     — first + last name initials
   - getAvatarColor(userId: string): string   — cycles 6 hex colors by userId char hash

6. Add all 11 mutation methods with guards:
   addUser, updateUser, deactivateUser, addTeam, updateTeam, addTeamMember,
   removeTeamMember, updateUserRole, createGroup, sendGroupMessage, scheduleMeeting.

   Guard in updateUserRole and deactivateUser: if the target user is the last active admin,
   throw new Error("Can't remove the last admin. Assign another admin first.").
   Guard in removeTeamMember: if userId === team.leadUserId,
   throw new Error("Transfer team lead before removing this member.").
```

---

### Prompt 2 of 8 — Seed data

**Files:** `src/app/data/seed-data.ts`, `src/app/services/crm-state.service.ts`

```
Create src/app/data/seed-data.ts. Export the following constants, using the exact
interface field names from crm-state.service.ts:

SEED_ORG (Organization):
  name: "Achraf Consulting Group", logoInitials: "ACG", logoColor: "#7F77DD",
  industry: "Technology", timezone: "Africa/Casablanca", fiscalYearStart: 1

SEED_USERS (CrmUser[]) — 13 users:

  Sales team (teamId: 'team_sales'):
    Ahmed Bennani      | a.bennani@acg.ma       | manager     | Sales Director
    Fatima Zahra El Idrissi | fz.elidrissi@acg.ma | salesperson | Senior Account Executive
    Karim Tazi         | k.tazi@acg.ma          | salesperson | Account Executive
    Nadia Berrada      | n.berrada@acg.ma       | salesperson | Business Development

  Operations team (teamId: 'team_ops'):
    Youssef Alami      | y.alami@acg.ma         | manager     | Operations Manager
    Layla Cherkaoui    | l.cherkaoui@acg.ma     | salesperson | Operations Analyst
    Omar Fassi         | o.fassi@acg.ma         | salesperson | Project Coordinator

  Finance team (teamId: 'team_finance'):
    Samira Benjelloun  | s.benjelloun@acg.ma    | manager     | Finance Manager
    Hassan El Amrani   | h.elamrani@acg.ma      | viewer      | Financial Analyst

  Support team (teamId: 'team_support'):
    Zineb Tahiri       | z.tahiri@acg.ma        | manager     | Support Team Lead
    Mehdi Qadiri       | m.qadiri@acg.ma        | support     | Support Specialist
    Aya Mansouri       | a.mansouri@acg.ma      | support     | Support Specialist

  Unassigned admin (teamId: null):
    Rachid Ouazzani    | r.ouazzani@acg.ma      | admin       | CEO

  For each user: set isActive: true, generate initials from name, assign avatarColor
  by cycling AVATAR_COLORS using the last char of their id, set preferences all true,
  language 'fr', createdAt and lastActiveAt using relative Date offsets.

SEED_TEAMS (CrmTeam[]):
  { id: 'team_sales',   name: 'Sales',      department: 'Sales',      leadUserId: 'usr_ahmed',   color: '#1D9E75' }
  { id: 'team_ops',     name: 'Operations', department: 'Operations', leadUserId: 'usr_youssef', color: '#378ADD' }
  { id: 'team_finance', name: 'Finance',    department: 'Finance',    leadUserId: 'usr_samira',  color: '#BA7517' }
  { id: 'team_support', name: 'Support',    department: 'Support',    leadUserId: 'usr_zineb',   color: '#D4537E' }
  memberUserIds for each team must exactly match the users listed above.

SEED_GROUPS (CrmGroup[]) — 3 groups:
  'grp_sales_ops':     name: "Sales & Ops Sync"     — members: usr_ahmed, usr_fatima, usr_youssef, usr_layla
  'grp_q3_close':      name: "Q3 Close Team"        — members: usr_ahmed, usr_fatima, usr_youssef, usr_samira
  'grp_support_esc':   name: "Support Escalation"   — members: usr_zineb, usr_mehdi, usr_aya, usr_rachid

SEED_MESSAGES (GroupMessage[]):
  Sales & Ops Sync (4 messages):
    - Ahmed: "Pipeline review set for Thursday — Fatima please bring Q3 deal updates"
    - Youssef: "Confirmed. We'll also review the Casablanca account handoff"
    - Fatima: "DIGITAL ABC deal moved to Negotiation — high priority this week"
    - Ahmed: "Great. Let's target close before end of month"

  Q3 Close Team (3 messages):
    - Samira: "Finance has approved the budget projections for Q3 targets"
    - Ahmed: "Excellent — we're at 78% of quota, strong close expected"
    - Youssef: "Operations can support 2 additional enterprise onboardings in Q3"

  Support Escalation (5 messages):
    - Zineb: "Critical ticket #TK-0891 needs immediate escalation — client SLA breach"
    - Mehdi: "Investigating — root cause appears to be the API integration layer"
    - Rachid: "Loop in the client's technical contact. I'll handle executive communication"
    - Aya: "Patch deployed to staging. Testing now"
    - Zineb: "Client confirmed resolution. Closing escalation — post-mortem Friday"

  Use sentAt offsets: messages spread across last 2–4 days using Date.now() - N * 86400000.

SEED_MEETINGS (GroupMeeting[]):
  Sales & Ops Sync:     "Weekly Pipeline Sync"  — next Monday 10:00 AM, 60 min, status: 'scheduled'
  Q3 Close Team:        "Q3 Forecast Review"    — next Friday 2:00 PM, 90 min, status: 'scheduled'
  Support Escalation:   "Post-Mortem Debrief"   — next Wednesday 3:00 PM, 60 min, status: 'scheduled'
  Support Escalation:   "Daily Standup"         — tomorrow 9:00 AM, 30 min, status: 'scheduled'

After creating seed-data.ts, update crm-state.service.ts to import all seed exports
and pass them as initial values to the corresponding signals. Set currentUserId initial
value to 'usr_rachid' (the seeded admin).
```

---

### Prompt 3 of 8 — Organization settings page

**File:** `src/app/pages/org-settings.component.ts`

```
Create src/app/pages/org-settings.component.ts as a standalone Angular component
with inline template and styles.

Layout — two columns on desktop (CSS grid, 1fr 1fr), stacked on mobile:

LEFT COLUMN — Organization card (raised card, 12px border-radius):
  - Large initials circle: 64px, logoColor background, white text, logoInitials
  - Organization name: displayed as text with a pencil icon button beside it.
    Clicking pencil swaps text for an <input> bound to a local editName signal.
    A "Save" button below calls crmState.updateOrganization({ name: editName() })
    then shows a 2-second auto-dismissing green success banner ("Changes saved")
    that uses *ngIf and a setTimeout to hide after 2000ms.
  - Below name: Industry (dropdown to edit), Timezone (text display), Fiscal year
    start (month dropdown: January–December as numbers 1–12).
  - Edit mode for all fields toggled by the same pencil icon.

RIGHT COLUMN — Metric cards (2x2 grid):
  - Total users       → users().length (all, including inactive)
  - Active users      → activeUsers().length
  - Active teams      → teams().length
  - Groups            → groups().length
  Each card: label in 12px var(--text-secondary), value in 22px font-weight 500.

BELOW COLUMNS — Danger zone section:
  - Red-bordered card (border: 0.5px solid var(--border-danger), background: var(--bg-danger))
  - Title "Danger zone" in var(--text-danger)
  - "Deactivate organization" button — disabled attribute set, cursor: not-allowed,
    title attribute: "Contact support to deactivate your organization"
  - This button has no click handler — it is purely display.

Route: /settings/organization (wired in prompt 8).
```

---

### Prompt 4 of 8 — Users management page

**File:** `src/app/pages/users.component.ts`

```
Create src/app/pages/users.component.ts as a standalone Angular component.

HEADER ROW:
  - "Users" h1 title
  - Count badge showing activeUsers().length
  - "+ Add user" button (right-aligned) that toggles a local signal showAddPanel

FILTER BAR (below header):
  - Search input: filters by displayName or email (case-insensitive, local signal searchTerm)
  - Role dropdown: options "All roles", "Admin", "Manager", "Sales", "Support", "Viewer"
  - Team dropdown: options "All teams", "Unassigned", then each team name from teams()
  - Status toggle: "Active only" (default) / "All users" — toggles a local showInactive signal

  Filtered user list is a computed() combining all four filters.

USER TABLE:
  Columns: Avatar+Name | Email | Role badge | Team | Status | Actions (3-dot menu)

  Avatar: 36px circle, initials, avatarColor background, white text
  Role badge: colored pill per role (admin=purple bg-pro, manager=blue bg-accent,
              salesperson=green bg-success, support=amber bg-warning, viewer=gray surface-1)
  Team: team name or "—" if unassigned
  Status: "Active" (green) / "Inactive" (gray) pill
  3-dot menu: "Edit", "Change role", "Deactivate" — shown as a dropdown toggled per row

EDIT PANEL (inline, not a modal — use in-flow max-height transition):
  Triggered by "+ Add user" or "Edit" in the 3-dot menu.
  Panel fields: Display name (required), Email (required), Job title, Phone,
                Role dropdown (all 5 roles), Team dropdown (all teams + "Unassigned")
  Primary CTA: "Add user" (new) or "Save changes" (edit) — calls crmState.addUser()
               or crmState.updateUser() respectively.
  Cancel button collapses the panel.

CHANGE ROLE INLINE:
  Clicking "Change role" in the 3-dot menu renders a <select> directly in the role
  cell of that row. On change, call crmState.updateUserRole(userId, newRoleId).
  If the method throws (last-admin guard), show the error string in red below the
  select. On blur or Escape, collapse the select and restore the badge.

DEACTIVATE:
  Clicking "Deactivate" shows a two-step confirmation row below the user:
  "Deactivate [name]? This cannot be undone." with [Cancel] [Confirm] buttons inline.
  Confirm calls crmState.deactivateUser(userId). If it throws, show the error inline.
  On success, the user disappears from the list (active filter).

EMPTY STATE (when no users match filters):
  Centered area: icon ti-users-off, text "No users match your filters",
  "Clear filters" button that resets all filter signals to their defaults.

Route: /settings/users (wired in prompt 8).
```

---

### Prompt 5 of 8 — Teams management page

**File:** `src/app/pages/teams.component.ts`

```
Create src/app/pages/teams.component.ts as a standalone Angular component.

HEADER:
  "Teams" h1, count badge, "+ Create team" button (toggles showCreateForm signal)

TEAM CARDS GRID:
  CSS grid: repeat(auto-fit, minmax(300px, 1fr)), gap 16px
  Each card (raised, 12px border-radius):
    - Top row: colored department badge (team.color), team name in 15px font-weight 500
    - Lead row: 36px avatar of the lead user (initials + avatarColor), lead name, "Lead" label
    - Member count: "N members" in var(--text-secondary)
    - Avatar stack: first 4 members as 28px overlapping circles (each offset -8px left),
      "+N" label if more than 4. Use z-index ascending so first avatar is on top.
    - "View members" toggle button — expands accordion below the card

  MEMBER ACCORDION (in-flow, max-height transition):
    List of all team members:
      - Avatar (28px) + name + role badge
      - "×" remove button: calls crmState.removeTeamMember(teamId, userId).
        If throws (lead guard), show error inline next to the button.
        The lead's row shows a crown icon (ti-crown) instead of "×".
    "Transfer lead" link next to the crown: shows a <select> of current members
    with roleId === 'manager'. On change, calls crmState.updateTeam(teamId,
    { leadUserId: selectedId }). Collapses on select.
    "+ Add member" row at the bottom: an input that searches activeUsers() not
    already in this team. Shows a dropdown of matches. Clicking a match calls
    crmState.addTeamMember(teamId, userId).

CREATE TEAM FORM (inline, below header, max-height transition):
  Fields: Team name (required), Department (dropdown: Sales/Operations/Finance/Support/Custom),
          Team Lead (dropdown of users with roleId === 'manager'),
          Description (optional textarea),
          Color (6 preset color swatches as clickable circles)
  CTA: "Create team" — calls crmState.addTeam(draft). On success, collapses form
       and scrolls to the new card.

Route: /settings/teams (wired in prompt 8).
```

---

### Prompt 6 of 8 — Groups page (chat & meetings)

**File:** `src/app/pages/groups.component.ts`

```
Create src/app/pages/groups.component.ts as a standalone Angular component.
This is the most complex component — read all instructions before coding.

LAYOUT: Two-column flex row. Left panel ~280px fixed width, right panel flex:1.
Do NOT use position:fixed. Both columns are normal in-flow divs.

LEFT PANEL — Group list:
  "+ Create group" button at top (toggles showCreateForm)
  List of all groups (not filtered by user for the demo — show all groups):
    Each row: group name (14px, font-weight 500), last message preview (12px,
    var(--text-muted), truncated to 1 line with text-overflow:ellipsis),
    time of last message (12px var(--text-muted), relative: "2h ago", "yesterday").
    Unread badge: red circle with count, shown if any messages in this group have
    currentUserId NOT in readByUserIds.
    Clicking a row sets selectedGroupId signal. Active row gets background var(--surface-1)
    and left border 2px solid var(--border-accent).

RIGHT PANEL — Group workspace:
  When selectedGroupId is null: empty state with ti-messages icon,
  "Select a group to start chatting" text.

  When a group is selected:
    Group name as h2, member count as subtitle.
    Two tabs: "Chat" and "Meetings" (tab bar with border-bottom active indicator).

    CHAT TAB:
      Message thread: scrollable div with id="message-thread".
      Each message:
        - Other users: left-aligned. Avatar (28px) + name above, message bubble
          (background var(--surface-1), border 0.5px var(--border)), timestamp below.
        - Current user (currentUserId): right-aligned. Bubble background var(--bg-accent),
          text color var(--text-accent). No avatar — "You" label in 11px var(--text-muted).
      After rendering, scroll thread to bottom: setTimeout(() => {
        const el = document.getElementById('message-thread');
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
      Input row at bottom: text <input> + "Send" button.
      On send: call crmState.sendGroupMessage(selectedGroupId(), currentUserId(), inputValue).
               Clear the input. Thread auto-scrolls.

    MEETINGS TAB:
      List of meetings for selected group, sorted by scheduledAt ascending.
      Each meeting card:
        - Title (14px font-weight 500), status badge (scheduled=blue, cancelled=gray, completed=green)
        - Date + time, duration, organizer name
        - Attendee avatar stack (28px, first 3 + "+N")
      "+ Schedule meeting" button at top-right of list toggles an inline form below:
        Fields: Title (required), Description, Date+time (datetime-local input),
                Duration (select: 30/60/90/120 min),
                Attendees (multi-select from group members: checkboxes with avatars)
        CTA: "Schedule meeting" — calls crmState.scheduleMeeting(draft). On success,
             collapses form and the new meeting appears in the list.

CREATE GROUP FORM (inline, at top of left panel when showCreateForm is true):
  Fields: Group name (required), Description (optional),
          Member search: input that searches activeUsers() by name.
          Shows matches as a dropdown. Selecting a user adds them as a chip below
          the input. Chips are removable (× button). Minimum 1 member.
  CTA: "Create group" — calls crmState.createGroup({ name, description,
       createdByUserId: currentUserId(), memberUserIds: selectedIds }).
       On success: collapses form, auto-selects the new group.

EMPTY STATE (no groups exist at all):
  Centered: ti-messages icon (48px), "Start a group to collaborate across teams",
  "+ Create your first group" button.

Route: /settings/groups, also aliased at /groups (wired in prompt 8).
```

---

### Prompt 7 of 8 — User profile page

**File:** `src/app/pages/user-profile.component.ts`

```
Create src/app/pages/user-profile.component.ts as a standalone Angular component.
It reads a :userId route param and looks up the user from crmState.users() signal.
If user is not found, show a 404-style message.

PROFILE HEADER (card):
  - 56px avatar circle (initials + avatarColor)
  - Display name (large, 18px font-weight 500)
    If currentUser is admin OR viewing own profile: pencil icon beside name.
    Edit mode: <input> replaces name text. On save, calls crmState.updateUser().
  - Job title (14px var(--text-secondary)), editable same way as name
  - Email (14px, not editable — email is immutable in this demo)
  - Phone (14px, editable)
  - Last active: "Last active 2 days ago" in 12px var(--text-muted)

ROLE & TEAM SECTION (below header, card):
  - Role: label "Role" + role badge. If viewer is admin: also show a role <select>
    that calls crmState.updateUserRole(userId, newRoleId) on change.
    If guard throws, show error inline in red below the select.
  - Team: label "Team" + team name as a chip (clicking navigates to /settings/teams).
    If user has no team: "— Unassigned" in var(--text-muted).

PREFERENCES SECTION (card):
  Title "Notification preferences"
  4 toggle switches (styled checkboxes as toggles):
    - "Notify on lead assign"   → user.preferences.notifyOnLeadAssign
    - "Notify on deal updates"  → user.preferences.notifyOnDealUpdate
    - "Notify on mentions"      → user.preferences.notifyOnMention
  Each toggle calls crmState.updateUser(userId, { preferences: { ...prefs, key: val } })
  immediately on change — no explicit Save button needed.

  Language dropdown:
    Options: English (en), Français (fr), العربية (ar), Español (es)
    Calls crmState.updateUser on change.

GROUPS SECTION (card):
  Title "Groups" + count badge
  List of groups the user belongs to: each as a chip with group name.
  Clicking a chip navigates to /groups (with that group pre-selected — pass groupId
  as a query param: /groups?groupId=grp_xxx).

ACTIVITY SECTION (card):
  - "Member since" + formatted createdAt date
  - "Last active" + relative time

DANGER ZONE (admin-only — *ngIf canManageUsers, card with danger border):
  "Deactivate account" button in var(--text-danger) color.
  On click: show a two-step confirmation row (inline, not a modal):
    "Deactivate [name]? This cannot be undone." + [Cancel] [Confirm Deactivation]
  Confirm calls crmState.deactivateUser(userId).
  On success: navigate to /settings/users.
  On error (guard): show error string in red, collapse confirmation.
  Do NOT show this section if viewing own profile (user.id === currentUserId()).

Route: /settings/users/:userId
```

---

### Prompt 8 of 8 — Routing, navigation & settings shell

**Files:** `src/app/app.routes.ts`, `src/app/pages/settings-shell.component.ts`, `src/app/app.ts`

```
Wire up all routes, create the settings shell, and update the main navigation.

1. SETTINGS SHELL COMPONENT (settings-shell.component.ts):
   Two-column layout: left sidebar nav ~200px, right side <router-outlet>.
   Left nav links (using routerLink, routerLinkActive):
     - Organization  → /settings/organization  (icon: ti-building)
     - Users         → /settings/users         (icon: ti-users)
     - Teams         → /settings/teams         (icon: ti-users-group)
     - Groups        → /settings/groups        (icon: ti-messages)
   Active link style: font-weight 500, color var(--text-accent),
   left border 2px solid var(--border-accent), background var(--bg-accent).

2. APP.ROUTES.TS — add these routes:
   {
     path: 'settings',
     component: SettingsShellComponent,
     children: [
       { path: '', redirectTo: 'organization', pathMatch: 'full' },
       { path: 'organization', component: OrgSettingsComponent },
       { path: 'users',        component: UsersComponent },
       { path: 'users/:userId', component: UserProfileComponent },
       { path: 'teams',        component: TeamsComponent },
       { path: 'groups',       component: GroupsComponent },
     ]
   },
   { path: 'groups', component: GroupsComponent },  // top-level alias

3. APP.TS (main navigation sidebar):
   Add two new nav items after the existing ones:
     - Groups    → /groups         (icon: ti-messages)
     - Settings  → /settings       (icon: ti-settings)

   SIDEBAR USER WIDGET (bottom of sidebar, always visible):
   A row pinned at the bottom showing the current user from crmState.currentUserId():
     - 36px avatar (initials + avatarColor)
     - Display name (13px font-weight 500)
     - Role badge (small, 11px)
   Clicking the widget navigates to /settings/users/[currentUserId].
   For the demo, currentUserId defaults to 'usr_rachid' (the seeded admin),
   so clicking shows Rachid Ouazzani's profile.

   The sidebar user widget gives the app a "logged-in user" context without any
   real auth — it makes the permission-gated UI meaningful.
```

---

## 6. UI Specification

### 6.1 Role badge tokens

| Role | Background | Text | Label |
|---|---|---|---|
| `admin` | `var(--bg-pro)` | `var(--text-pro)` | Admin |
| `manager` | `var(--bg-accent)` | `var(--text-accent)` | Manager |
| `salesperson` | `var(--bg-success)` | `var(--text-success)` | Sales |
| `support` | `var(--bg-warning)` | `var(--text-warning)` | Support |
| `viewer` | `var(--surface-1)` | `var(--text-secondary)` | Viewer |

### 6.2 Avatar sizes

| Context | Size |
|---|---|
| Compact list / avatar stack | 28px |
| Table row | 36px |
| Card header / team lead | 44px |
| Profile page | 56px |

Avatar stack: each avatar overlaps left by 8px. Apply `z-index` ascending (first avatar highest). Show first 4, then `"+N"` label in `var(--text-secondary)`.

### 6.3 Inline slide-in panels (no modals, no position:fixed)

Because `position: fixed` collapses the iframe viewport in this Angular setup, **all panels and forms expand inline** using a CSS max-height transition:

```css
.panel {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.25s ease, opacity 0.2s ease;
}
.panel.open {
  max-height: 800px;
  opacity: 1;
}
```

The panel pushes content down rather than overlaying it. This is the intended UX — do not attempt workarounds with `position: absolute` or overlay divs.

> ⚠️ **Critical:** Never use `position: fixed` or `overflow: hidden` on a parent wrapping `position: absolute` children. Both patterns cause the iframe to collapse to its minimum height.

### 6.4 Group chat message layout

```
Other user:                          Current user:
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ [AV] Ahmed Bennani           │     │                   You        │
│      ┌──────────────────┐    │     │    ┌──────────────────┐      │
│      │ Message text     │    │     │    │ Message text     │      │
│      └──────────────────┘    │     │    └──────────────────┘      │
│      2h ago                  │     │                  2h ago      │
└──────────────────────────────┘     └──────────────────────────────┘
bg: var(--surface-1)                 bg: var(--bg-accent)
text: var(--text-primary)            text: var(--text-accent)
```

Scroll-to-bottom after signal update:
```typescript
setTimeout(() => {
  const el = document.getElementById('message-thread');
  if (el) el.scrollTop = el.scrollHeight;
}, 0);
```

### 6.5 Shared components to create

Create these 3 reusable components before the page components to avoid duplication:

**`src/app/shared/user-avatar.component.ts`**
```typescript
// Inputs: userId?: string, initials?: string, color?: string, size: 28|36|44|56
// If userId provided, looks up user from CrmStateService to derive initials + color
// Renders: div circle with background=color, white text, font-size scaled to size
```

**`src/app/shared/role-badge.component.ts`**
```typescript
// Input: roleId: RoleId
// Renders: span pill with background and text color from the role badge token table above
// Looks up the role label from CRM_ROLES constant
```

**`src/app/shared/avatar-stack.component.ts`**
```typescript
// Input: userIds: string[], maxVisible: number = 4
// Renders: flex row of UserAvatarComponent at 28px, each offset -8px left
// If userIds.length > maxVisible: shows "+N" label after the stack
```

---

## 7. Seed Data Reference

### 7.1 Users

| Name | Email | Role | Team | Job title |
|---|---|---|---|---|
| Rachid Ouazzani | r.ouazzani@acg.ma | admin | — | CEO |
| Ahmed Bennani | a.bennani@acg.ma | manager | Sales | Sales Director |
| Fatima Zahra El Idrissi | fz.elidrissi@acg.ma | salesperson | Sales | Senior Account Executive |
| Karim Tazi | k.tazi@acg.ma | salesperson | Sales | Account Executive |
| Nadia Berrada | n.berrada@acg.ma | salesperson | Sales | Business Development |
| Youssef Alami | y.alami@acg.ma | manager | Operations | Operations Manager |
| Layla Cherkaoui | l.cherkaoui@acg.ma | salesperson | Operations | Operations Analyst |
| Omar Fassi | o.fassi@acg.ma | salesperson | Operations | Project Coordinator |
| Samira Benjelloun | s.benjelloun@acg.ma | manager | Finance | Finance Manager |
| Hassan El Amrani | h.elamrani@acg.ma | viewer | Finance | Financial Analyst |
| Zineb Tahiri | z.tahiri@acg.ma | manager | Support | Support Team Lead |
| Mehdi Qadiri | m.qadiri@acg.ma | support | Support | Support Specialist |
| Aya Mansouri | a.mansouri@acg.ma | support | Support | Support Specialist |

### 7.2 Teams

| Team | Department | Lead | Members | Color |
|---|---|---|---|---|
| Sales | Sales | Ahmed Bennani | Ahmed, Fatima Zahra, Karim, Nadia | `#1D9E75` |
| Operations | Operations | Youssef Alami | Youssef, Layla, Omar | `#378ADD` |
| Finance | Finance | Samira Benjelloun | Samira, Hassan | `#BA7517` |
| Support | Support | Zineb Tahiri | Zineb, Mehdi, Aya | `#D4537E` |

### 7.3 Groups & seeded content

**Sales & Ops Sync** (`grp_sales_ops`)
Members: Ahmed, Fatima Zahra, Youssef, Layla

Messages (spread over last 3 days):
1. Ahmed: "Pipeline review set for Thursday — Fatima please bring Q3 deal updates"
2. Youssef: "Confirmed. We'll also review the Casablanca account handoff"
3. Fatima: "DIGITAL ABC deal moved to Negotiation — high priority this week"
4. Ahmed: "Great. Let's target close before end of month"

Meeting: "Weekly Pipeline Sync" — next Monday 10:00 AM, 60 min

---

**Q3 Close Team** (`grp_q3_close`)
Members: Ahmed, Fatima Zahra, Youssef, Samira

Messages (spread over last 2 days):
1. Samira: "Finance has approved the budget projections for Q3 targets"
2. Ahmed: "Excellent — we're at 78% of quota, strong close expected"
3. Youssef: "Operations can support 2 additional enterprise onboardings in Q3"

Meeting: "Q3 Forecast Review" — next Friday 2:00 PM, 90 min

---

**Support Escalation** (`grp_support_esc`)
Members: Zineb, Mehdi, Aya, Rachid

Messages (spread over last 1 day):
1. Zineb: "Critical ticket #TK-0891 needs immediate escalation — client SLA breach"
2. Mehdi: "Investigating — root cause appears to be the API integration layer"
3. Rachid: "Loop in the client's technical contact. I'll handle executive communication"
4. Aya: "Patch deployed to staging. Testing now"
5. Zineb: "Client confirmed resolution. Closing escalation — post-mortem Friday"

Meetings:
- "Post-Mortem Debrief" — next Wednesday 3:00 PM, 60 min
- "Daily Standup" — tomorrow 9:00 AM, 30 min

---

## 8. File Map

### New files (11)

| File | Purpose |
|---|---|
| `src/app/data/seed-data.ts` | All seed exports: org, 13 users, 4 teams, 3 groups, messages, meetings |
| `src/app/pages/org-settings.component.ts` | Organization profile edit page with metric cards and danger zone |
| `src/app/pages/users.component.ts` | Users table with filters, inline add/edit panel, role change, deactivate |
| `src/app/pages/user-profile.component.ts` | Individual user profile: preferences, activity, admin deactivate |
| `src/app/pages/teams.component.ts` | Team cards grid, member management, create team form, lead transfer |
| `src/app/pages/groups.component.ts` | Two-panel groups page: chat thread, meeting scheduling, group creation |
| `src/app/pages/settings-shell.component.ts` | Settings section shell with left nav and router-outlet |
| `src/app/shared/user-avatar.component.ts` | Reusable avatar: accepts userId or initials+color, sizes 28/36/44/56 |
| `src/app/shared/role-badge.component.ts` | Reusable role badge: accepts RoleId, renders styled pill |
| `src/app/shared/avatar-stack.component.ts` | Overlapping avatar stack with +N overflow label |

### Modified files (4)

| File | Changes |
|---|---|
| `src/app/services/crm-state.service.ts` | New interfaces, signals, computed, 11 mutation methods, seed data import |
| `src/app/app.routes.ts` | Add /settings children and /groups alias |
| `src/app/app.ts` | Add Settings + Groups nav items; sidebar user widget |

---

## 9. Verification Plan

Run these checks in the browser after all 8 prompts are implemented. No test framework required.

### 9.1 State guards

| # | Test | Expected result |
|---|---|---|
| 1 | With only Rachid as admin, change his role to Manager in Users page | Red error: "Can't remove the last admin." Role stays admin |
| 2 | Try to deactivate Rachid from his profile page | Two-step confirmation appears; on confirm, guard throws and shows error inline |
| 3 | Try to remove Ahmed Bennani from Sales team (he is the lead) | "×" button disabled or shows "Transfer lead first" — removeTeamMember not called |

### 9.2 Users page

| # | Test | Expected result |
|---|---|---|
| 4 | Navigate to /settings/users on first load | 13 users visible in table, no empty state |
| 5 | Select "Manager" in role filter | Exactly 4 rows: Ahmed, Youssef, Samira, Zineb |
| 6 | Select "Support" in role filter | Exactly 2 rows: Mehdi, Aya |
| 7 | Click "+ Add user", fill form, submit | New user appears in table, count badge increments, user findable by search |
| 8 | Deactivate Karim Tazi (two-step confirm) | Karim gone from active list; Sales team shows 3 members on /settings/teams |

### 9.3 Teams page

| # | Test | Expected result |
|---|---|---|
| 9 | Navigate to /settings/teams | 4 team cards visible with correct member counts and lead names |
| 10 | Open Finance team member accordion, click "+ Add member", search "Nadia", select her | Finance count goes 2→3; Nadia's profile shows Finance as team |
| 11 | Create new team "Customer Success", Sales dept, Youssef as lead | New card appears in grid |

### 9.4 Groups & communication

| # | Test | Expected result |
|---|---|---|
| 12 | Navigate to /groups, select "Sales & Ops Sync" | 4 seeded messages visible in correct order |
| 13 | Type a message and click Send | Message appears at bottom of thread immediately (right-aligned for current user); group list preview updates |
| 14 | Switch to Meetings tab | 1 seeded meeting visible with correct title, date, duration |
| 15 | Click "+ Schedule meeting", fill form, submit | New meeting card appears in list with status "Scheduled" |
| 16 | Create group "Finance + Support Sync" with Samira and Zineb | New group in left panel; both users shown as members |

### 9.5 Organization settings & user profile

| # | Test | Expected result |
|---|---|---|
| 17 | Click pencil on org name, edit to "ACG International", save | Success banner shows briefly; sidebar header and page both show new name |
| 18 | After deactivating Karim (test 8) and adding a new user (test 7) | Org settings metric cards reflect correct deltas |
| 19 | On Fatima Zahra's profile, toggle "Notify on lead assign" off, navigate away and back | Toggle still off (signal persists for session) |
| 20 | Click sidebar user widget (Rachid Ouazzani) | Navigates to /settings/users/usr_rachid — Rachid's profile page loads |

---

*Plan version 1.0 — generated for frontend-only Angular CRM with signals architecture*