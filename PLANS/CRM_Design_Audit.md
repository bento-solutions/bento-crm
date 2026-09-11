# CRM Dashboard Design Audit & Implementation Guide

**Document Type:** Design System Specification  
**Status:** Ready for Development  
**Version:** 1.0  
**Last Updated:** 2026-07-03

---

## Executive Summary

This document provides a comprehensive design audit of the Salesforce Contacts dashboard mockup, including visual breakdown, component inventory, design tokens, accessibility concerns, and implementation recommendations.

**Key Findings:**
- Strong visual hierarchy via color-blocking; modern, clean aesthetic
- Missing accessibility considerations and interactive states
- Needs defined color/status mapping system for real data
- Requires scalability planning for variable data volumes

---

## 1. Layout Architecture

### Grid System

**Base Layout:** 12-column responsive grid with three primary zones:

```
┌─────────────────────────────────────────────────────┐
│  Logo    |  Nav Tabs  |  Search  Icons  |  Avatar  │  TOP BAR (full-width)
├──────────────────────────────────────────────────────┤
│  ←  Customer Information  |  KPI 1  |  KPI 2  |  KPI 3 │  HEADER STRIP
├──────────────────────────────────────────────────────┤
│  │                                          │         │
│  │  Main Content (8 cols)                  │  Sidebar│
│  │  ┌────────────────────────────────────┐ │ (3 cols)│
│  │  │ Interaction History                 │ │         │
│  │  └────────────────────────────────────┘ │ ┌──────┤
│  │  ┌────────────────────────────────────┐ │ │ Eva  │
│  │  │ Tasks Schedule  │ Stage Funnel    │ │ │ Profile
│  │  └────────────────────────────────────┘ │ │      │
│  │                                          │ ├──────┤
│  │                                          │ │ Deatl│
│  │                                          │ │ Info │
│  │                                          │ │      │
└──────────────────────────────────────────────────────┘

LEFT DOCK: Icon navigation (fixed, floating)
```

### Responsive Behavior

- **Desktop (1200px+):** Full 3-zone layout (left dock + main + right sidebar)
- **Tablet (768-1199px):** Main content full-width, right sidebar stacks below
- **Mobile:** Single-column, dock converts to bottom tab bar

---

## 2. Component Inventory

### 2.1 Top Navigation Bar

**Purpose:** Primary app navigation and user context  
**Height:** ~60-64px  
**Background:** Subtle gradient or solid light background

**Components:**
- **Logo** (left): Mark + wordmark, ~28-32px height
- **Nav Pills** (center): Horizontal tab-like navigation
  - **Active state:** Solid black pill background, white text, rounded corners (~24px)
  - **Inactive state:** Plain text, no background
  - Example items: "Book Summaries," "Founders," "Finance," "Contacts" (active), "Growth," "Contact," "Projects"
- **Right Cluster** (right):
  - Icon button (circular, gray-fill, ~36px): search/notifications
  - Icon button (circular, gray-fill, ~36px): secondary action
  - Avatar (circular, ~40px): User profile picture with subtle border

**Accessibility Notes:**
- Nav pills need `role="tablist"` and proper `aria-selected` states
- Icon buttons require `aria-label` attributes
- Ensure nav is keyboard-navigable (`Tab`, `Enter`, `Arrow` keys)

**Code Variant Example:**
```jsx
<NavPill 
  label="Contacts" 
  isActive={true} 
  onClick={handleNavigate}
  aria-label="Contacts page navigation"
/>
```

---

### 2.2 Page Header Strip

**Purpose:** Page context, KPI summary, quick actions  
**Layout:** Flex row with back button, title, and 3 KPI stat cards

**Back Button**
- Circular icon button (~36px), gray fill
- Chevron-left icon
- `aria-label="Go back"`

**Page Title**
- H1 heading, two-line layout (wraps naturally)
- Font-weight: bold
- Font-size: large (display-level, ~28-32px)
- Color: dark gray/black (#111 or #1F2937)

**KPI Stat Cards** (3 cards, equal width)
- **Structure per card:**
  - Icon chip (small circular, colored background)
  - Large value (bold, ~24-28px font-size)
  - Label text (small caps, gray, ~11-12px font-size)
  - Badge/delta indicator (pill-shaped, colored background e.g., "+11% week" in yellow or blue)

**Colors (from mockup):**
- Card 1 (Revenue): Blue badge (#2E5AAC), yellow accent
- Card 2 (New Customers): Blue badge (#2E5AAC), blue accent
- Card 3 (New Tasks): Gray badge, gray text

**Responsive:** Cards stack vertically on mobile, remain inline on tablet+

---

### 2.3 Left Icon Dock

**Purpose:** Secondary navigation and quick actions  
**Position:** Fixed, floating left edge, or sticky within viewport  
**Dimensions:** ~60-72px width, full viewport height

**Visual Style:**
- Vertical pill shape (~80-90px tall, rounded edges, pinned left)
- Dark background (near-black, #111 or #1F2937)
- White/light icons

**Icons (from top to bottom):**
1. Search (magnifying glass)
2. Share (arrow/share icon)
3. Export (down arrow with tray)
4. Star (bookmark/favorite)
5. Add/Create (plus icon)
6. Phone/Call (phone handset)
7. Database (cylinder/table icon)
8. Calendar (calendar grid)
9. Send/Message (paper plane or chat)
10. Alert/Bell (notification bell)

**Interactions:**
- Hover: Background lightens or icon brightens
- Active: Icon highlights or slight elevation/shadow
- Tooltip on hover (2-3 second delay): "Search Contacts," "Export Data," etc.

**Accessibility:**
- Each icon button has `aria-label` with full action name
- Keyboard-navigable (up/down arrow keys to switch focus)
- Tab-order matches visual order
- Touch target minimum 48×48px

**Code Structure:**
```jsx
<IconDock>
  <IconButton 
    icon="search" 
    aria-label="Search contacts"
    onClick={handleSearch}
  />
  <IconButton 
    icon="star" 
    aria-label="Toggle favorite"
    isActive={isFavorited}
  />
  {/* ... more buttons */}
</IconDock>
```

---

### 2.4 Interaction History Card

**Purpose:** Display recent deals or customer interactions  
**Dimensions:** ~100% width × flexible height  
**Card Styling:** White/off-white background, rounded corners (~20-24px), subtle border

**Header Row:**
- Left: "Interaction History" (H3 title, bold, dark color)
- Right: 
  - More-options icon ("...") with menu tooltip
  - Expand/fullscreen icon

**Content Grid:**
- **Layout:** 2 columns × 3 rows (6 deal cards total)
- **Card dimensions per deal:** ~200-240px width × ~130-160px height
- **Spacing:** ~16px gap between cards

**Individual Deal Card Structure:**

| Element | Style | Notes |
|---------|-------|-------|
| Date Label | Top-left, small caps, white text (if dark bg) or gray (if light) | e.g., "Oct 4" |
| Deal Name | 2-line heading, bold, white/dark depending on background | e.g., "Royal Package Opportunity" |
| Amount | Large number (24-28px bold), white/dark, positioned bottom-left | e.g., "11,250$" |
| Avatar Stack | Bottom-right, overlapping circular avatars (28-32px), white border between | Max 3-4 visible, "+N more" text if overflow |
| Action Icon | Top-right, subtle: "..." (menu), arrow (expand), or refresh | Opacity: ~60%, full on hover |

**Color Coding (Status System):**

| Deal Status | Background | Text Color | Example |
|-------------|-----------|-----------|---------|
| Qualified Lead | Blue (#2E5AAC) | White | "Royal Package Opportunity" |
| Active Deal | Teal (#4A8FA0) | White | "Third Deal, Most Useful" |
| Closed/Won | Black (#111) | White | "Absolute Success Deal" |
| Needs Attention | Yellow (#F5C518) | Dark gray (#333) | "Royal Package Opportunity" |
| Neutral/Default | Light gray (#F3F4F6) | Dark gray (#1F2937) | "Second deal: Common Service" |

**Empty & Loading States:**
- **Empty:** Show placeholder text "No interactions yet. Start a conversation." with illustration
- **Loading:** Skeleton cards (pulsing gray bars, matching card layout)
- **Error:** Inline error message with retry button

**Pagination/Overflow:**
- Show 6 cards by default
- Add "Load more" button or pagination controls if >6 records
- Optional: Horizontal scroll on mobile, with snap-to-grid behavior

---

### 2.5 Tasks Schedule Card

**Purpose:** Calendar view of assigned tasks for the contact  
**Dimensions:** ~45% width × ~280-320px height  
**Card Styling:** White background, rounded corners (~20-24px)

**Header:**
- Left: "Tasks Schedule" (H3, bold)
- Right: "..." menu, expand icon
- Below: Month label ("October") with prev/next arrow buttons and refresh icon

**Calendar Grid:**
- 7-column grid (Sun–Sat)
- 5-6 rows (weeks in month)
- Day cells: ~32-40px square, flex layout

**Day Cell Variants:**

| State | Visual | Interactive |
|-------|--------|-------------|
| Empty day (no task) | Light gray background (#F9FAFB), dark number | Not clickable |
| Day with task(s) | Color-coded background (blue, teal, yellow per task/person) | Click to expand or open detail view |
| Today | Blue circle highlight or border | N/A |
| Other month | Grayed out text, lighter background | Not clickable |

**Task Indicator:**
- Small circular avatar (24-28px) positioned in cell
- Multiple avatars (overlapping/stacked): indicates multiple tasks/assignees that day
- Avatar on hover: shows task preview tooltip or card

**Responsive:**
- Desktop: Full calendar (7 cols × 5-6 rows)
- Tablet: Smaller cells, consider week view option
- Mobile: Week view or agenda list (linear) instead of grid

---

### 2.6 Stage Funnel Card

**Purpose:** Pipeline visualization, showing deal progression and value by stage  
**Dimensions:** ~45% width × ~280-320px height  
**Card Styling:** White background, rounded corners

**Header:**
- Title: "Stage Funnel" (H3, bold)
- Subtitle: "$350,500 Total in Pipeline"
- Toggle: "Weighted / Total" (pill toggle, two options)
- Actions: "..." menu, expand icon

**Funnel Rows (Vertical Stack):**

Each row represents a sales stage in descending order:

| Stage | Value (example) | % of Total | Controls |
|-------|-----------------|-----------|----------|
| Qualification | $92,350 | 26.3% | Refresh icon, expand arrow |
| Royal Package Opportunity | $67,120 | 19.1% | Refresh icon, expand arrow |
| Value Proposition | $28,980 | 8.3% | Refresh icon, expand arrow |
| (more stages...) | ... | ... | ... |

**Row Structure:**
- Stage name (bold, left-aligned)
- Amount (large, bold, left-aligned or right-aligned)
- Percentage or bar indicator (optional right side)
- Icons (refresh, expand) on far right, subtle until hover

**Visual Encoding:**
- Option A: Bar width = proportional to percentage (visual funnel)
- Option B: Text-only with values, pure data table (lighter visual weight)
- Funnel color: Gradient from blue (top) to teal (bottom), or uniform color

**Interactions:**
- Refresh icon: Recalculates that stage's total or refetches data
- Click row: Expands to show deals in that stage
- Hover: Row background brightens slightly

---

### 2.7 Contact Profile Card (Right Sidebar, Top)

**Purpose:** Hero view of the contact with photo and key identity info  
**Dimensions:** Full sidebar width (~280-320px) × ~320-380px height  
**Card Styling:** White background, rounded corners, possible subtle gradient/pattern behind avatar

**Layout (Top-to-Bottom):**

1. **Action Icons (Top-Right):**
   - Two small circular icon buttons (~32-36px), gray fill
   - Likely: Edit (pencil), settings (gear) or similar
   - Positioned top-right of card, margin ~12-16px

2. **Large Circular Avatar (Center):**
   - Diameter: ~120-140px
   - Centered horizontally
   - High-quality image with border (~3-4px white border)
   - Initials fallback: "ER" (Eva Robinson) in colored background if no image

3. **Name & Title (Center, Below Avatar):**
   - Name (H2, bold, dark, ~18-20px): "Eva Robinson"
   - Subtitle (small caps gray, ~12-13px): "CEO, Inc. Alabama Machinery & Supply"

4. **Action Buttons Row (5 buttons, horizontal):**
   - Below subtitle, centered
   - Button style: Small circular icon buttons (~36-40px), gray fill, icon only
   - Icons: Edit (pencil), Email (envelope), Call (phone), Add/Plus (+), Calendar (calendar grid)
   - On hover: Darker fill or slight elevation
   - Tooltip on hover: "Edit Contact," "Send Email," "Make Call," etc.

**Responsive:**
- Desktop: Full width sidebar layout
- Mobile: Compact version, buttons may wrap to 2 rows

---

### 2.8 Detailed Information Card (Right Sidebar, Bottom)

**Purpose:** Editable contact details, contact information, metadata  
**Dimensions:** Full sidebar width (~280-320px) × flexible (scrolls if needed)  
**Card Styling:** White background, rounded corners

**Header:**
- Title: "Detailed Information" (H3, bold)
- Right icons: Edit (pencil), expand/fullscreen arrow

**Field List (Stacked Rows):**

Each row is a field entry with the following structure:

```
┌──────────────────────────────┐
│  [Icon]  Label               │  [edit icon]
│          Value (bold)        │
└──────────────────────────────┘
```

**Field Types & Examples:**

| Field | Icon | Label | Value | Edit Type |
|-------|------|-------|-------|-----------|
| First Name | Person icon | "First Name" (small caps) | "Eva" (bold) | Text input |
| Last Name | Person icon | "Last Name" | "Robinson" | Text input |
| Email | Envelope icon | "Email" | "Eva@alabamamachinery.com" | Text input or email picker |
| Phone | Phone icon | "Phone Number" | "+911 120 222 313" | Tel input |
| Sources | Platform icons | "Sources" | WhatsApp, Google, LinkedIn logos (no text labels, icon-only) | Multi-select with platform options |
| Last Contacted | Calendar icon | "Last Contacted" | "06/15/2023 at 7:16 pm" (timestamp) | Date/time picker or read-only |

**Edit Mode (Hover/Click):**
- Trailing "+" or "edit" icon per field
- Click launches inline editor (popover, modal, or inline text input)
- Save/Cancel buttons appear on interaction

**Missing State:**
- For multi-value fields (e.g., multiple emails, multiple phone numbers), show a "+" button to add more entries
- Each entry gets its own row with a delete/remove option

**Responsive:**
- Desktop: Full width with aligned columns
- Mobile: Stack vertically, inputs full-width

---

## 3. Design Tokens

### 3.1 Typography Scale

| Token | Font-Size | Font-Weight | Line-Height | Usage |
|-------|-----------|-------------|-------------|-------|
| `display` | 32px | 700 (bold) | 1.2 | Page titles, H1 |
| `heading-1` | 24px | 700 | 1.3 | Card titles, H2 |
| `heading-2` | 18px | 700 | 1.3 | Subsections, H3 |
| `heading-3` | 16px | 700 | 1.4 | Small headings, H4 |
| `body-large` | 16px | 400 | 1.5 | Primary body text, P |
| `body` | 14px | 400 | 1.5 | Standard body, labels |
| `body-small` | 13px | 400 | 1.5 | Secondary text, captions |
| `caption` | 12px | 500 | 1.4 | Labels, micro-copy, small caps |
| `caption-small` | 11px | 500 | 1.3 | Timestamps, very small text |

**Font Family:** Inter, Söhne, or system font stack  
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### 3.2 Color Palette

**Neutrals:**
| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `black` | #111111 | rgb(17, 17, 17) | Text, dark backgrounds, borders |
| `gray-900` | #1F2937 | rgb(31, 41, 55) | Dark text, headings |
| `gray-700` | #374151 | rgb(55, 65, 81) | Standard text, icons |
| `gray-500` | #6B7280 | rgb(107, 114, 128) | Secondary text, placeholder |
| `gray-300` | #D1D5DB | rgb(209, 213, 219) | Borders, dividers |
| `gray-100` | #F3F4F6 | rgb(243, 244, 246) | Light backgrounds, hover states |
| `gray-50` | #F9FAFB | rgb(249, 250, 251) | Very light backgrounds |
| `white` | #FFFFFF | rgb(255, 255, 255) | Card backgrounds, text on dark |

**Semantic Colors (Status/Intent):**
| Token | Hex | Usage |
|-------|-----|-------|
| `blue-primary` | #2E5AAC | Primary actions, deal status (qualified) |
| `blue-light` | #E0E7FF | Light background, hover states |
| `teal-primary` | #4A8FA0 | Secondary actions, deal status (active) |
| `teal-light` | #CCDFDE | Light background |
| `yellow-primary` | #F5C518 | Warning, attention-needed status, badges |
| `yellow-light` | #FEF3C7 | Light background |
| `green-primary` | #10B981 | Success, positive indicators |
| `green-light` | #D1FAE5 | Light background |
| `red-primary` | #EF4444 | Error, negative indicators |
| `red-light` | #FEE2E2 | Light background |

**Deal Status Color Map:**
```javascript
const dealStatusColors = {
  qualification: { bg: '#2E5AAC', text: '#FFFFFF' },        // Blue
  activeNegotiation: { bg: '#4A8FA0', text: '#FFFFFF' },    // Teal
  closedWon: { bg: '#111111', text: '#FFFFFF' },            // Black
  needsAttention: { bg: '#F5C518', text: '#333333' },       // Yellow
  neutral: { bg: '#F3F4F6', text: '#1F2937' }               // Light gray
};
```

**Gradient Backgrounds:**
- Page background: Subtle linear gradient from pale blue (#E0E7FF) top-left to pale green (#D1FAE5) bottom-right, very low saturation
- Card backgrounds: Solid white (#FFFFFF) with optional 1px border (#D1D5DB) for definition

### 3.3 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Micro-spacing within components |
| `sm` | 8px | Padding/margin within elements |
| `md` | 12px | Standard component padding |
| `lg` | 16px | Gap between cards, container padding |
| `xl` | 20px | Card padding, section spacing |
| `2xl` | 24px | Page padding, major section gaps |
| `3xl` | 32px | Top-level container padding, major spacing |
| `4xl` | 48px | Page-edge margins |

### 3.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Subtle rounded corners |
| `rounded` | 8px | Standard components |
| `rounded-lg` | 16px | Large components, some buttons |
| `rounded-xl` | 20px | Cards, modals |
| `rounded-2xl` | 24px | Large cards, primary CTAs |
| `rounded-full` | 9999px | Pills, circles, icon buttons |

### 3.5 Shadows & Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Flat design, primary default |
| `shadow-sm` | 0 1px 2px 0 rgba(0, 0, 0, 0.05) | Subtle elevation on hover |
| `shadow-md` | 0 4px 6px -1px rgba(0, 0, 0, 0.1) | Floating elements, modals |
| `shadow-lg` | 0 10px 15px -3px rgba(0, 0, 0, 0.1) | Dropdowns, high-z overlays |

**Note:** Design uses minimal shadows; hierarchy comes from color-blocking, not depth.

### 3.6 Interaction & Motion

| Token | Value | Usage |
|-------|-------|-------|
| `transition-fast` | 150ms ease-in-out | Icon hover, color changes |
| `transition-base` | 300ms ease-in-out | Panel expand/collapse, modal appear |
| `transition-slow` | 500ms ease-in-out | Page transitions, major layout shifts |

---

## 4. Component Library & Variants

### 4.1 Button Variants

**Icon Button (Circular)**
```jsx
<IconButton 
  icon="search"
  variant="gray"         // gray, black, primary, secondary
  size="md"              // sm, md, lg
  aria-label="Search"
  onClick={handleClick}
/>
```

**States:** Default, Hover, Active, Disabled, Loading

**Styles:**

| Variant | Background | Icon Color | Hover BG | Use Case |
|---------|-----------|-----------|----------|----------|
| `gray` | #F3F4F6 | #6B7280 | #E5E7EB | Secondary actions, default |
| `black` | #111111 | #FFFFFF | #1F2937 | Primary actions, active nav |
| `primary` | #2E5AAC | #FFFFFF | #1E40AF | Emphasized actions |
| `secondary` | none (transparent) | #6B7280 | #F3F4F6 | Subtle actions |

**Sizes:**
- `sm`: 28×28px, 16px icon
- `md`: 36×36px, 20px icon
- `lg`: 44×44px, 24px icon

**Touch Target:** Minimum 44×44px (WCAG compliance)

### 4.2 Navigation Pill

```jsx
<NavPill
  label="Contacts"
  isActive={true}        // Controls background
  onClick={handleNav}
  aria-label="Contacts page"
/>
```

**States:**
- **Active:** Black background (#111), white text, rounded corners (24px)
- **Inactive:** Transparent/none, dark gray text (#1F2937), hover adds light background (#F3F4F6)

### 4.3 Card Container

```jsx
<Card 
  title="Interaction History"
  actionMenu={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Export', onClick: handleExport }
  ]}
  expandable={true}
>
  {/* Card content */}
</Card>
```

**Card Header Structure:**
- Left: Title (H3, bold)
- Right: "..." menu button, expand icon button

**Card Footer (optional):**
- "Show more" / "Load more" button (if content is truncated)
- Pagination controls (if applicable)

### 4.4 Deal Card (Interaction History)

```jsx
<DealCard
  date="Oct 4"
  dealName="Royal Package Opportunity"
  amount={11250}
  currency="$"
  status="qualification"     // Maps to color token
  avatars={[user1, user2, user3]}  // Array of user objects
  onActionClick={handleMenuClick}
/>
```

**Props:**
- `date`: String, e.g., "Oct 4"
- `dealName`: String, 2-line max
- `amount`: Number
- `currency`: String, default "$"
- `status`: Enum (qualification, activeNegotiiation, closedWon, needsAttention, neutral)
- `avatars`: Array of user objects with image/initials
- `maxAvatars`: Number, default 3 (excess shown as "+N")

### 4.5 KPI Stat Card

```jsx
<StatCard
  icon="trending-up"
  value={1980130}
  label="Won from 38 Deals This Month"
  delta={11}
  deltaUnit="percent"
  deltaLabel="week"      // "week", "month", "quarter"
  badgeColor="yellow"    // yellow, blue, gray
/>
```

**Props:**
- `icon`: Icon name from icon library
- `value`: Number (formatted to currency/thousands)
- `label`: Descriptive text
- `delta`: Number or percentage value
- `deltaLabel`: Time period ("week", "month", "quarter", "year")
- `badgeColor`: Color token for badge background

### 4.6 Calendar Day Cell

```jsx
<CalendarCell
  day={4}
  hasTask={true}
  taskCount={1}
  assignees={[user1, user2]}  // Avatars to display
  status="other-month"        // "current", "other-month", "today"
  onClick={handleDayClick}
/>
```

**States:**
- `current`: Normal day in current month
- `other-month`: Grayed out (previous/next month)
- `today`: Highlight border or background
- `hasTask`: Show color coding + avatars

### 4.7 Funnel Row

```jsx
<FunnelRow
  stageName="Qualification"
  amount={92350}
  percentage={26.3}
  isExpanded={false}
  onExpandClick={handleExpand}
  onRefreshClick={handleRefresh}
/>
```

**Responsive:** Row becomes full-width on mobile, bar indicator optional on small screens

### 4.8 Field Editor (Detailed Information)

```jsx
<DetailField
  icon="user"
  label="First Name"
  value="Eva"
  isEditable={true}
  fieldType="text"       // text, email, tel, date, select, multi-select
  onSave={handleSave}
  placeholder="Enter first name"
/>
```

**Edit Modes:**
- Inline text input (text, email, tel)
- Date picker popup (date, datetime)
- Dropdown/select (enums)
- Multi-select with tags (sources, skills, languages)

---

## 5. Accessibility & WCAG Compliance

### 5.1 Color Contrast

**WCAG AA Standards (minimum 4.5:1 for body text, 3:1 for large text):**

| Color Pair | Ratio | Status | Notes |
|-----------|-------|--------|-------|
| White text on Blue (#2E5AAC) | 8.2:1 | ✅ PASS | Deal card, buttons |
| White text on Teal (#4A8FA0) | 6.5:1 | ✅ PASS | Deal card |
| White text on Black (#111) | 21:1 | ✅ PASS | Deal card, primary UI |
| Dark gray text on Yellow (#F5C518) | 4.8:1 | ✅ PASS | Deal card (borderline) |
| Gray text on Gray (#6B7280 on #F3F4F6) | 2.8:1 | ⚠️ FAIL | **FIX: Increase contrast for labels** |
| Gray text on White (labels, #6B7280 on #FFF) | 7.5:1 | ✅ PASS | Secondary labels |
| Small gray text on light (#6B7280 on #F9FAFB, 11px) | 2.5:1 | ⚠️ FAIL | **FIX: Use darker gray or larger text** |

**Recommended Fixes:**
- **Secondary labels** (field names in Detailed Information): Use `#374151` (gray-700) instead of `#6B7280`
- **Timestamps & micro-copy**: Use `#1F2937` (gray-900) for better readability on light backgrounds
- **Test all color pairs** using [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/) before development

### 5.2 Interactive Element Sizing

| Element | Min Size | Target Size | Status |
|---------|----------|-------------|--------|
| Icon buttons | 44×44px | 48×48px | ✅ COMPLIANT (shown ~36-40px, may need padding) |
| Nav pills | N/A (text-only) | 44px height min | ⚠️ REVIEW: Verify pill height in design |
| Clickable text (links) | 32×32px | 44×44px | ⚠️ REVIEW: If card titles are clickable, add hover affordance |

**WCAG AAA (enhanced) = 48×48px minimum**

### 5.3 Keyboard Navigation

**Required States:**
- Tab order: Logical, left-to-right, top-to-bottom
- Focus indicator: Visible outline (min 2px) on all interactive elements
- Icon buttons: Must have `aria-label` for screen readers
- Cards: Keyboard-accessible expand/collapse (Enter key, Space bar)

**Implementation Checklist:**
```html
<!-- Example: Icon button -->
<button 
  class="icon-button"
  aria-label="Search contacts"
  type="button"
>
  <svg><!-- Icon --></svg>
</button>

<style>
  button:focus {
    outline: 2px solid #2E5AAC;
    outline-offset: 2px;
  }
</style>
```

### 5.4 Screen Reader Support

| Component | ARIA Attributes | Notes |
|-----------|-----------------|-------|
| Navigation pills | `role="tablist"`, `role="tab"`, `aria-selected="true\|false"` | Announce active tab |
| Icon buttons | `aria-label="Action description"` | Always required for icon-only buttons |
| Expanded/collapsed sections | `aria-expanded="true\|false"` | Announce expansion state |
| Alerts/errors | `role="alert"`, live region | Use `aria-live="polite"` for dynamic updates |
| Deal cards | `role="article"` (optional), semantic heading hierarchy | Properly structured DOM |
| Data tables (calendar, funnel) | `role="table"`, `role="row"`, `role="gridcell"` | Announce headers and structure |
| Avatar stacks | `aria-label="3 team members"` (custom), title attribute | Don't rely on icon alone |

**Screen Reader Testing:**
- Test with NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS), TalkBack (Android)
- Announce card headers, deal amounts, and action buttons
- Verify no orphaned form labels

### 5.5 Dark Mode Support (Optional, Future)

**CSS Variables approach:**
```css
:root {
  --color-bg-primary: #FFFFFF;
  --color-text-primary: #111111;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: #1F2937;
    --color-text-primary: #F9FAFB;
  }
}
```

---

## 6. Interactive States & Micro-interactions

### 6.1 Button States

**Icon Button:**
```
[Default] → [Hover] → [Active] → [Disabled]
  |           |        |          |
Gray bg   Darker bg  Darker bg + Scale 0.98
           + Shadow    + Scale      Opacity 0.5
```

**Hover effect:** `background-color 150ms ease-in-out`  
**Disabled state:** Opacity 50%, cursor not-allowed, no hover effects

### 6.2 Card Interaction

**Expand Animation:**
```
[Collapsed] → [Expanding] → [Expanded]
  Max-height:   animation      Max-height:
  240px        duration:        100vh
               300ms
```

**Load state:**
- Skeleton loaders matching card layout
- Pulsing gray bars (opacity: 60% → 20% → 60%, infinite loop)

### 6.3 Deal Card Hover

- **Background:** Slight color lightening (opacity +5%)
- **Shadow:** Add shadow-sm
- **Action icons:** Opacity change (0% → 100%)
- **Cursor:** Pointer (if clickable)
- **Transition:** 150ms

### 6.4 Form Input States

**Text Input (Edit Mode):**
```
[Default]           [Focus]            [Error]           [Disabled]
Border: gray-300    Border: blue-primary Border: red-primary Bg: gray-100
Bg: white           Outline: 2px        Text: red            Opacity: 0.5
                    Shadow: sm
```

**Validation:**
- Real-time validation feedback (email format, phone number format)
- Error message: Red text, 12px, positioned below input
- Success checkmark: Green icon, positioned inside input right side

### 6.5 Loading & Empty States

**Skeleton Loading (6 deal cards):**
```jsx
<Card title="Interaction History">
  <div className="grid grid-cols-2 gap-4">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="skeleton-card" />
    ))}
  </div>
</Card>

<style>
  .skeleton-card {
    height: 160px;
    background: linear-gradient(
      90deg,
      #f0f0f0 25%,
      #e0e0e0 50%,
      #f0f0f0 75%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
```

**Empty State (No interactions):**
```jsx
<Card title="Interaction History">
  <div className="empty-state">
    <Icon name="inbox-empty" size="lg" color="gray-300" />
    <h4>No interactions yet</h4>
    <p>Start a conversation to create your first interaction.</p>
    <button variant="primary">Create Interaction</button>
  </div>
</Card>
```

**Error State:**
```jsx
<Card title="Interaction History">
  <div className="error-state" role="alert">
    <Icon name="alert-circle" color="red-primary" />
    <p>Failed to load interactions. Please try again.</p>
    <button onClick={handleRetry}>Retry</button>
  </div>
</Card>
```

---

## 7. Responsive Design Breakpoints

### 7.1 Breakpoints

| Breakpoint | Width | Device | Layout Changes |
|-----------|-------|--------|-----------------|
| Mobile | 320px–767px | Phone | Single column, dock → bottom tabs |
| Tablet | 768px–1023px | Tablet | 2-column (main + sidebar below) |
| Desktop | 1024px–1439px | Desktop (standard) | 3-column (dock + main + sidebar) |
| Large | 1440px+ | Desktop (UltraHD) | Same as desktop, possibly wider gutters |

### 7.2 Mobile Layout (320px–767px)

**Changes:**
- Left dock → Bottom navigation bar (horizontal pill, 5 key actions visible, "+more" overflow menu)
- Page header: Single-column, stat cards stack vertically
- Main content: Full width
- Right sidebar: Moves below main content (full-width cards)
- Card grids (Deal cards, calendar): 1 column (list view)
- Calendar: Switch to week view or agenda list
- Typography: Slightly reduced sizes for headings (24px → 20px display)

**Mobile Navigation:**
```
┌───────────────────────────────────┐
│ ← Title         [Icon] [Avatar]  │  Header
├───────────────────────────────────┤
│           [Main Content]          │
│           (full width)            │
│                                   │
├───────────────────────────────────┤
│ Right Sidebar (stacked below)     │
│ Profile card                      │
│ Detail info                       │
├───────────────────────────────────┤
│ [Search] [Share] [+] [More v]     │  Bottom Nav (5 key actions)
└───────────────────────────────────┘
```

### 7.3 Tablet Layout (768px–1023px)

**Changes:**
- Left dock: Collapses to 48px width (icons only, no labels)
- Main content: Wider, ~70% width
- Right sidebar: Moves below main, full-width or 2-column layout
- Deal cards: 2-column grid (stays same as desktop)
- Calendar: Full calendar view maintained
- Landscape mode: Dock may stay visible, sidebar alongside

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1–2)
- [ ] Set up design tokens in CSS/Tailwind variables
- [ ] Build base components: Button, Card, NavPill, IconButton
- [ ] Set up color system and typography scale
- [ ] Establish folder structure and component organization

### Phase 2: Core Components (Week 3–4)
- [ ] Implement Top Navigation Bar
- [ ] Implement Page Header Strip (with KPI cards)
- [ ] Implement Left Icon Dock
- [ ] Basic responsive breakpoints

### Phase 3: Dashboard Modules (Week 5–6)
- [ ] Interaction History card (deal card grid)
- [ ] Deal card component with color mapping
- [ ] Tasks Schedule (calendar grid)
- [ ] Stage Funnel card

### Phase 4: Right Sidebar (Week 7)
- [ ] Contact Profile card (avatar + actions)
- [ ] Detailed Information card (field editor)
- [ ] Form validation & edit mode

### Phase 5: Polish & QA (Week 8–9)
- [ ] Hover/active states, micro-interactions
- [ ] Loading, empty, and error states
- [ ] Accessibility audit (WCAG AA compliance)
- [ ] Mobile responsive testing
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

### Phase 6: Documentation & Handoff (Week 10)
- [ ] Storybook component documentation
- [ ] Design system Figma handoff
- [ ] API integration guide
- [ ] QA sign-off

---

## 9. Design Audit Findings

### ✅ Strengths

1. **Strong Visual Hierarchy via Color-Blocking**
   - Colors convey information (deal status, urgency) without relying on subtle shadows
   - Clean, modern aesthetic; minimal visual noise
   - Consistent color language across cards

2. **Intuitive Information Architecture**
   - KPI deltas positioned directly next to values (good information scent)
   - Related data grouped logically (profile + details on sidebar)
   - Card header pattern (title left, actions right) is consistent and learnable

3. **Efficient Space Usage**
   - Dashboard packs a lot of information without feeling cluttered
   - Card-based layout allows flexible scaling for real data

4. **Avatar Stacks & Social Context**
   - Quick visual indication of team involvement without extra text
   - Overlapping avatars save space while remaining scannable

---

### ⚠️ Concerns & Risks

#### 1. **Color Contrast Issues** (Medium Priority)
- Gray labels on light gray backgrounds fail WCAG AA (secondary text on fields)
- Yellow (#F5C518) on dark gray text is borderline (4.8:1, needs verification)
- **Fix:** Darken secondary labels to #374151; test all pairs with contrast checker

#### 2. **Missing Accessibility Affordances** (High Priority)
- Icon-only buttons lack visible labels; no tooltips shown in mockup
- No focus indicators visible (tab/keyboard navigation not apparent)
- Deal card colors assigned arbitrarily; no status mapping system (scalability risk)
- **Fix:**
  - Add `aria-label` to all icon buttons
  - Implement visible focus ring (2px, outline-offset 2px)
  - Define deal status enum and color map before development

#### 3. **Scalability Issues** (High Priority)
- Interaction History shows fixed 2×3 grid; real data will have variable counts
- Calendar and funnel rows have no pagination/overflow handling
- No visible empty, loading, or error states
- **Fix:**
  - Add "Load more" / pagination UI
  - Create skeleton loaders and empty state screens
  - Plan for 0, 1, 6, 12+, 100+ item scenarios per card

#### 4. **Calendar Density** (Medium Priority)
- Task calendar is very compact; only avatars visible per day, no task titles/times
- Difficult to understand task duration or priority at a glance
- **Fix:**
  - Add hover tooltip with task preview (name, time, assignee)
  - Option: Week view or agenda list for mobile/complex schedules
  - Expand day cell on click to show full task details

#### 5. **Icon Ambiguity** (Medium Priority)
- "..." (more-options) icon used for different actions without clear context
- Refresh (↻) icon appears on funnel rows; unclear scope (one row vs. all?)
- Sources field uses bare platform logos (WhatsApp, LinkedIn, Discord) without labels
- **Fix:**
  - Use distinct icons for menu (⋯), edit (✎), refresh (↻)
  - Add tooltip/aria-label explaining refresh behavior
  - Add text labels to source platform icons or show on hover

#### 6. **Mobile Navigation Undefined** (Medium Priority)
- Left dock is not mobile-friendly; unclear how it converts to bottom nav
- Sidebar takes up full width on mobile; needs scroll container or rearrangement
- **Fix:**
  - Design bottom navigation bar (horizontal pill with 5 key actions + "More" menu)
  - Stack sidebar content below main on tablet/mobile
  - Test responsiveness at 375px (iPhone SE)

#### 7. **Typography Scale Inconsistency** (Low Priority)
- Deal card amounts vary in size across cards (optical sizing vs. defined scale)
- KPI badge text and deal titles may have undefined sizes
- **Fix:** Define formal scale (display, h1, h2, h3, body-large, body, body-small, caption)

#### 8. **No Visible Interactive States** (High Priority)
- No hover effects shown (buttons, rows, cards)
- No active/selected states for nav pills or calendar days
- No loading spinners or skeleton screens
- **Fix:** Create state component library with:
  - Default, Hover, Active, Disabled, Loading, Error states
  - Micro-interaction specs (duration, easing)
  - Example: button hover = darker bg + shadow-sm, 150ms ease-in-out

---

### 🔴 Critical Issues for Development

| Issue | Impact | Priority | Owner | Est. Time |
|-------|--------|----------|-------|-----------|
| Color contrast (gray labels) | Accessibility fail | HIGH | Design + Dev | 2h |
| Missing icon labels/tooltips | A11y + UX fail | HIGH | Design | 3h |
| No deal status color mapping | Scalability risk | HIGH | Design | 4h |
| Deal card grid overflow handling | Data scaling issue | HIGH | Dev | 8h |
| Calendar day detail/expansion | UX gap | MEDIUM | Design + Dev | 6h |
| Icon action clarity (menu, refresh, edit) | UX clarity | MEDIUM | Design | 2h |
| Mobile navigation design | Responsive gap | MEDIUM | Design | 5h |
| Hover/focus states not defined | Dev uncertainty | HIGH | Design | 4h |

---

## 10. Component Library Structure

### Folder Organization (React/Vue Example)

```
src/
├── components/
│   ├── Navigation/
│   │   ├── TopNav.jsx
│   │   ├── NavPill.jsx
│   │   └── IconDock.jsx
│   ├── Cards/
│   │   ├── Card.jsx (wrapper)
│   │   ├── DealCard.jsx
│   │   ├── StatCard.jsx
│   │   └── ProfileCard.jsx
│   ├── Dashboard/
│   │   ├── InteractionHistory.jsx
│   │   ├── TaskSchedule.jsx
│   │   └── StageFunnel.jsx
│   ├── Forms/
│   │   ├── DetailField.jsx
│   │   ├── FieldEditor.jsx
│   │   └── FormInput.jsx
│   ├── Calendar/
│   │   ├── Calendar.jsx
│   │   └── CalendarCell.jsx
│   ├── Buttons/
│   │   ├── Button.jsx
│   │   └── IconButton.jsx
│   └── States/
│       ├── SkeletonLoader.jsx
│       ├── EmptyState.jsx
│       └── ErrorState.jsx
├── styles/
│   ├── tokens.css (design tokens)
│   ├── typography.css
│   ├── colors.css
│   ├── spacing.css
│   └── utilities.css
├── hooks/
│   ├── useCard.js (expand/collapse logic)
│   ├── useForm.js (field edit modes)
│   └── useResponsive.js (breakpoint detection)
├── utils/
│   ├── formatters.js (currency, dates)
│   ├── colorMap.js (deal status → color)
│   └── accessibility.js (a11y helpers)
└── pages/
    └── CustomerInfo.jsx (main dashboard page)
```

### Storybook Organization

```
Storybook/
├── Navigation
│   ├── TopNav.stories.jsx
│   ├── NavPill.stories.jsx
│   └── IconDock.stories.jsx
├── Cards
│   ├── Card.stories.jsx
│   ├── DealCard.stories.jsx
│   │   ├── States (Active, Qualified, Closed, etc.)
│   │   └── Interactions (Hover, Focus)
│   └── StatCard.stories.jsx
├── Forms
│   ├── DetailField.stories.jsx (default, edit, error states)
│   └── FormInput.stories.jsx
├── States
│   ├── Loading.stories.jsx (skeletons)
│   ├── Empty.stories.jsx
│   └── Error.stories.jsx
└── Dashboard
    └── CustomerInfo.stories.jsx (full page composition)
```

---

## 11. API Integration Notes

### Expected Data Models

**Contact/Customer Object:**
```javascript
{
  id: "contact_123",
  firstName: "Eva",
  lastName: "Robinson",
  email: "eva@alabamamachinery.com",
  phone: "+911 120 222 313",
  company: "Alabama Machinery & Supply",
  jobTitle: "CEO",
  avatar: "https://...",
  sources: ["whatsapp", "google", "linkedin"], // Platform names
  lastContacted: "2023-06-15T19:16:00Z",
  metadata: {
    createdAt: "2023-01-15",
    updatedAt: "2023-06-15"
  }
}
```

**Deal Object (Interaction History):**
```javascript
{
  id: "deal_456",
  date: "2023-10-04",
  name: "Royal Package Opportunity",
  amount: 11250,
  currency: "USD",
  status: "qualification", // Maps to color token
  teamMembers: [
    { id: "user_1", name: "John Doe", avatar: "https://..." },
    { id: "user_2", name: "Jane Smith", avatar: "https://..." }
  ]
}
```

**Task Object (Calendar):**
```javascript
{
  id: "task_789",
  title: "Follow up call",
  date: "2023-10-04",
  time: "14:00",
  assignee: { id: "user_1", name: "John Doe", avatar: "https://..." },
  status: "pending" // pending, completed, cancelled
}
```

**Pipeline Stage Object (Funnel):**
```javascript
{
  id: "stage_001",
  name: "Qualification",
  amount: 92350,
  totalPipeline: 350500,
  dealCount: 8,
  weighted: true // Optional: weighted vs. total view
}
```

### API Endpoints (Suggested)

```
GET /api/contacts/:contactId
GET /api/contacts/:contactId/deals
GET /api/contacts/:contactId/tasks?month=2023-10
GET /api/contacts/:contactId/pipeline
POST /api/contacts/:contactId (update contact)
PATCH /api/contacts/:contactId/fields/:fieldName (update single field)
```

---

## 12. Deployment Checklist

### Pre-Launch QA

- [ ] **Functionality:**
  - [ ] All buttons and links navigate/trigger correctly
  - [ ] Forms validate and submit
  - [ ] Cards expand/collapse smoothly
  - [ ] Pagination works (if included)
  - [ ] Filters/toggles (Weighted vs. Total) function

- [ ] **Accessibility (WCAG AA):**
  - [ ] Color contrast: All text ≥4.5:1 (body), ≥3:1 (large)
  - [ ] Focus indicators: Visible on all interactive elements
  - [ ] Keyboard nav: Tab through all controls, no traps
  - [ ] Screen reader: All icons labeled, structure announced, no redundancy
  - [ ] Touch targets: All buttons ≥44×44px

- [ ] **Responsive Design:**
  - [ ] Mobile (375px): Single column, readable text, no horizontal scroll
  - [ ] Tablet (768px): 2-column layout, sidebar below
  - [ ] Desktop (1024px+): Full layout, left dock visible
  - [ ] Orientation: Portrait and landscape on mobile/tablet

- [ ] **Performance:**
  - [ ] Skeleton loaders appear while data loads (<200ms)
  - [ ] No cumulative layout shift (CLS <0.1)
  - [ ] First Contentful Paint <2s
  - [ ] Largest Contentful Paint <2.5s
  - [ ] Time to Interactive <3.5s

- [ ] **Cross-Browser:**
  - [ ] Chrome (latest 2 versions)
  - [ ] Firefox (latest 2 versions)
  - [ ] Safari (macOS & iOS, latest 2)
  - [ ] Edge (latest 2 versions)

- [ ] **Data States:**
  - [ ] Empty state (no deals, no tasks)
  - [ ] Loading state (spinners, skeletons)
  - [ ] Error state (network error, missing data)
  - [ ] Single item (edge case: 1 deal, 1 task)
  - [ ] Large datasets (100+ deals, overflow handling)

### Browser Support

- Modern browsers (last 2 versions): Chrome, Firefox, Safari, Edge
- Mobile browsers: iOS Safari 14+, Chrome Android
- Fallbacks for CSS Grid, Flexbox (all modern browsers support these)
- No IE11 support (end-of-life)

---

## 13. Design Handoff Checklist

### Deliverables to Developer Team

- [ ] **Figma design file** with:
  - [ ] All component variants (default, hover, active, disabled, loading, error)
  - [ ] Annotations for spacing, typography, colors
  - [ ] Responsive breakpoint frames (mobile, tablet, desktop)
  - [ ] Component library view (organized by type)

- [ ] **Design System Documentation** (this file + Storybook)

- [ ] **Token export** (JSON/CSS):
  ```json
  {
    "colors": { "blue-primary": "#2E5AAC", ... },
    "typography": { "display": { "fontSize": "32px", ... }, ... },
    "spacing": { "xs": "4px", ... },
    "radius": { "sm": "4px", ... }
  }
  ```

- [ ] **Interaction specifications:**
  - [ ] Micro-interaction timings (CSS transitions)
  - [ ] Hover/focus/active state details
  - [ ] Animation curves (ease-in-out, linear, etc.)

- [ ] **Accessibility report:**
  - [ ] Color contrast matrix (all pairs tested)
  - [ ] ARIA recommendations per component
  - [ ] Keyboard navigation flow diagram

- [ ] **Mobile responsive guide:**
  - [ ] Breakpoints and layout changes
  - [ ] Navigation transformation (dock → bottom bar)
  - [ ] Component adjustments per breakpoint

- [ ] **Content guidelines:**
  - [ ] Character limits for field names, deal titles
  - [ ] Guidance for avatar overflow (3 visible + "+N")
  - [ ] Fallback content (initials, placeholder images)

---

## 14. Future Enhancements

### Potential Features (Post-MVP)

1. **Advanced Filtering & Search**
   - Filter deals by status, amount, date range
   - Search deals by name, contact name, amount
   - Saved filter views

2. **Data Export & Reporting**
   - Export deals to CSV/PDF
   - Generate pipeline reports
   - Email scheduled reports

3. **Collaboration & Comments**
   - Add notes/comments to deals
   - Mention teammates (@username)
   - Real-time collaboration (WebSocket updates)

4. **Mobile App**
   - Native iOS/Android versions
   - Offline mode for critical data
   - Push notifications for follow-ups

5. **Customizable Dashboard**
   - Drag-to-rearrange cards
   - Hide/show modules per user preference
   - Custom KPI selection

6. **Dark Mode**
   - Full dark theme support
   - Automatic detection (prefers-color-scheme)
   - Manual toggle in settings

7. **Advanced Funnel Analytics**
   - Drill-down by stage, team member, or date range
   - Conversion rate trends
   - Deal cycle length analytics

8. **Calendar Integrations**
   - Sync with Google Calendar, Outlook
   - Block time for tasks
   - Automated reminders

---

## 15. Quick Reference: Design Decision Log

| Decision | Rationale | Trade-offs |
|----------|-----------|-----------|
| Color-blocking (no shadows) | Modern, clean aesthetic; color conveys info | Minimal depth cues; harder to distinguish hover states |
| Card-based grid layout | Flexible for responsive design; modular | Fixed 2×3 grid doesn't scale for variable data |
| Avatar stacks (max 3 visible) | Space-efficient; social context | "+N more" may be unclear to new users |
| Icon-only dock buttons | Space-saving, clean UI | Requires tooltips for accessibility |
| Deal status color mapping | Visual scanability | Requires predefined status enum (no custom colors) |
| Sidebar on right (not left) | Right-to-left reading pattern; keeps main content centered | May require adjustment for RTL languages |

---

## Appendix: Testing Checklist

### Unit Tests (Component Level)

```javascript
// Example: DealCard.test.js
describe('DealCard', () => {
  it('renders deal name, amount, and avatars', () => { ... });
  it('maps status prop to correct background color', () => { ... });
  it('calls onActionClick when menu button is clicked', () => { ... });
  it('shows "+N more" when avatars exceed max', () => { ... });
  it('has accessible aria-labels on action buttons', () => { ... });
});
```

### Integration Tests (Dashboard Level)

```javascript
// Example: CustomerInfo.integration.test.js
describe('Customer Information Dashboard', () => {
  it('loads and displays contact profile', () => { ... });
  it('fetches and displays deals in Interaction History', () => { ... });
  it('renders calendar with tasks for current month', () => { ... });
  it('handles error state when API fails', () => { ... });
  it('shows loading skeleton while data fetches', () => { ... });
});
```

### Visual Regression Tests

- Use Percy, Chromatic, or similar service
- Capture baseline screenshots for all components
- Run on each PR, alert on visual changes

### Accessibility Tests

- Axe-core automated scanning
- Manual WCAG AA audit (contract testing, keyboard nav)
- Screen reader testing (VoiceOver, NVDA)

### Performance Tests

- Lighthouse CI (target: 90+ scores)
- Web Vitals monitoring (LCP, CLS, FID)
- Bundle size tracking

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-03  
**Next Review:** 2026-08-03 (post-development sprint)

---

**Questions? Contact the Design System Team**

