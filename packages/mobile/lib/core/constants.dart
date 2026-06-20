/// Base URL untuk backend SIPENA.
///
/// Override saat build/run, contoh:
/// flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000/api
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:5000/api',
);

const List<String> assetTypes = ['medical', 'non_medical'];
const List<String> assetStatuses = ['available', 'borrowed', 'maintenance', 'disposed'];
const List<String> assetConditions = ['good', 'fair', 'poor', 'damaged'];
const List<String> borrowingStatuses = ['pending', 'approved', 'rejected', 'borrowed', 'returned', 'overdue'];
const List<String> maintenanceTypes = ['preventive', 'corrective', 'calibration', 'inspection'];
const List<String> maintenanceStatuses = ['requested', 'scheduled', 'in_progress', 'completed', 'validated', 'cancelled'];
const List<String> userRoles = ['admin', 'leader', 'staff', 'teknisi', 'staff_pj', 'user'];
