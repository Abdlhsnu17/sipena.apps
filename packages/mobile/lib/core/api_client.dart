import 'dart:convert';

import 'package:http/http.dart' as http;

import 'constants.dart';
import 'session_store.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

/// Klien HTTP tipis di atas REST API backend SIPENA.
///
/// Semua endpoint backend mengembalikan body JSON berbentuk
/// `{ success: bool, message?: string, data?: any }`.
class ApiClient {
  final SessionStore sessionStore;
  final http.Client _http;

  ApiClient({SessionStore? sessionStore, http.Client? httpClient})
      : sessionStore = sessionStore ?? SessionStore(),
        _http = httpClient ?? http.Client();

  Uri _uri(String path, Map<String, dynamic>? query) {
    final cleanQuery = <String, String>{};
    query?.forEach((key, value) {
      if (value != null) cleanQuery[key] = value.toString();
    });
    return Uri.parse('$apiBaseUrl$path').replace(
      queryParameters: cleanQuery.isEmpty ? null : cleanQuery,
    );
  }

  Future<Map<String, String>> _headers({bool json = true}) async {
    final token = await sessionStore.getToken();
    return {
      if (json) 'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  dynamic _decode(http.Response response) {
    Map<String, dynamic> body;
    try {
      body = response.body.isEmpty ? {} : jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException('Respons server tidak valid', statusCode: response.statusCode);
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body['data'] ?? body;
    }

    final message = body['message']?.toString() ??
        (body['errors'] is List && (body['errors'] as List).isNotEmpty
            ? (body['errors'] as List).first['msg']?.toString()
            : null) ??
        'Terjadi kesalahan (${response.statusCode})';
    throw ApiException(message, statusCode: response.statusCode);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final response = await _http.get(_uri(path, query), headers: await _headers());
    return _decode(response);
  }

  Future<dynamic> post(String path, {Object? body}) async {
    final response = await _http.post(
      _uri(path, null),
      headers: await _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> put(String path, {Object? body}) async {
    final response = await _http.put(
      _uri(path, null),
      headers: await _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    final response = await _http.patch(
      _uri(path, null),
      headers: await _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> delete(String path) async {
    final response = await _http.delete(_uri(path, null), headers: await _headers());
    return _decode(response);
  }
}
