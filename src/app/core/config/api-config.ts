import { environment } from '../../../environments/environment';

export const API_CONFIG = {
  baseUrl: environment.apiUrl,
  endpoints: {
    auth: {
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
      me: '/auth/me',
    },
    organizations: {
      create: '/organizations',
      me: '/organizations/me',
      update: '/organizations/me',
    },
    invitations: {
      list: '/invitations',
      create: '/invitations',
      update: (id: string) => `/invitations/${id}`,
      resend: (id: string) => `/invitations/${id}/resend`,
      revoke: (id: string) => `/invitations/${id}/revoke`,
      myPending: '/invitations/my-pending',
      acceptLoggedIn: (id: string) => `/invitations/${id}/accept-logged-in`,
      // Unauthenticated -- the invitation token is the only credential the invitee has.
      preview: '/public/invitations',
      accept: '/public/invitations/accept',
    },
    users: {
      list: '/users',
      create: '/users',
      get: (id: string) => `/users/${id}`,
      update: (id: string) => `/users/${id}`,
    },
    partners: {
      list: '/partners',
      create: '/partners',
      get: (id: string) => `/partners/${id}`,
      update: (id: string) => `/partners/${id}`,
      delete: (id: string) => `/partners/${id}`,
    },
    deals: {
      list: '/deals',
      create: '/deals',
      get: (id: string) => `/deals/${id}`,
      update: (id: string) => `/deals/${id}`,
    },
    proposals: {
      list: '/proposals',
      create: '/proposals',
      get: (id: string) => `/proposals/${id}`,
    },
    invoices: {
      list: '/invoices',
      create: '/invoices',
      get: (id: string) => `/invoices/${id}`,
    },
    tickets: {
      list: '/tickets',
      create: '/tickets',
      get: (id: string) => `/tickets/${id}`,
    },
    tasks: {
      list: '/tasks',
      create: '/tasks',
      get: (id: string) => `/tasks/${id}`,
    },
  },
} as const;

export const HTTP_CONFIG = {
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
} as const;
