import 'package:flutter/foundation.dart';
import 'package:isw_wave_admin/src/api/api_client.dart';
import 'package:isw_wave_admin/src/api/staff_api_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppMode { none, organizer, staff }

class AppState extends ChangeNotifier {
  AppState({
    required this.api,
    required this.staffApi,
    required this.prefs,
  });

  final ApiClient api;
  final StaffApiClient staffApi;
  final SharedPreferences prefs;

  AppMode mode = AppMode.none;

  // Organizer
  String? orgToken;
  String? eventId;
  String? eventSlug;
  String? orgUsername;

  // Staff
  String? staffToken;
  String? staffUsername;
  String? staffEmail;
  String? staffRole; // owner | moderator

  bool get isOrganizer => mode == AppMode.organizer && (orgToken?.isNotEmpty ?? false);
  bool get isStaff => mode == AppMode.staff && (staffToken?.isNotEmpty ?? false);
  bool get isLoggedIn => isOrganizer || isStaff;

  Future<void> hydrate() async {
    final savedMode = prefs.getString('mode');
    if (savedMode == 'organizer') {
      final t = prefs.getString('org_token')?.trim();
      if (t != null && t.isNotEmpty) {
        mode = AppMode.organizer;
        orgToken = t;
        eventId = prefs.getString('eventId');
        eventSlug = prefs.getString('eventSlug');
        orgUsername = prefs.getString('org_username');
        api.token = t;
      }
    } else if (savedMode == 'staff') {
      final t = prefs.getString('staff_token')?.trim();
      if (t != null && t.isNotEmpty) {
        mode = AppMode.staff;
        staffToken = t;
        staffUsername = prefs.getString('staff_username');
        staffEmail = prefs.getString('staff_email');
        staffRole = prefs.getString('staff_role');
        staffApi.token = t;
      }
    }
    notifyListeners();
  }

  Future<void> loginOrganizer({
    required String identifier,
    required String password,
  }) async {
    final body = await api.login(identifier: identifier, password: password);
    final user = body['user'] as Map<String, dynamic>;
    final next = (body['token'] as String?)?.trim();
    if (next == null || next.isEmpty) {
      throw ApiException('Login did not establish a session.');
    }
    mode = AppMode.organizer;
    orgToken = next;
    eventId = user['eventId'] as String? ?? '';
    eventSlug = user['eventSlug'] as String? ?? '';
    orgUsername = user['username'] as String? ?? identifier;
    api.token = next;
    staffApi.token = null;
    staffToken = null;

    await prefs.setString('mode', 'organizer');
    await prefs.setString('org_token', next);
    await prefs.setString('eventId', eventId ?? '');
    await prefs.setString('eventSlug', eventSlug ?? '');
    await prefs.setString('org_username', orgUsername ?? '');
    await prefs.remove('staff_token');
    notifyListeners();
  }

  Future<void> loginStaff({
    required String identifier,
    required String password,
  }) async {
    final body = await staffApi.login(
      identifier: identifier,
      password: password,
    );
    final staff = body['staff'] as Map<String, dynamic>;
    final next = (body['token'] as String?)?.trim();
    if (next == null || next.isEmpty) {
      throw ApiException('Staff login did not return a token.');
    }
    mode = AppMode.staff;
    staffToken = next;
    staffUsername = staff['username'] as String? ?? identifier;
    staffEmail = staff['email'] as String? ?? '';
    staffRole = staff['role'] as String? ?? 'moderator';
    staffApi.token = next;
    api.token = null;
    orgToken = null;

    await prefs.setString('mode', 'staff');
    await prefs.setString('staff_token', next);
    await prefs.setString('staff_username', staffUsername ?? '');
    await prefs.setString('staff_email', staffEmail ?? '');
    await prefs.setString('staff_role', staffRole ?? '');
    await prefs.remove('org_token');
    notifyListeners();
  }

  Future<void> logout() async {
    if (mode == AppMode.organizer) {
      await api.logout();
    } else if (mode == AppMode.staff) {
      await staffApi.logout();
    }
    mode = AppMode.none;
    orgToken = null;
    eventId = null;
    eventSlug = null;
    orgUsername = null;
    staffToken = null;
    staffUsername = null;
    staffEmail = null;
    staffRole = null;
    api.token = null;
    staffApi.token = null;
    await prefs.clear();
    notifyListeners();
  }

  void clearSessionOnUnauthorized() {
    mode = AppMode.none;
    orgToken = null;
    staffToken = null;
    api.token = null;
    staffApi.token = null;
    prefs.clear();
    notifyListeners();
  }
}
