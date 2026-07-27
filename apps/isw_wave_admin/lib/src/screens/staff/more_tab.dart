import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class StaffMoreTab extends StatefulWidget {
  const StaffMoreTab({super.key, required this.state});
  final AppState state;

  @override
  State<StaffMoreTab> createState() => _StaffMoreTabState();
}

class _StaffMoreTabState extends State<StaffMoreTab> {
  List<dynamic> _logs = const [];
  bool _loadingLogs = false;
  String? _logError;

  Future<void> _loadLogs() async {
    setState(() {
      _loadingLogs = true;
      _logError = null;
    });
    try {
      final body = await widget.state.staffApi.logs();
      if (!mounted) return;
      setState(() {
        _logs = body['logs'] as List<dynamic>? ?? const [];
        _loadingLogs = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _logError = e.toString();
        _loadingLogs = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          Text(
            'More',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 16),
          GlassCard(
            borderColor: WaveColors.amber.withOpacity(0.3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionLabel('Account', color: WaveColors.amber),
                const SizedBox(height: 10),
                Text(
                  widget.state.staffUsername ?? '—',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  widget.state.staffEmail ?? '',
                  style: const TextStyle(color: WaveColors.muted),
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: WaveColors.amber.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    (widget.state.staffRole ?? 'staff').toUpperCase(),
                    style: const TextStyle(
                      color: WaveColors.amber,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(child: SectionLabel('Activity logs')),
                    TextButton(
                      onPressed: _loadingLogs ? null : _loadLogs,
                      child: Text(_loadingLogs ? 'Loading…' : 'Refresh'),
                    ),
                  ],
                ),
                if (_logError != null)
                  Text(_logError!, style: const TextStyle(color: WaveColors.rose)),
                if (_logs.isEmpty && !_loadingLogs)
                  const EmptyState('Tap refresh to load recent logs.')
                else
                  ..._logs.take(25).map((raw) {
                    final l = raw as Map<String, dynamic>;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l['type'] as String? ?? '',
                            style: const TextStyle(
                              color: WaveColors.cyan,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '${l['actorLabel'] ?? ''} · ${l['details'] ?? ''}',
                            style: const TextStyle(fontSize: 12),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Sign out',
            color: Colors.white12,
            foreground: Colors.white,
            onPressed: widget.state.logout,
          ),
        ],
      ),
    );
  }
}
