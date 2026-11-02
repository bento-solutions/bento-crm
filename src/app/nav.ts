/** The sidebar: plain sections and modules, each module with its own page at /m/<key>. */
export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Backend authority required to see the item (see AUTHORITIES_BY_ROLE); with a list, any one of them. */
  authority?: string | string[];
  /** Live count shown next to the label. */
  badge?: 'whatsappUnread';
  /** A tab of the page, passed as ?tab=; the item is active only on that tab. */
  tab?: string;
  /** This tab is the page's default, so the page without ?tab= counts as it. */
  defaultTab?: boolean;
  /** Other ?tab= values of the same page that also light this entry. */
  alsoTabs?: string[];
  /** One line shown under the entry on its module's page. */
  hint?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
  /** A module: a heading that opens and closes its pages. Without it the items show as plain links. */
  module?: { key: string; icon: string; /** One line under the title of the module's page. */ subtitle?: string };
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Dashboard',
    module: { key: 'dash', icon: 'space_dashboard', subtitle: 'Your overview and reports' },
    items: [
      { label: 'Home', icon: 'home', route: '/', hint: 'Your day at a glance: KPIs, tasks and tickets' },
      { label: 'Analytics', icon: 'bar_chart', route: '/analytics', hint: 'Sales, finance and activity charts' },
    ]
  },
  {
    label: '',
    items: [
      { label: 'Inbox', icon: 'forum', route: '/inbox', authority: 'WHATSAPP_READ', badge: 'whatsappUnread' },
    ]
  },
  {
    label: 'Sales',
    module: { key: 'sales', icon: 'monetization_on', subtitle: 'Pipeline and campaigns' },
    items: [
      { label: 'Sales pipeline', icon: 'view_kanban', route: '/sales', hint: 'Deals by stage, from lead to won' },
      { label: 'Marketing', icon: 'campaign', route: '/marketing', hint: 'Campaigns and WhatsApp broadcasts' },
    ]
  },
  {
    label: 'Contacts',
    module: { key: 'contacts', icon: 'contacts', subtitle: 'Partners, groups and shared documents' },
    items: [
      { label: 'Partners', icon: 'handshake', route: '/partners', hint: 'Leads and prospects', tab: 'Lead', defaultTab: true, alsoTabs: ['Prospect'] },
      { label: 'Groups', icon: 'group_work', route: '/groups', hint: 'Partner groups and holding structures' },
      { label: 'Documents', icon: 'folder_open', route: '/drive', hint: 'Shared files and folders', authority: 'FILES_READ' },
    ]
  },
  {
    label: 'Work',
    module: { key: 'work', icon: 'assignment', subtitle: 'Tasks, tickets, missions and automation' },
    items: [
      { label: 'Tasks', icon: 'task_alt', route: '/tasks', hint: 'To-dos and due dates for the team' },
      { label: 'Tickets', icon: 'support_agent', route: '/tickets', hint: 'Client requests and support' },
      { label: 'Missions', icon: 'work', route: '/missions', hint: 'Engagements per client', authority: 'PARTNERS_READ' },
      { label: 'Document checklists', icon: 'checklist', route: '/checklists', hint: 'Documents to collect from clients', authority: 'PARTNERS_READ' },
      { label: 'Automation', icon: 'smart_toy', route: '/automation', hint: 'Rules that run on their own' },
    ]
  },
  {
    label: 'Account Receivables',
    module: { key: 'ar', icon: 'call_received', subtitle: 'Customers, invoicing and collections' },
    items: [
      { label: 'Customers', icon: 'storefront', route: '/partners', hint: 'Every customer account', tab: 'Customer' },
      { label: 'Customer invoices', icon: 'receipt', route: '/finance', hint: 'Quotes, invoices and payments received', tab: 'Customer', defaultTab: true },
      { label: 'Recurring invoices', icon: 'event_repeat', route: '/finance/recurring', hint: 'Invoices sent on a schedule' },
      { label: 'Recovery', icon: 'notifications_active', route: '/finance', hint: 'Overdue invoices and reminders', tab: 'Recovery' },
      { label: 'Customer aging', icon: 'stacked_bar_chart', route: '/finance', hint: 'What customers owe, by age', tab: 'Aging' },
    ]
  },
  {
    label: 'Account Payables',
    module: { key: 'ap', icon: 'call_made', subtitle: 'Suppliers, bills and expenses' },
    items: [
      { label: 'Suppliers', icon: 'local_shipping', route: '/partners', hint: 'Every supplier account', tab: 'Vendor' },
      { label: 'Supplier bills', icon: 'request_quote', route: '/finance', hint: 'Bills to pay and payments made', tab: 'Vendor' },
      { label: 'Expenses', icon: 'payments', route: '/finance', hint: 'Expense claims and receipts', tab: 'Expenses', authority: 'PAYMENTS_READ' },
      { label: 'Supplier aging', icon: 'stacked_bar_chart', route: '/finance', hint: 'What you owe, by age', tab: 'SupplierAging' },
      { label: 'Documents inbox', icon: 'move_to_inbox', route: '/inbox-documents', hint: 'Bills and receipts received by email', authority: ['INVOICES_READ', 'PAYMENTS_READ'] },
    ]
  },
  {
    label: 'Cash and Bank',
    module: { key: 'bank', icon: 'savings', subtitle: 'Bank accounts, statements and cash' },
    items: [
      { label: 'Cash position', icon: 'savings', route: '/bank', hint: 'Balances across banks and cash', tab: 'cash', defaultTab: true, authority: 'PAYMENTS_READ' },
      { label: 'Bank transactions', icon: 'receipt_long', route: '/bank', hint: 'Statement lines and their matches', tab: 'transactions', authority: 'PAYMENTS_READ' },
      { label: 'Bank accounts', icon: 'account_balance', route: '/bank', hint: 'Accounts, RIBs and statements', tab: 'accounts', authority: 'PAYMENTS_READ' },
      { label: 'Matching rules', icon: 'rule', route: '/bank', hint: 'How lines match invoices automatically', tab: 'rules', authority: 'PAYMENTS_READ' },
    ]
  },
  {
    label: 'General Ledger',
    module: { key: 'gl', icon: 'menu_book', subtitle: 'Accounts, entries, reports and tax deadlines' },
    items: [
      { label: 'Chart of accounts', icon: 'account_tree', route: '/ledger', hint: 'PCGE accounts and balances', tab: 'accounts', defaultTab: true, authority: 'LEDGER_READ' },
      { label: 'Journal entries', icon: 'receipt_long', route: '/ledger', hint: 'Post, browse and reverse entries', tab: 'entries', authority: 'LEDGER_READ' },
      { label: 'General ledger', icon: 'menu_book', route: '/ledger', hint: 'Every line per account, with running balance', tab: 'ledger', authority: 'LEDGER_READ' },
      { label: 'Trial balance', icon: 'balance', route: '/ledger', hint: 'Debit and credit per account', tab: 'trial', authority: 'LEDGER_READ' },
      { label: 'Cost centers', icon: 'hub', route: '/ledger', hint: 'Analytic codes for entry lines', tab: 'cost-centers', authority: 'LEDGER_READ' },
      { label: 'Tax calendar', icon: 'event_note', route: '/tax-calendar', hint: 'TVA, IS, IR and CNSS deadlines', authority: ['INVOICES_READ', 'PAYMENTS_READ'] },
    ]
  },
  {
    label: 'Inventory',
    module: { key: 'inv', icon: 'inventory_2', subtitle: 'Catalogue, stock and warehouses' },
    items: [
      { label: 'Stock levels', icon: 'inventory_2', route: '/inventory', hint: 'Quantities per warehouse', tab: 'stock', defaultTab: true },
      { label: 'Catalogue', icon: 'category', route: '/inventory', hint: 'Products, services and prices', tab: 'products' },
      { label: 'Stock movements', icon: 'swap_vert', route: '/inventory', hint: 'Every stock in and out', tab: 'movements' },
      { label: 'Stock value', icon: 'payments', route: '/inventory', hint: 'What your stock is worth', tab: 'value' },
      { label: 'Warehouses', icon: 'warehouse', route: '/settings/stock', hint: 'Locations that hold stock' },
    ]
  }
];

/** The module page route of a section. */
export function moduleRoute(key: string): string {
  return '/m/' + key;
}
