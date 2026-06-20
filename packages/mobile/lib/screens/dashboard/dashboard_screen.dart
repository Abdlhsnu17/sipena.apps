import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../providers/auth_provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _summary;
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
      final api = ApiClient();
      final data = await api.get('/reports');
      setState(() => _summary = data is Map<String, dynamic> ? data : {});
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Gagal memuat dashboard');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Selamat datang, ${auth.currentUser?.name ?? ''}',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          Text(
            'Peran: ${auth.currentUser?.role ?? '-'}',
            style: const TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 16),
          if (_loading) const Center(child: CircularProgressIndicator()),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          if (!_loading && _error == null) _buildSummaryGrid(),
        ],
      ),
    );
  }

  Widget _buildSummaryGrid() {
    final summary = _summary ?? {};
    final cards = <_SummaryCard>[
      _SummaryCard('Total Aset', summary['totalAssets'] ?? summary['assetCount']),
      _SummaryCard('Peminjaman Aktif', summary['activeBorrowings'] ?? summary['borrowingCount']),
      _SummaryCard('Pemeliharaan Berjalan', summary['activeMaintenance'] ?? summary['maintenanceCount']),
      _SummaryCard('Notifikasi', summary['notificationCount']),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      children: cards
          .map((c) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${c.value ?? '-'}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(c.label, style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ))
          .toList(),
    );
  }
}

class _SummaryCard {
  final String label;
  final dynamic value;
  _SummaryCard(this.label, this.value);
}
