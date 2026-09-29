/** Every backend call the app makes, grouped by feature. */
import {
  Account,
  Claim,
  FoundReport,
  LostReport,
  MatchEntry,
  NotificationItem,
  PlaceResult,
} from '../types';
import { api } from './client';

// --- Accounts (SRS 4.1) -----------------------------------------------------

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    displayName: string;
    telegramUsername: string;
  }) => api.post<{ token: string; user: Account }>('/auth/register', body),

  login: (body: { email: string; password: string }) =>
    api.post<{ token: string; user: Account }>('/auth/login', body),

  me: () => api.get<Account>('/auth/me'),

  updateAccount: (body: { displayName: string; telegramUsername: string }) =>
    api.patch<Account>('/users/me', body),
};

// --- Lost Item Reports (SRS 4.2) --------------------------------------------

export const lostApi = {
  mine: () => api.get<LostReport[]>('/lost-reports/mine'),
  get: (id: string) => api.get<LostReport>(`/lost-reports/${id}`),
  create: (form: FormData) => api.postForm<LostReport>('/lost-reports', form),
  update: (id: string, form: FormData) => api.putForm<LostReport>(`/lost-reports/${id}`, form),
  remove: (id: string) => api.del<{ ok: true }>(`/lost-reports/${id}`),
  /** REQ-53: possible matches for this report. */
  matches: (id: string) => api.get<MatchEntry[]>(`/lost-reports/${id}/matches`),
};

// --- Found Item Reports (SRS 4.3) and browsing (SRS 4.5) --------------------

export const foundApi = {
  /** REQ-55 to REQ-58 */
  browse: (params: { q?: string; category?: string; colour?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.category) query.set('category', params.category);
    if (params.colour) query.set('colour', params.colour);
    query.set('page', String(params.page ?? 1));
    return api.get<{
      reports: FoundReport[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/found-reports?${query.toString()}`);
  },

  mine: () => api.get<FoundReport[]>('/found-reports/mine'),
  get: (id: string) => api.get<FoundReport>(`/found-reports/${id}`),
  create: (form: FormData) => api.postForm<FoundReport>('/found-reports', form),
  update: (id: string, form: FormData) => api.putForm<FoundReport>(`/found-reports/${id}`, form),
  remove: (id: string) => api.del<{ ok: true }>(`/found-reports/${id}`),
};

// --- Ownership claims (SRS 4.6) ---------------------------------------------

export const claimApi = {
  submit: (body: { foundReportId: string; lostReportId: string }) =>
    api.post<{ id: string; status: string }>('/claims', body),
  incoming: () => api.get<Claim[]>('/claims/incoming'),
  outgoing: () => api.get<Claim[]>('/claims/outgoing'),
  get: (id: string) => api.get<Claim>(`/claims/${id}`),
  approve: (id: string) => api.post<Claim>(`/claims/${id}/approve`),
  reject: (id: string) => api.post<Claim>(`/claims/${id}/reject`),
};

// --- Notifications ----------------------------------------------------------

export const notificationApi = {
  list: () => api.get<NotificationItem[]>('/notifications'),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.patch<{ ok: true }>(`/notifications/${id}/read`),
};

// --- OneMap (REQ-14/15, REQ-32/33) ------------------------------------------

export const mapApi = {
  /** Marker coordinates in, location name out. */
  reverseGeocode: (lat: number, lng: number) =>
    api.get<{ locationName: string; latitude: number; longitude: number }>(
      `/onemap/reverse-geocode?lat=${lat}&lng=${lng}`,
    ),
  search: (q: string) => api.get<PlaceResult[]>(`/onemap/search?q=${encodeURIComponent(q)}`),
};
