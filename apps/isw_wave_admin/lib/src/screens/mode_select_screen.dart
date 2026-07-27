import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';
import 'package:isw_wave_admin/src/screens/organizer/login_screen.dart';
import 'package:isw_wave_admin/src/screens/staff/login_screen.dart';

class ModeSelectScreen extends StatelessWidget {
  const ModeSelectScreen({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'ISW WAVE',
                style: TextStyle(
                  color: WaveColors.cyan,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Control room',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  height: 1.05,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Pick how you\'re signing in. Organizers run a live event. '
                'Staff manage the whole site.',
                style: TextStyle(color: WaveColors.muted, height: 1.4),
              ),
              const SizedBox(height: 28),
              GlassCard(
                borderColor: WaveColors.cyan.withOpacity(0.35),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => OrganizerLoginScreen(state: state),
                    ),
                  );
                },
                child: const _ModeTile(
                  icon: Icons.headphones,
                  title: 'Organizer',
                  body: 'Approve requests, drive the queue, skip tracks.',
                  accent: WaveColors.cyan,
                ),
              ),
              const SizedBox(height: 14),
              GlassCard(
                borderColor: WaveColors.amber.withOpacity(0.35),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => StaffLoginScreen(state: state),
                    ),
                  );
                },
                child: const _ModeTile(
                  icon: Icons.shield_outlined,
                  title: 'Staff ops',
                  body: 'Host requests, invites, suspend events, audit logs.',
                  accent: WaveColors.amber,
                ),
              ),
              const Spacer(),
              Text(
                'Venue audio stays on the admin laptop — this phone is remote control only.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: WaveColors.faint,
                  fontSize: 11,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeTile extends StatelessWidget {
  const _ModeTile({
    required this.icon,
    required this.title,
    required this.body,
    required this.accent,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: accent.withOpacity(0.15),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: accent),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                body,
                style: const TextStyle(color: WaveColors.muted, fontSize: 13),
              ),
            ],
          ),
        ),
        Icon(Icons.chevron_right_rounded, color: accent),
      ],
    );
  }
}
