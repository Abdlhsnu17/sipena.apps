import '../core/api_client.dart';
import '../models/record.dart';

/// Service CRUD generik untuk endpoint yang mengembalikan list+pagination
/// di `data.items`/`data.rows` atau langsung sebagai list pada `data`.
class CrudService {
  final ApiClient api;
  final String basePath;

  CrudService(this.api, this.basePath);

  List<SipenaRecord> _extractList(dynamic data) {
    List<dynamic> rawList;
    if (data is List) {
      rawList = data;
    } else if (data is Map<String, dynamic>) {
      rawList = (data['items'] ?? data['rows'] ?? data['data'] ?? const []) as List<dynamic>;
    } else {
      rawList = const [];
    }
    return rawList
        .whereType<Map<String, dynamic>>()
        .map(SipenaRecord.fromJson)
        .toList();
  }

  Future<List<SipenaRecord>> list({Map<String, dynamic>? query}) async {
    final data = await api.get(basePath, query: query);
    return _extractList(data);
  }

  Future<SipenaRecord> getById(int id) async {
    final data = await api.get('$basePath/$id');
    return SipenaRecord.fromJson(data as Map<String, dynamic>);
  }

  Future<SipenaRecord> create(Map<String, dynamic> body) async {
    final data = await api.post(basePath, body: body);
    return SipenaRecord.fromJson(data as Map<String, dynamic>);
  }

  Future<SipenaRecord> update(int id, Map<String, dynamic> body, {bool usePut = false}) async {
    final data = usePut
        ? await api.put('$basePath/$id', body: body)
        : await api.patch('$basePath/$id', body: body);
    return SipenaRecord.fromJson(data as Map<String, dynamic>);
  }

  Future<void> delete(int id) async {
    await api.delete('$basePath/$id');
  }

  Future<SipenaRecord> action(int id, String suffix, {Map<String, dynamic>? body}) async {
    final data = await api.patch('$basePath/$id/$suffix', body: body ?? {});
    return SipenaRecord.fromJson(data as Map<String, dynamic>);
  }
}
