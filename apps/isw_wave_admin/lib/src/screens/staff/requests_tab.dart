import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class StaffRequestsTab extends StatefulWidget {
  const StaffRequestsTab({
    super.key,
    required this.state,
    required this.onChanged,
  });

  final AppState state;
  final Future<void> Function() onChanged;

  @override
  State<StaffRequestsTab> createState() => _StaffRequestsTabState();
}

class _StaffRequestsTabState extends State<StaffRequestsTab> {
  String _status = 'pending';
  List<dynamic> _rows = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final body = await widget.state.staffApi.eventRequests(status: _status);
      if (!mounted) return;
      setState(() {
        _rows = body['requests'] as List<dynamic>? ?? const [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _approve(Map<String, dynamic> row) async {
    final nameCtrl = TextEditingController(text: row['eventName'] as String? ?? '');
    final slugCtrl =
        TextEditingController(text: row['suggestedSlug'] as String? ?? '');
    final limitCtrl = TextEditingController(text: '3');
    final noteCtrl = TextEditingController();

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: WaveColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            20 + MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Approve request',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Event name'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: slugCtrl,
                decoration: const InputDecoration(labelText: 'URL slug'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: limitCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Event limit'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: noteCtrl,
                decoration: const InputDecoration(labelText: 'Note (optional)'),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'Approve',
                color: WaveColors.emerald,
                onPressed: () => Navigator.pop(ctx, true),
              ),
            ],
          ),
        );
      },
    );

    if (ok != true) return;
    try {
      final res = await widget.state.staffApi.reviewRequest(
        row['id'] as String,
        {
          'action': 'approve',
          'eventName': nameCtrl.text.trim(),
          'slug': slugCtrl.text.trim(),
          'eventLimit': int.tryParse(limitCtrl.text) ?? 3,
          'note': noteCtrl.text.trim(),
        },
      );
      final org = res['organizer'] as Map<String, dynamic>?;
      if (org != null && mounted) {
        final handover = [
          'Username: ${org['username']}',
          'Setup: ${org['setupUrl']}',
          'Event: ${org['eventUrl']}',
          'Access code: ${org['accessCode']}',
        ].join('\n');
        await Clipboard.setData(ClipboardData(text: handover));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Approved — handover copied')),
        );
      }
      await _load();
      await widget.onChanged();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _reject(Map<String, dynamic> row) async {
    final noteCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: WaveColors.surface,
        title: const Text('Reject request?'),
        content: TextField(
          controller: noteCtrl,
          decoration: const InputDecoration(labelText: 'Note'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reject', style: TextStyle(color: WaveColors.rose)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await widget.state.staffApi.reviewRequest(row['id'] as String, {
        'action': 'reject',
        'note': noteCtrl.text.trim(),
      });
      await _load();
      await widget.onChanged();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Host requests',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 10),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'pending', label: Text('Pending')),
                    ButtonSegment(value: 'approved', label: Text('Approved')),
                    ButtonSegment(value: 'rejected', label: Text('Rejected')),
                  ],
                  selected: {_status},
                  onSelectionChanged: (s) {
                    setState(() => _status = s.first);
                    _load();
                  },
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(_error!, style: const TextStyle(color: WaveColors.rose)),
            ),
          Expanded(
            child: RefreshIndicator(
              color: WaveColors.cyan,
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      itemCount: _rows.isEmpty ? 1 : _rows.length,
                      itemBuilder: (context, i) {
                        if (_rows.isEmpty) {
                          return const GlassCard(
                            child: EmptyState('No requests in this filter.'),
                          );
                        }
                        final r = _rows[i] as Map<String, dynamic>;
                        final pending = r['status'] == 'pending';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: GlassCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  r['eventName'] as String? ?? 'Event',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 17,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${r['contactName'] ?? ''} · ${r['contactEmail'] ?? ''}',
                                  style: const TextStyle(
                                    color: WaveColors.muted,
                                    fontSize: 12,
                                  ),
                                ),
                                if ((r['eventDetails'] as String?)?.isNotEmpty ==
                                    true) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    r['eventDetails'] as String,
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ],
                                if (pending) ...[
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: PrimaryButton(
                                          label: 'Approve',
                                          color: WaveColors.emerald,
                                          onPressed: () => _approve(r),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: PrimaryButton(
                                          label: 'Reject',
                                          color: WaveColors.rose,
                                          foreground: Colors.white,
                                          onPressed: () => _reject(r),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
