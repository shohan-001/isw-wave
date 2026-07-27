import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/widgets/glass.dart';

class StaffInvitesTab extends StatefulWidget {
  const StaffInvitesTab({super.key, required this.state});
  final AppState state;

  @override
  State<StaffInvitesTab> createState() => _StaffInvitesTabState();
}

class _StaffInvitesTabState extends State<StaffInvitesTab> {
  List<dynamic> _codes = const [];
  String? _signupUrl;
  bool _envFallback = false;
  bool _loading = true;
  String? _error;
  String? _freshCode;

  bool get _isOwner => widget.state.staffRole == 'owner';

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
      final body = await widget.state.staffApi.inviteCodes();
      if (!mounted) return;
      setState(() {
        _codes = body['codes'] as List<dynamic>? ?? const [];
        _signupUrl = body['signupUrl'] as String?;
        _envFallback = body['envFallbackActive'] == true;
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

  Future<void> _create() async {
    final label = TextEditingController();
    final maxUses = TextEditingController(text: '1');
    final eventLimit = TextEditingController(text: '3');
    final expires = TextEditingController(text: '30');

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
                'Create invite code',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: label,
                decoration: const InputDecoration(
                  labelText: 'Label (who is this for?)',
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: maxUses,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Max uses'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: eventLimit,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Event limit'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: expires,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Expires in days'),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'Create',
                onPressed: () => Navigator.pop(ctx, true),
              ),
            ],
          ),
        );
      },
    );
    if (ok != true || label.text.trim().isEmpty) return;

    try {
      final res = await widget.state.staffApi.createInvite({
        'label': label.text.trim(),
        'maxUses': int.tryParse(maxUses.text) ?? 1,
        'eventLimit': int.tryParse(eventLimit.text) ?? 3,
        'expiresInDays': int.tryParse(expires.text) ?? 30,
      });
      final code = (res['code'] as Map?)?['code'] as String?;
      setState(() => _freshCode = code);
      if (code != null) {
        await Clipboard.setData(ClipboardData(text: code));
      }
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invite created — code copied')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        color: WaveColors.cyan,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Invites',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                if (_isOwner)
                  IconButton.filled(
                    onPressed: _create,
                    icon: const Icon(Icons.add_rounded),
                    style: IconButton.styleFrom(
                      backgroundColor: WaveColors.cyan,
                      foregroundColor: WaveColors.ink,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Fast path for trusted organizers',
              style: TextStyle(color: WaveColors.muted),
            ),
            if (!_isOwner) ...[
              const SizedBox(height: 12),
              const GlassCard(
                child: Text(
                  'Moderators can view codes. Only the owner can create or revoke.',
                  style: TextStyle(color: WaveColors.muted, fontSize: 13),
                ),
              ),
            ],
            if (_envFallback) ...[
              const SizedBox(height: 12),
              GlassCard(
                borderColor: WaveColors.amber.withOpacity(0.35),
                child: const Text(
                  'Legacy ORGANIZER_INVITE_CODE env codes still work but are not listed here.',
                  style: TextStyle(color: WaveColors.amber, fontSize: 12),
                ),
              ),
            ],
            if (_freshCode != null) ...[
              const SizedBox(height: 12),
              GlassCard(
                borderColor: WaveColors.cyan.withOpacity(0.4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionLabel('New code'),
                    const SizedBox(height: 8),
                    SelectableText(
                      _freshCode!,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),
                    PrimaryButton(
                      label: 'Copy again',
                      onPressed: () async {
                        await Clipboard.setData(
                          ClipboardData(text: _freshCode!),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: WaveColors.rose)),
            ],
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_codes.isEmpty)
              const GlassCard(child: EmptyState('No invite codes yet.'))
            else
              ..._codes.map((raw) {
                final c = raw as Map<String, dynamic>;
                final status = c['status'] as String? ?? 'active';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                c['label'] as String? ?? '(no label)',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: status == 'active'
                                    ? WaveColors.emerald
                                    : WaveColors.muted,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        SelectableText(
                          c['code'] as String? ?? '',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Uses ${c['usedCount']}/${(c['maxUses'] as num?)?.toInt() == 0 ? '∞' : c['maxUses']} · '
                          'events ${(c['eventLimit'] as num?)?.toInt() == 0 ? '∞' : c['eventLimit']}',
                          style: const TextStyle(
                            color: WaveColors.muted,
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          children: [
                            TextButton(
                              onPressed: () async {
                                final code = c['code'] as String? ?? '';
                                final text = _signupUrl != null
                                    ? '$_signupUrl\nInvite code: $code'
                                    : code;
                                await Clipboard.setData(ClipboardData(text: text));
                                if (!mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Copied')),
                                );
                              },
                              child: const Text('Copy'),
                            ),
                            if (_isOwner && status == 'active')
                              TextButton(
                                onPressed: () async {
                                  await widget.state.staffApi
                                      .patchInvite(c['id'] as String, 'revoke');
                                  await _load();
                                },
                                child: const Text(
                                  'Revoke',
                                  style: TextStyle(color: WaveColors.rose),
                                ),
                              ),
                            if (_isOwner && status == 'revoked')
                              TextButton(
                                onPressed: () async {
                                  await widget.state.staffApi
                                      .patchInvite(c['id'] as String, 'restore');
                                  await _load();
                                },
                                child: const Text(
                                  'Restore',
                                  style: TextStyle(color: WaveColors.emerald),
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
