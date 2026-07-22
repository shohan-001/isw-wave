import 'package:flutter/foundation.dart';
import 'package:isw_wave_admin/src/api_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppState extends ChangeNotifier {
  AppState({required this.api, required this.prefs});

  final ApiClient api;
  final SharedPreferences prefs;

  String? token;
  String? eventId;
  String? eventSlug;
  String? username;

  bool get isLoggedIn => token != null && token!.trim().isNotEmpty;

  Future<void> hydrate() async {
    final saved = prefs.getString('token')?.trim();
    if (saved == null || saved.isEmpty) {
      token = null;
      api.token = null;
      notifyListeners();
      return;
    }
    token = saved;
    eventId = prefs.getString('eventId');
    eventSlug = prefs.getString('eventSlug');
    username = prefs.getString('username');
    api.token = token;
    notifyListeners();
  }

  Future<void> login({
    required String identifier,
    required String password,
  }) async {
    final body = await api.login(identifier: identifier, password: password);
    final user = body['user'] as Map<String, dynamic>;
    final nextToken = (body['token'] as String?)?.trim();
    if (nextToken == null || nextToken.isEmpty) {
      throw ApiException('Login did not establish a session.');
    }
    token = nextToken;
    eventId = user['eventId'] as String? ?? '';
    eventSlug = user['eventSlug'] as String? ?? '';
    username = user['username'] as String? ?? identifier;
    api.token = token;
    await prefs.setString('token', token!);
    await prefs.setString('eventId', eventId ?? '');
    await prefs.setString('eventSlug', eventSlug ?? '');
    await prefs.setString('username', username ?? '');
    notifyListeners();
  }

  Future<void> logout() async {
    token = null;
    eventId = null;
    eventSlug = null;
    username = null;
    api.token = null;
    await prefs.clear();
    notifyListeners();
  }
}
