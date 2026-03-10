import { useUser } from '@clerk/clerk-react';
import { matchPath } from 'react-router-dom';
import { routePermissions } from '../config/permissions.ts';
import type { ClerkPublicMetadata } from '../types/index.ts';

export function usePermissions(): { canAccess: (path: string) => boolean } {
  const { user } = useUser();

  const metadata = (user?.publicMetadata ?? {}) as ClerkPublicMetadata;
  const userGroups = metadata.groups ?? [];
  const allowedRoutes = metadata.allowedRoutes ?? [];

  function canAccess(path: string): boolean {
    const entry = routePermissions.find((r) => matchPath(r.path, path));

    if (!entry) return false;

    if (entry.groups.length === 0) return true;

    if (allowedRoutes.some((pattern) => matchPath(pattern, path))) return true;

    return entry.groups.some((g) => userGroups.includes(g));
  }

  return { canAccess };
}
