import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:isw_wave_admin/src/api/api_client.dart';

/// Staff ops API (`isw_owner` Bearer).
class StaffApiClient {
  StaffApiClient({required this.baseUrl});

  final String baseUrl;
  String? token;

  Uri _u(String path, [Map<String, String>? q]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: q);

  Map<String, String> get _headers {
    final h = <String, String>{'content-type': 'application/json'};
    final t = token?.trim();
    if (t != null && t.isNotEmpty) {
      h['authorization'] = 'Bearer $t';
      h['cookie'] = 'isw_owner=$t';
    }
    return h;
  }

  Map<String, dynamic> _json(http.Response res) {
    try {
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  void _guard(http.Response res, Map<String, dynamic> body) {
    if (res.statusCode == 401) {
      throw UnauthorizedException(body['error'] as String? ?? 'Unauthorized');
    }
    if (res.statusCode == 403) {
      throw ApiException(body['error'] as String? ?? 'Forbidden');
    }
    if (res.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Request failed');
    }
  }

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final res = await http.post(
      _u('/api/owner/login'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );
    final body = _json(res);
    if (res.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Login failed');
    }
    final tok = (body['token'] as String?)?.trim();
    if (tok == null || tok.isEmpty) {
      throw ApiException(
        'Staff login succeeded but no token was returned. Deploy the latest API.',
      );
    }
    token = tok;
    return body;
  }

  Future<void> logout() async {
    try {
      await http.post(_u('/api/owner/logout'), headers: _headers);
    } catch (_) {}
  }

  Future<Map<String, dynamic>> overview() async {
    final res = await http.get(_u('/api/owner/overview'), headers: _headers);
    final body = _json(res);
    _guard(res, body);
    return body;
  }

  Future<Map<String, dynamic>> eventRequests({String status = 'pending'}) async {
    final res = await http.get(
      _u('/api/owner/event-requests', {'status': status}),
      headers: _headers,
    );
    final body = _json(res);
    _guard(res, body);
    return body;
  }

  Future<Map<String, dynamic>> reviewRequest(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final res = await http.post(
      _u('/api/owner/event-requests/$id'),
      headers: _headers,
      body: jsonEncode(payload),
    );
    final body = _json(res);
    _guard(res, body);
    return body;
  }

  Future<Map<String, dynamic>> eventDetail(String eventId) async {
    final res = await http.get(
      _u('/api/owner/events/$eventId'),
      headers: _headers,
    );
    final body = _json(res);
    _guard(res, body);
    return body;
  }

  Future<void> patchEvent(String eventId, Map<String, dynamic> payload) async {
    final res = await http.patch(
      _u('/api/owner/events/$eventId'),
      headers: _headers,
      body: jsonEncode(payload),
    );
    final body = _json(res);
    _guard(res, body);
  }

  Future<void> ban({
    required String participantId,
    required bool banned,
    String reason = '',
  }) async {
    final res = await http.post(
      _u('/api/owner/ban'),
      headers: _headers,
      body: jsonEncode({
        'participantId': participantId,
        'banned': banned,
        'reason': reason,
      }),
    );
    final body = _json(res);
    _guard(res, body);
  }

  Future<Map<String, dynamic>> inviteCodes() async {
    final res = await http.get(
      _u('/api/owner/invite-codes'),
      headers: _headers,
    );
    final body = _json(res);
    _guard(res, body);
    return body;
  }

  Future<Map<String, dynamic>> createInvite(Map<String, dynamic> payload) async {
    final res = await http.post(
      _u('/api/owner/invite-codes'),
      headers: _headers,
      body: jsonEncode(payload),
    );
    final body = _json(res);
    _guard(res, body);
    return body;
  }

  Future<void> patchInvite(String id, String action) async {
    final res = await http.patch(
      _u('/api/owner/invite-codes/$id'),
      headers: _headers,
      body: jsonEncode({'action': action}),
    );
    final body = _json(res);
    _guard(res, body);
  }

  Future<void> deleteInvite(String id) async {
    final res = await http.delete(
      _u('/api/owner/invite-codes/$id'),
      headers: _headers,
    );
    final body = _json(res);
    _guard(res, body);
  }

  Future<Map<String, dynamic>> logs({String? type, int page = 0}) async {
    final q = <String, String>{'page': '$page'};
    if (type != null && type.isNotEmpty) q['type'] = type;
    final res = await http.get(_u('/api/owner/logs', q), headers: _headers);
    final body = _json(res);
    _guard(res, body);
    return body;
  }
}
