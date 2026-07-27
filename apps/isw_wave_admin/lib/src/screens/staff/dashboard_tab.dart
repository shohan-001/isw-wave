import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class StaffDashboardTab extends StatelessWidget {
  const StaffDashboardTab({
    super.key,
    required this.state,
    required this.overview,
    required this.onRefresh,
    required this.onOpenRequests,
    this.error,
  });

  final AppState state;
  final Map<String, dynamic>? overview;
  final String? error;
  final Future<void> Function() onRefresh;
  final VoidCallback onOpenRequests;

  @override
  Widget build(BuildContext context) {
    final stats = overview?['stats'] as Map<String, dynamic>? ?? {};
    final pending = (stats['pendingRequests'] as num?)?.toInt() ?? 0;
    final live = (stats['liveNow'] as num?)?.toInt() ?? 0;
    final guests = (stats['guestsToday'] as num?)?.toInt() ?? 0;
    final events = (stats['totalEvents'] as num?)?.toInt() ?? 0;
    final quotaPct = (stats['quotaPercentUsed'] as num?)?.toDouble() ?? 0;

    return SafeArea(
      child: RefreshIndicator(
        color: WaveColors.cyan,
        onRefresh: onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            GreetingHeader(
              name: state.staffUsername ?? 'staff',
              subtitle: '${state.staffRole ?? 'staff'} · ops console',
              onRefresh: () => onRefresh(),
              onLogout: state.logout,
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error!, style: const TextStyle(color: WaveColors.rose)),
            ],
            const SizedBox(height: 18),
            if (pending > 0)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: GlassCard(
                  borderColor: WaveColors.amber.withOpacity(0.4),
                  onTap: onOpenRequests,
                  child: Row(
                    children: [
                      const Icon(Icons.mark_email_unread_rounded,
                          color: WaveColors.amber),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '$pending host request${pending == 1 ? '' : 's'} waiting',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: WaveColors.amber),
                    ],
                  ),
                ),
              ),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.35,
              children: [
                _StatCard('Live now', '$live', WaveColors.cyan),
                _StatCard('Events', '$events', Colors.white70),
                _StatCard('Guests today', '$guests', WaveColors.emerald),
                _StatCard('YT quota', '${quotaPct.round()}%', WaveColors.amber),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.label, this.value, this.accent);
  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: accent,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
