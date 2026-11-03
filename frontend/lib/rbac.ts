export const roles = [
  'super_admin',
  'admin_operasional',
  'tour_guide',
  'driver',
] as const;

export type UserRole = (typeof roles)[number];

export type Permission =
  | 'dashboard.view'
  | 'heritage.manage'
  | 'packages.manage'
  | 'graph.manage'
  | 'rentals.manage'
  | 'bookings.manage'
  | 'bookings.assigned'
  | 'vehicle.location.update'
  | 'monitoring.view'
  | 'payments.manage'
  | 'reports.view'
  | 'notifications.manage'
  | 'audit.view'
  | 'settings.view'
  | 'settings.manage'
  | 'help.view'
  | 'users.manage'
  | 'rbac.manage';

export const permissionLabels: Record<Permission, string> = {
  'dashboard.view': 'Lihat dashboard',
  'heritage.manage': 'Kelola heritage',
  'packages.manage': 'Kelola paket wisata',
  'graph.manage': 'Kelola graph routing',
  'rentals.manage': 'Kelola sewa',
  'bookings.manage': 'Kelola semua booking',
  'bookings.assigned': 'Lihat booking tugas',
  'vehicle.location.update': 'Update lokasi kendaraan',
  'monitoring.view': 'Lihat monitoring operasional',
  'payments.manage': 'Kelola pembayaran',
  'reports.view': 'Lihat laporan',
  'notifications.manage': 'Kelola notifikasi',
  'audit.view': 'Lihat audit log',
  'settings.view': 'Lihat pengaturan sistem',
  'settings.manage': 'Kelola pengaturan sistem',
  'help.view': 'Lihat bantuan',
  'users.manage': 'Kelola user',
  'rbac.manage': 'Kelola RBAC',
};

export const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin_operasional: 'Admin Operasional',
  tour_guide: 'Tour Guide',
  driver: 'Driver',
};

export const rolePermissions: Record<UserRole, Permission[]> = {
  super_admin: [
    'dashboard.view',
    'heritage.manage',
    'packages.manage',
    'graph.manage',
    'rentals.manage',
    'bookings.manage',
    'bookings.assigned',
    'vehicle.location.update',
    'monitoring.view',
    'payments.manage',
    'reports.view',
    'notifications.manage',
    'audit.view',
    'settings.view',
    'settings.manage',
    'help.view',
    'users.manage',
    'rbac.manage',
  ],
  admin_operasional: [
    'dashboard.view',
    'heritage.manage',
    'packages.manage',
    'rentals.manage',
    'bookings.manage',
    'monitoring.view',
    'payments.manage',
    'reports.view',
    'notifications.manage',
    'audit.view',
    'settings.view',
    'help.view',
  ],
  tour_guide: ['dashboard.view', 'bookings.assigned', 'monitoring.view', 'help.view'],
  driver: ['vehicle.location.update', 'help.view'],
};

export const routePermissions: Array<{
  pattern: RegExp;
  permissions: Permission[];
}> = [
  { pattern: /^\/admin\/rbac(?:\/.*)?$/, permissions: ['rbac.manage'] },
  { pattern: /^\/admin\/heritage(?:\/.*)?$/, permissions: ['heritage.manage'] },
  { pattern: /^\/admin\/paket(?:\/.*)?$/, permissions: ['packages.manage'] },
  { pattern: /^\/admin\/routes(?:\/.*)?$/, permissions: ['packages.manage'] },
  { pattern: /^\/admin\/graph(?:\/.*)?$/, permissions: ['graph.manage'] },
  { pattern: /^\/admin\/sewa(?:\/.*)?$/, permissions: ['rentals.manage'] },
  { pattern: /^\/admin\/booking(?:\/.*)?$/, permissions: ['bookings.manage', 'bookings.assigned'] },
  { pattern: /^\/admin\/monitoring(?:\/.*)?$/, permissions: ['monitoring.view'] },
  { pattern: /^\/admin\/payments(?:\/.*)?$/, permissions: ['payments.manage'] },
  { pattern: /^\/admin\/reports(?:\/.*)?$/, permissions: ['reports.view'] },
  { pattern: /^\/admin\/notifications(?:\/.*)?$/, permissions: ['notifications.manage'] },
  { pattern: /^\/admin\/audit(?:\/.*)?$/, permissions: ['audit.view'] },
  { pattern: /^\/admin\/settings(?:\/.*)?$/, permissions: ['settings.view', 'settings.manage'] },
  { pattern: /^\/admin\/help(?:\/.*)?$/, permissions: ['help.view'] },
  { pattern: /^\/admin\/users(?:\/.*)?$/, permissions: ['users.manage'] },
  { pattern: /^\/admin(?:\/)?$/, permissions: ['dashboard.view'] },
];

export function isUserRole(value?: string | null): value is UserRole {
  return roles.includes(value as UserRole);
}

export function getPermissions(role?: string | null): Permission[] {
  if (!isUserRole(role)) return [];
  return rolePermissions[role];
}

export function can(role: string | null | undefined, permission: Permission) {
  return getPermissions(role).includes(permission);
}

export function canAccessPath(role: string | null | undefined, pathname: string) {
  const rule = routePermissions.find(({ pattern }) => pattern.test(pathname));
  return rule ? rule.permissions.some((permission) => can(role, permission)) : false;
}
