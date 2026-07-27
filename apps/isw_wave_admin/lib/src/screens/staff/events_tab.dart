import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class StaffEventsTab extends StatefulWidget {
  const StaffEventsTab({
    super.key,
    required this.state,
    required this.overview,
    required this.onChanged,
  });

  final AppState state;
  final Map<String, dynamic>? overview;
  final Future<void> Function() onChanged;

  @override
  State<StaffEventsTab> createState() => _StaffEventsTabState();
}

class _StaffEventsTabState extends State<StaffEventsTab> {
  String? _selectedId;

  List<dynamic> get _events =>
      widget.overview?['events'] as List<dynamic>? ?? const [];

  Future<void> _openDetail(Map<String, dynamic> ev) async {
    setState(() => _selectedId = ev['id'] as String?);
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _EventDetailPage(
          state: widget.state,
          eventSummary: ev,
          onChanged: widget.onChanged,
        ),
      ),
    );
    setState(() => _selectedId = null);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        color: WaveColors.cyan,
        onRefresh: widget.onChanged,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            Text(
              'Events',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '${_events.length} total · tap for safety controls',
              style: const TextStyle(color: WaveColors.muted),
            ),
            const SizedBox(height: 16),
            if (_events.isEmpty)
              const GlassCard(child: EmptyState('No events yet.'))
            else
              ..._events.map((raw) {
                final ev = raw as Map<String, dynamic>;
                final suspended = ev['suspended'] == true;
                final selected = ev['id'] == _selectedId;
                final used = (ev['youtubeUnitsUsedToday'] as num?)?.toInt() ?? 0;
                final cap = (ev['youtubeDailyQuotaCap'] as num?)?.toInt() ?? 0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: GlassCard(
                    borderColor: selected
                        ? WaveColors.cyan.withOpacity(0.4)
                        : suspended
                            ? WaveColors.rose.withOpacity(0.35)
                            : null,
                    onTap: () => _openDetail(ev),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                ev['name'] as String? ?? '',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 17,
                                ),
                              ),
                            ),
                            if (suspended)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: WaveColors.rose.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'SUSPENDED',
                                  style: TextStyle(
                                    color: WaveColors.rose,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '/e/${ev['slug']} · ${ev['admin'] is Map ? (ev['admin'] as Map)['username'] : ''}',
                          style: const TextStyle(
                            color: WaveColors.muted,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            StatChip(
                              label: 'Guests',
                              value: '${ev['activeGuestCount'] ?? 0}',
                            ),
                            StatChip(
                              label: 'Pending',
                              value: '${ev['pendingCount'] ?? 0}',
                            ),
                            StatChip(
                              label: 'YT',
                              value: cap > 0 ? '$used/$cap' : '$used',
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

class _EventDetailPage extends StatefulWidget {
  const _EventDetailPage({
    required this.state,
    required this.eventSummary,
    required this.onChanged,
  });

  final AppState state;
  final Map<String, dynamic> eventSummary;
  final Future<void> Function() onChanged;

  @override
  State<_EventDetailPage> createState() => _EventDetailPageState();
}

class _EventDetailPageState extends State<_EventDetailPage> {
  Map<String, dynamic>? _detail;
  List<dynamic> _participants = const [];
  bool _busy = false;
  final _reason = TextEditingController();
  final _cap = TextEditingController();

  String get _id => widget.eventSummary['id'] as String;

  @override
  void initState() {
    super.initState();
    _reason.text = widget.eventSummary['suspendReason'] as String? ?? '';
    _cap.text = '${widget.eventSummary['youtubeDailyQuotaCap'] ?? 0}';
    _load();
  }

  @override
  void dispose() {
    _reason.dispose();
    _cap.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final body = await widget.state.staffApi.eventDetail(_id);
      if (!mounted) return;
      final event = body['event'] as Map<String, dynamic>?;
      setState(() {
        _detail = event;
        _participants = body['participants'] as List<dynamic>? ?? const [];
        if (event != null) {
          _reason.text = event['suspendReason'] as String? ?? '';
          _cap.text = '${event['youtubeDailyQuotaCap'] ?? 0}';
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _patch(Map<String, dynamic> body, String ok) async {
    setState(() => _busy = true);
    try {
      await widget.state.staffApi.patchEvent(_id, body);
      await _load();
      await widget.onChanged();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final suspended = _detail?['suspended'] == true ||
        widget.eventSummary['suspended'] == true;
    final name = _detail?['name'] ?? widget.eventSummary['name'] ?? 'Event';
    final used = widget.eventSummary['youtubeUnitsUsedToday'] ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text('$name')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SectionLabel('Safety'),
                const SizedBox(height: 10),
                TextField(
                  controller: _reason,
                  decoration: const InputDecoration(
                    labelText: 'Suspend reason (optional)',
                  ),
                ),
                const SizedBox(height: 12),
                PrimaryButton(
                  label: suspended ? 'Unsuspend event' : 'Suspend event',
                  color: suspended ? WaveColors.emerald : WaveColors.rose,
                  foreground: suspended ? WaveColors.ink : Colors.white,
                  busy: _busy,
                  onPressed: () => _patch(
                    suspended
                        ? {'action': 'unsuspend'}
                        : {
                            'action': 'suspend',
                            'reason': _reason.text.trim(),
                          },
                    suspended ? 'Unsuspended' : 'Suspended',
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
                const SectionLabel('YouTube daily cap'),
                const SizedBox(height: 8),
                Text(
                  'Today used: $used units (≈101 per uncached search)',
                  style: const TextStyle(color: WaveColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _cap,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Cap (0 = unlimited)',
                  ),
                ),
                const SizedBox(height: 10),
                PrimaryButton(
                  label: 'Save cap',
                  busy: _busy,
                  onPressed: () => _patch(
                    {
                      'action': 'quota_cap',
                      'youtubeDailyQuotaCap': int.tryParse(_cap.text) ?? 0,
                    },
                    'Cap updated',
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: [0, 505, 1010, 2020].map((n) {
                    return ActionChip(
                      label: Text(n == 0 ? 'Unlimited' : '~${n ~/ 101}'),
                      onPressed: _busy
                          ? null
                          : () {
                              _cap.text = '$n';
                              _patch(
                                {
                                  'action': 'quota_cap',
                                  'youtubeDailyQuotaCap': n,
                                },
                                'Cap set',
                              );
                            },
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionLabel('Guests (${_participants.length})'),
                const SizedBox(height: 8),
                if (_participants.isEmpty)
                  const EmptyState('No guests yet.')
                else
                  ..._participants.map((raw) {
                    final p = raw as Map<String, dynamic>;
                    final banned = p['banned'] == true;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(p['displayName'] as String? ?? ''),
                      subtitle: Text(
                        '${p['requestCount'] ?? 0} req · ${p['voteCount'] ?? 0} votes',
                        style: const TextStyle(fontSize: 11),
                      ),
                      trailing: TextButton(
                        onPressed: _busy
                            ? null
                            : () async {
                                setState(() => _busy = true);
                                try {
                                  await widget.state.staffApi.ban(
                                    participantId: p['id'] as String,
                                    banned: !banned,
                                    reason: banned
                                        ? ''
                                        : 'Banned from mobile ops',
                                  );
                                  await _load();
                                  await widget.onChanged();
                                } catch (e) {
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('$e')),
                                  );
                                } finally {
                                  if (mounted) setState(() => _busy = false);
                                }
                              },
                        child: Text(
                          banned ? 'Unban' : 'Ban',
                          style: TextStyle(
                            color: banned ? WaveColors.muted : WaveColors.rose,
                          ),
                        ),
                      ),
                    );
                  }),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
