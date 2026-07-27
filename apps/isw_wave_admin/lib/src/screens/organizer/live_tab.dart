import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class OrganizerLiveTab extends StatelessWidget {
  const OrganizerLiveTab({
    super.key,
    required this.state,
    required this.queue,
    required this.pendingCount,
    required this.onRefresh,
    required this.onAct,
    this.error,
  });

  final AppState state;
  final Map<String, dynamic>? queue;
  final int pendingCount;
  final String? error;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String id, String action) onAct;

  @override
  Widget build(BuildContext context) {
    final now = queue?['nowPlaying'] as Map<String, dynamic>?;
    final isFallback = queue?['nowPlayingIsFallback'] == true;
    final upNext = (queue?['queue'] as List<dynamic>? ?? const []);

    return SafeArea(
      child: RefreshIndicator(
        color: WaveColors.cyan,
        onRefresh: onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            GreetingHeader(
              name: state.orgUsername ?? 'organizer',
              subtitle: '/e/${state.eventSlug ?? '…'} · remote control',
              onRefresh: () => onRefresh(),
              onLogout: state.logout,
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error!, style: const TextStyle(color: WaveColors.rose)),
            ],
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(child: StatChip(label: 'Pending', value: '$pendingCount')),
                const SizedBox(width: 8),
                Expanded(child: StatChip(label: 'Up next', value: '${upNext.length}')),
              ],
            ),
            const SizedBox(height: 16),
            GlassCard(
              borderColor: WaveColors.cyan.withOpacity(0.3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionLabel('Now playing'),
                  const SizedBox(height: 14),
                  if (now == null)
                    const EmptyState('Nothing on stage')
                  else ...[
                    if ((now['thumbnailUrl'] as String?)?.isNotEmpty == true)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(18),
                        child: AspectRatio(
                          aspectRatio: 16 / 9,
                          child: Image.network(
                            now['thumbnailUrl'] as String,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: Colors.white10,
                              child: const Icon(Icons.music_note, size: 40),
                            ),
                          ),
                        ),
                      ),
                    if ((now['thumbnailUrl'] as String?)?.isNotEmpty == true)
                      const SizedBox(height: 14),
                    Text(
                      now['title'] as String? ?? '',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      isFallback
                          ? 'Fallback track'
                          : 'requested by ${now['requesterName'] ?? '—'}',
                      style: const TextStyle(color: WaveColors.muted),
                    ),
                    if (!isFallback && now['id'] != null) ...[
                      const SizedBox(height: 16),
                      PrimaryButton(
                        label: 'Next / mark played',
                        onPressed: () => onAct(now['id'] as String, 'next'),
                      ),
                    ],
                  ],
                ],
              ),
            ),
            if (upNext.isNotEmpty) ...[
              const SizedBox(height: 16),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionLabel('Coming up'),
                    const SizedBox(height: 8),
                    ...upNext.take(3).map((raw) {
                      final r = raw as Map<String, dynamic>;
                      return SongRow(
                        title: r['title'] as String? ?? '',
                        subtitle:
                            '${r['requesterName'] ?? ''} · ▲ ${r['voteCount'] ?? 0}',
                        thumbnailUrl: r['thumbnailUrl'] as String?,
                      );
                    }),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
