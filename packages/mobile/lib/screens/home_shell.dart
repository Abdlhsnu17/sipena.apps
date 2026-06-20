import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'auth/login_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'module_list_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _selectedIndex = 0;

  static const _destinations = [
    _NavItem('Dashboard', Icons.dashboard_outlined),
    _NavItem('Aset', Icons.inventory_2_outlined),
    _NavItem('Peminjaman', Icons.assignment_outlined),
    _NavItem('Penggunaan Aset', Icons.handyman_outlined),
    _NavItem('Pemeliharaan', Icons.build_outlined),
    _NavItem('Jadwal Pemeliharaan', Icons.event_outlined),
    _NavItem('SPK Prioritas Aset', Icons.leaderboard_outlined),
    _NavItem('Laporan', Icons.bar_chart_outlined),
    _NavItem('Pengguna', Icons.people_outlined),
    _NavItem('Aktivitas', Icons.history_outlined),
  ];

  Widget _buildPage(int index) {
    switch (index) {
      case 0:
        return const DashboardScreen();
      case 1:
        return const ModuleListScreen(title: 'Aset', basePath: '/assets');
      case 2:
        return const ModuleListScreen(title: 'Peminjaman', basePath: '/borrowing');
      case 3:
        return const ModuleListScreen(title: 'Penggunaan Aset', basePath: '/asset-usage');
      case 4:
        return const ModuleListScreen(title: 'Pemeliharaan', basePath: '/maintenance');
      case 5:
        return const ModuleListScreen(title: 'Jadwal Pemeliharaan', basePath: '/maintenance-schedule');
      case 6:
        return const _PlaceholderScreen(title: 'SPK Prioritas Aset');
      case 7:
        return const _PlaceholderScreen(title: 'Laporan');
      case 8:
        return const ModuleListScreen(title: 'Pengguna', basePath: '/users');
      case 9:
        return const ModuleListScreen(title: 'Aktivitas', basePath: '/user-activities');
      default:
        return const DashboardScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: Text(_destinations[_selectedIndex].label)),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(color: Colors.black),
              child: Align(
                alignment: Alignment.bottomLeft,
                child: Text(
                  auth.currentUser?.name ?? 'SIPENA',
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            for (var i = 0; i < _destinations.length; i++)
              ListTile(
                leading: Icon(_destinations[i].icon),
                title: Text(_destinations[i].label),
                selected: _selectedIndex == i,
                onTap: () {
                  setState(() => _selectedIndex = i);
                  Navigator.of(context).pop();
                },
              ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Keluar'),
              onTap: () async {
                await auth.logout();
                if (context.mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (route) => false,
                  );
                }
              },
            ),
          ],
        ),
      ),
      body: _buildPage(_selectedIndex),
    );
  }
}

class _NavItem {
  final String label;
  final IconData icon;
  const _NavItem(this.label, this.icon);
}

class _PlaceholderScreen extends StatelessWidget {
  final String title;
  const _PlaceholderScreen({required this.title});

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Modul ini akan segera tersedia'));
  }
}
