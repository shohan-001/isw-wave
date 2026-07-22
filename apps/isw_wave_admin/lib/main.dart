import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:isw_wave_admin/src/api_client.dart';
import 'package:isw_wave_admin/src/app_state.dart';
import 'package:isw_wave_admin/src/screens/home_screen.dart';
import 'package:isw_wave_admin/src/screens/login_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://isw-wave.isharaka.dev',
  );
  final prefs = await SharedPreferences.getInstance();
  final api = ApiClient(baseUrl: apiBase);
  final state = AppState(api: api, prefs: prefs);
  await state.hydrate();
  runApp(IswWaveAdminApp(state: state));
}

class IswWaveAdminApp extends StatelessWidget {
  const IswWaveAdminApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final base = ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF07080C),
      colorScheme: const ColorScheme.dark(
        primary: Color(0xFF22D3EE),
        secondary: Color(0xFF22D3EE),
        surface: Color(0xFF12141C),
      ),
      useMaterial3: true,
    );

    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        return MaterialApp(
          title: 'ISW Wave Admin',
          debugShowCheckedModeBanner: false,
          theme: base.copyWith(
            textTheme: GoogleFonts.spaceGroteskTextTheme(base.textTheme),
          ),
          home: state.isLoggedIn
              ? HomeScreen(state: state)
              : LoginScreen(state: state),
        );
      },
    );
  }
}
