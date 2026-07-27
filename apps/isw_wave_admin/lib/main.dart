import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/api/api_client.dart';
import 'package:isw_wave_admin/src/api/staff_api_client.dart';
import 'package:isw_wave_admin/src/screens/mode_select_screen.dart';
import 'package:isw_wave_admin/src/screens/organizer/shell.dart';
import 'package:isw_wave_admin/src/screens/staff/shell.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://isw-wave.isharaka.dev',
  );
  final prefs = await SharedPreferences.getInstance();
  final api = ApiClient(baseUrl: apiBase);
  final staffApi = StaffApiClient(baseUrl: apiBase);
  final state = AppState(api: api, staffApi: staffApi, prefs: prefs);
  await state.hydrate();
  runApp(IswWaveAdminApp(state: state));
}

class IswWaveAdminApp extends StatelessWidget {
  const IswWaveAdminApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        Widget home;
        if (state.isOrganizer) {
          home = OrganizerShell(state: state);
        } else if (state.isStaff) {
          home = StaffShell(state: state);
        } else {
          home = ModeSelectScreen(state: state);
        }

        return MaterialApp(
          title: 'ISW Wave Admin',
          debugShowCheckedModeBanner: false,
          theme: buildWaveTheme(),
          home: home,
        );
      },
    );
  }
}
