import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class OrganizerQueueTab extends StatelessWidget {
  const OrganizerQueueTab({
    super.key,
    required this.queue,
    required this.onRefresh,
    required this.onAct,
  });

  final Map<String, dynamic>? queue;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String id, String action) onAct;

  @override
  Widget build(BuildContext context) {
    final items = (queue?['queue'] as List<dynamic>? ?? const []);

    return SafeArea(
      child: RefreshIndicator(
        color: WaveColors.cyan,
        onRefresh: onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            Text(
              'Up next',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '${items.length} in the live queue',
              style: const TextStyle(color: WaveColors.muted),
            ),
            const SizedBox(height: 16),
            if (items.isEmpty)
              const GlassCard(child: EmptyState('Queue is empty.'))
            else
              ...items.map((raw) {
                final r = raw as Map<String, dynamic>;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: GlassCard(
                    child: Column(
                      children: [
                        SongRow(
                          title: r['title'] as String? ?? '',
                          subtitle:
                              '${r['requesterName'] ?? ''} · ▲ ${r['voteCount'] ?? 0}',
                          thumbnailUrl: r['thumbnailUrl'] as String?,
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: PrimaryButton(
                                label: 'Play now',
                                onPressed: () =>
                                    onAct(r['id'] as String, 'play'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            IconButton.filledTonal(
                              onPressed: () =>
                                  onAct(r['id'] as String, 'remove'),
                              icon: const Icon(Icons.delete_outline_rounded),
                              style: IconButton.styleFrom(
                                foregroundColor: WaveColors.rose,
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
