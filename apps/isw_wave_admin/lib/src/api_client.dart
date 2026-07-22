import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({required this.baseUrl});

  final String baseUrl;

  /// Signed session value (same as `isw_auth` cookie / Bearer token).
  String? token;

  Uri _u(String path, [Map<String, String>? q]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: q);

  Map<String, String> get _headers {
    final h = <String, String>{'content-type': 'application/json'};
    final t = token?.trim();
    if (t != null && t.isNotEmpty) {
      h['authorization'] = 'Bearer $t';
      h['cookie'] = 'isw_auth=$t';
    }
    return h;
  }

  String? _extractAuthFromSetCookie(http.Response res) {
    // http package lowercases header names.
    final raw = res.headers['set-cookie'];
    if (raw == null || raw.isEmpty) return null;
    // May be multiple cookies joined; find isw_auth=
    final match = RegExp(r'isw_auth=([^;,\s]+)').firstMatch(raw);
    return match?.group(1);
  }

  void _throwIfUnauthorized(http.Response res, Map<String, dynamic>? body) {
    if (res.statusCode == 401) {
      throw UnauthorizedException(
        body?['error'] as String? ?? 'Unauthorized',
      );
    }
  }

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final res = await http.post(
      _u('/api/auth/login'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Login failed');
    }

    // Prefer explicit token (new API); fall back to Set-Cookie (current production).
    final fromBody = (body['token'] as String?)?.trim();
    final fromCookie = _extractAuthFromSetCookie(res);
    final resolved = (fromBody != null && fromBody.isNotEmpty)
        ? fromBody
        : fromCookie;
    if (resolved == null || resolved.isEmpty) {
      throw ApiException(
        'Login succeeded but no session cookie/token was returned.',
      );
    }
    token = resolved;
    body['token'] = resolved;
    return body;
  }

  Future<Map<String, dynamic>> queue({required String eventId}) async {
    final res = await http.get(
      _u('/api/queue', {'eventId': eventId}),
      headers: _headers,
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    _throwIfUnauthorized(res, body);
    if (res.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Queue failed');
    }
    return body;
  }

  Future<List<dynamic>> pending() async {
    final res = await http.get(
      _u('/api/requests', {'status': 'pending'}),
      headers: _headers,
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    _throwIfUnauthorized(res, body);
    if (res.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Pending failed');
    }
    return (body['requests'] as List<dynamic>? ?? const []);
  }

  Future<void> patchRequest(String id, String action) async {
    final res = await http.patch(
      _u('/api/requests/$id'),
      headers: _headers,
      body: jsonEncode({'action': action}),
    );
    Map<String, dynamic>? body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {}
    _throwIfUnauthorized(res, body);
    if (res.statusCode >= 400) {
      throw ApiException(body?['error'] as String? ?? 'Action failed');
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final res = await http.post(
      _u('/api/auth/password'),
      headers: _headers,
      body: jsonEncode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      }),
    );
    Map<String, dynamic>? body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {}
    _throwIfUnauthorized(res, body);
    if (res.statusCode >= 400) {
      throw ApiException(body?['error'] as String? ?? 'Password change failed');
    }
  }
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class UnauthorizedException extends ApiException {
  UnauthorizedException(super.message);
}
