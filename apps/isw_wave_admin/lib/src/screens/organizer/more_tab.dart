import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class OrganizerMoreTab extends StatefulWidget {
  const OrganizerMoreTab({
    super.key,
    required this.state,
    required this.quota,
    required this.onRefresh,
  });

  final AppState state;
  final Map<String, dynamic>? quota;
  final Future<void> Function() onRefresh;

  @override
  State<OrganizerMoreTab> createState() => _OrganizerMoreTabState();
}

class _OrganizerMoreTabState extends State<OrganizerMoreTab> {
  final _cur = TextEditingController();
  final _next = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _cur.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _changePw() async {
    setState(() => _busy = true);
    try {
      await widget.state.api.changePassword(
        currentPassword: _cur.text,
        newPassword: _next.text,
      );
      _cur.clear();
      _next.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = widget.quota?['quota'] is Map
        ? widget.quota!['quota'] as Map<String, dynamic>
        : widget.quota;
    final used = q?['unitsUsed'] ?? q?['used'];
    final limit = q?['limit'] ?? 10000;
    final percent = q?['percentUsed'];
    final pct = percent is num
        ? percent.toDouble()
        : (used is num && limit is num && limit > 0)
            ? (used / limit) * 100
            : 0.0;

    return SafeArea(
      child: RefreshIndicator(
        color: WaveColors.cyan,
        onRefresh: widget.onRefresh,
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionLabel('Event'),
                  const SizedBox(height: 10),
                  Text(
                    widget.state.eventSlug ?? '—',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Signed in as ${widget.state.orgUsername ?? '—'}',
                    style: const TextStyle(color: WaveColors.muted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionLabel('YouTube quota (global)'),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: (pct / 100).clamp(0.0, 1.0),
                      minHeight: 8,
                      backgroundColor: Colors.white12,
                      color: pct > 85 ? WaveColors.rose : WaveColors.cyan,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    used != null
                        ? '$used / $limit units · ${pct.round()}%'
                        : 'Quota unavailable',
                    style: const TextStyle(color: WaveColors.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionLabel('Change password'),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _cur,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Current password',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _next,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'New password (min 8)',
                    ),
                  ),
                  const SizedBox(height: 14),
                  PrimaryButton(
                    label: 'Update password',
                    onPressed: _busy ? null : _changePw,
                    busy: _busy,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Sign out',
              color: Colors.white12,
              foreground: Colors.white,
              onPressed: widget.state.logout,
            ),
            const SizedBox(height: 16),
            const Text(
              'Audio plays only on the admin laptop. This app moderates the queue.',
              style: TextStyle(color: WaveColors.faint, fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
