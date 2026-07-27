import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isw_wave_admin/src/theme.dart';

void main() {
  test('wave theme builds', () {
    final theme = buildWaveTheme();
    expect(theme.brightness, Brightness.dark);
    expect(theme.colorScheme.primary, WaveColors.cyan);
  });
}
