import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class OrganizerPendingTab extends StatelessWidget {
  const OrganizerPendingTab({
    super.key,
    required this.pending,
    required this.onRefresh,
    required this.onAct,
  });

  final List<dynamic> pending;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String id, String action) onAct;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        color: WaveColors.cyan,
        onRefresh: onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            Text(
              'Pending',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '${pending.length} waiting for approval',
              style: const TextStyle(color: WaveColors.muted),
            ),
            const SizedBox(height: 16),
            if (pending.isEmpty)
              const GlassCard(child: EmptyState('Queue clear — nothing pending.'))
            else
              ...pending.map((raw) {
                final r = raw as Map<String, dynamic>;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SongRow(
                          title: r['title'] as String? ?? '',
                          subtitle: r['requesterName'] as String? ?? '',
                          thumbnailUrl: r['thumbnailUrl'] as String?,
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: PrimaryButton(
                                label: 'Approve',
                                color: WaveColors.emerald,
                                foreground: WaveColors.ink,
                                onPressed: () =>
                                    onAct(r['id'] as String, 'approve'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: PrimaryButton(
                                label: 'Reject',
                                color: WaveColors.rose,
                                foreground: Colors.white,
                                onPressed: () =>
                                    onAct(r['id'] as String, 'reject'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
