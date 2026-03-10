import type { RoutePermission, NavLinkConfig } from '../types/index.ts';

export const routePermissions: RoutePermission[] = [
  { path: '/',              groups: ['admin'] },
  { path: '/metric-tree',   groups: ['admin', 'executive'] },
  { path: '/process-map',   groups: ['admin'] },
  { path: '/dashboards',      groups: ['admin', 'analytics', 'clinical', 'executive'] },
  { path: '/dashboards/:slug', groups: ['admin', 'analytics', 'clinical', 'executive'] },
];

export const navLinks: NavLinkConfig[] = [
  { path: '/',            label: 'Chat' },
  { path: '/metric-tree', label: 'Metric Tree' },
  { path: '/process-map', label: 'Process Maps' },
  { path: '/dashboards',  label: 'Dashboards' },
];
