import '../core/api_client.dart';
import '../models/user.dart';

class AuthResult {
  final AppUser user;
  final String token;

  AuthResult(this.user, this.token);
}

class AuthService {
  final ApiClient api;

  AuthService(this.api);

  Future<AuthResult> login({required String nip, required String password}) async {
    final data = await api.post('/auth/login', body: {'nip': nip, 'password': password});
    final map = data as Map<String, dynamic>;
    return AuthResult(AppUser.fromJson(map['user'] as Map<String, dynamic>), map['token'] as String);
  }

  Future<void> register({
    required String nip,
    required String name,
    required String email,
    required String phoneNumber,
    required String password,
    required String confirmPassword,
  }) async {
    await api.post('/auth/register', body: {
      'nip': nip,
      'name': name,
      'email': email,
      'phoneNumber': phoneNumber,
      'password': password,
      'confirmPassword': confirmPassword,
    });
  }

  Future<void> verifyResetNip(String nip) async {
    await api.post('/auth/reset-password/verify', body: {'nip': nip});
  }

  Future<void> resetPassword({
    required String nip,
    required String verificationCode,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await api.post('/auth/reset-password', body: {
      'nip': nip,
      'verificationCode': verificationCode,
      'newPassword': newPassword,
      'confirmPassword': confirmPassword,
    });
  }

  Future<AppUser> me() async {
    final data = await api.get('/auth/me');
    return AppUser.fromJson(data as Map<String, dynamic>);
  }

  Future<void> logout() async {
    await api.post('/auth/logout');
  }
}
