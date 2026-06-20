import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/record.dart';
import '../services/crud_service.dart';

/// Layar daftar generik dipakai untuk modul-modul SIPENA yang berbentuk
/// tabel sederhana di web (aset, peminjaman, penggunaan aset, pemeliharaan,
/// jadwal pemeliharaan, pengguna, aktivitas). Menghindari duplikasi layar
/// list yang nyaris identik untuk setiap modul.
class ModuleListScreen extends StatefulWidget {
  final String title;
  final String basePath;
  final List<String Function(SipenaRecord)> subtitleBuilders;

  const ModuleListScreen({
    super.key,
    required this.title,
    required this.basePath,
    this.subtitleBuilders = const [],
  });

  @override
  State<ModuleListScreen> createState() => _ModuleListScreenState();
}

class _ModuleListScreenState extends State<ModuleListScreen> {
  late final CrudService _service = CrudService(ApiClient(), widget.basePath);
  List<SipenaRecord> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _service.list(query: {'limit': 50});
      setState(() => _items = items);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Gagal memuat data');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          Icon(Icons.error_outline, size: 48, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Center(child: Text(_error!, textAlign: TextAlign.center)),
        ],
      );
    }
    if (_items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 80),
          Center(child: Text('Belum ada data')),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: _items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = _items[index];
        return Card(
          child: ListTile(
            title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: widget.subtitleBuilders.isEmpty
                ? Text(item.status)
                : Text(widget.subtitleBuilders.map((f) => f(item)).join(' • ')),
          ),
        );
      },
    );
  }
}
