import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/session_store.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  final ApiClient api;
  final SessionStore sessionStore;
  late final AuthService _authService;

  AuthStatus status = AuthStatus.unknown;
  AppUser? currentUser;
  String? lastError;

  AuthProvider({ApiClient? api, SessionStore? sessionStore})
      : api = api ?? ApiClient(),
        sessionStore = sessionStore ?? api?.sessionStore ?? SessionStore() {
    _authService = AuthService(this.api);
  }

  Future<void> bootstrap() async {
    final token = await sessionStore.getToken();
    if (token == null) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      currentUser = await _authService.me();
      status = AuthStatus.authenticated;
    } catch (_) {
      await sessionStore.clear();
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String nip, String password) async {
    lastError = null;
    try {
      final result = await _authService.login(nip: nip, password: password);
      await sessionStore.save(
        token: result.token,
        role: result.user.role,
        name: result.user.name,
        userId: result.user.id,
      );
      currentUser = result.user;
      status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      lastError = e is ApiException ? e.message : 'Gagal login';
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _authService.logout();
    } catch (_) {
      // Tetap lanjut hapus sesi lokal walau request logout gagal.
    }
    await sessionStore.clear();
    currentUser = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
