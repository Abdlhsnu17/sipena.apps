import { Router } from 'express';

import accessControlRoutes from './access-control.routes';
import assetDisposalRoutes from './asset-disposal.routes';
import assetUsageRoutes from './asset-usage.routes';
import assetRoutes from './asset.routes';
import authRoutes from './auth.routes';
import borrowingRoutes from './borrowing.routes';
import deletionRequestRoutes from './deletion-request.routes';
import dssRoutes from './dss.routes';
import maintenanceHistoryRoutes from './maintenance-history.routes';
import maintenanceRoutes from './maintenance.routes';
import notificationRoutes from './notification.routes';
import reportRoutes from './report.routes';
import sanctionsRoutes from './sanctions.routes';
import umlRoutes from './uml.routes';
import userActivityRoutes from './user-activity.routes';
import userRoutes from './user.routes';

export interface ApiMount {
  /** Prefix tempat router dipasang, mis. `/api/borrowing`. */
  prefix: string;
  router: Router;
  /** True bila `authMiddleware` dipasang di level mount. */
  requiresAuth: boolean;
  /** Tag OpenAPI untuk seluruh endpoint di router ini. */
  tag: string;
}

/**
 * Satu-satunya sumber kebenaran untuk pemasangan router API.
 *
 * `createApp()` memasang tabel ini apa adanya, dan generator OpenAPI membacanya
 * untuk menyusun inventaris endpoint. Karena keduanya memakai tabel yang sama,
 * dokumentasi tidak bisa diam-diam menyimpang dari route yang benar-benar
 * dilayani: route baru otomatis muncul di spec.
 *
 * Tabel ini sengaja berada di modul terpisah dari `app.ts` agar generator
 * dokumentasi dapat membacanya tanpa membuat import melingkar.
 */
export const API_MOUNTS: readonly ApiMount[] = [
  { prefix: '/api/auth', router: authRoutes, requiresAuth: false, tag: 'Auth' },
  { prefix: '/api/access-control', router: accessControlRoutes, requiresAuth: true, tag: 'Access Control' },
  { prefix: '/api/users', router: userRoutes, requiresAuth: true, tag: 'Users' },
  { prefix: '/api/assets', router: assetRoutes, requiresAuth: true, tag: 'Assets' },
  { prefix: '/api/asset-usage', router: assetUsageRoutes, requiresAuth: true, tag: 'Asset Usage' },
  { prefix: '/api/borrowing', router: borrowingRoutes, requiresAuth: true, tag: 'Borrowing' },
  { prefix: '/api/deletion-requests', router: deletionRequestRoutes, requiresAuth: true, tag: 'Deletion Requests' },
  { prefix: '/api/dss', router: dssRoutes, requiresAuth: true, tag: 'DSS' },
  { prefix: '/api/maintenance', router: maintenanceRoutes, requiresAuth: true, tag: 'Maintenance' },
  { prefix: '/api/maintenance-history', router: maintenanceHistoryRoutes, requiresAuth: true, tag: 'Maintenance History' },
  { prefix: '/api/reports', router: reportRoutes, requiresAuth: true, tag: 'Reports' },
  { prefix: '/api/uml', router: umlRoutes, requiresAuth: true, tag: 'UML' },
  { prefix: '/api/user-activities', router: userActivityRoutes, requiresAuth: true, tag: 'User Activities' },
  { prefix: '/api/sanctions', router: sanctionsRoutes, requiresAuth: true, tag: 'Sanctions' },
  { prefix: '/api/asset-disposal', router: assetDisposalRoutes, requiresAuth: true, tag: 'Asset Disposal' },
  { prefix: '/api/notifications', router: notificationRoutes, requiresAuth: true, tag: 'Notifications' },
];

/** Router DSS dipakai ulang oleh alias debug khusus pengembangan di `app.ts`. */
export { dssRoutes };
