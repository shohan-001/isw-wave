import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class WaveColors {
  static const ink = Color(0xFF07080C);
  static const surface = Color(0xFF12141C);
  static const glass = Color(0xD912141C);
  static const cyan = Color(0xFF22D3EE);
  static const cyanDim = Color(0x6622D3EE);
  static const rose = Color(0xFFF43F5E);
  static const emerald = Color(0xFF34D399);
  static const amber = Color(0xFFFBBF24);
  static const muted = Color(0x8AFFFFFF);
  static const faint = Color(0x52FFFFFF);
}

ThemeData buildWaveTheme() {
  final base = ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: WaveColors.ink,
    colorScheme: const ColorScheme.dark(
      primary: WaveColors.cyan,
      secondary: WaveColors.cyan,
      surface: WaveColors.surface,
      error: WaveColors.rose,
    ),
    useMaterial3: true,
    dividerColor: Colors.white12,
  );

  return base.copyWith(
    textTheme: GoogleFonts.spaceGroteskTextTheme(base.textTheme).apply(
      bodyColor: Colors.white,
      displayColor: Colors.white,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.black.withOpacity(0.35),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Colors.white24),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Colors.white24),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: WaveColors.cyan, width: 1.4),
      ),
      labelStyle: const TextStyle(color: WaveColors.muted),
      hintStyle: const TextStyle(color: WaveColors.faint),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: WaveColors.surface,
      contentTextStyle: GoogleFonts.spaceGrotesk(color: Colors.white),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: WaveColors.surface,
      selectedItemColor: WaveColors.cyan,
      unselectedItemColor: WaveColors.muted,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
  );
}

BoxDecoration glassDecoration({
  Color? borderColor,
  double radius = 24,
}) {
  return BoxDecoration(
    color: WaveColors.glass,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: borderColor ?? Colors.white12),
    boxShadow: [
      BoxShadow(
        color: WaveColors.cyan.withOpacity(0.06),
        blurRadius: 24,
        offset: const Offset(0, 8),
      ),
    ],
  );
}
