import 'dart:async';
import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/api_client.dart';
import 'package:isw_wave_admin/src/app_state.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.state});
  final AppState state;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _queue;
  List<dynamic> _pending = const [];
  String? _error;
  Timer? _timer;

  final _curPw = TextEditingController();
  final _newPw = TextEditingController();

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 6), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _curPw.dispose();
    _newPw.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final eventId = widget.state.eventId;
    if (eventId == null || eventId.isEmpty) return;
    try {
      final q = await widget.state.api.queue(eventId: eventId);
      final p = await widget.state.api.pending();
      if (!mounted) return;
      setState(() {
        _queue = q;
        _pending = p;
        _error = null;
      });
    } catch (e) {
      if (e is UnauthorizedException) {
        await widget.state.logout();
        return;
      }
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _act(String id, String action) async {
    try {
      await widget.state.api.patchRequest(id, action);
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _changePassword() async {
    try {
      await widget.state.api.changePassword(
        currentPassword: _curPw.text,
        newPassword: _newPw.text,
      );
      _curPw.clear();
      _newPw.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = _queue?['nowPlaying'] as Map<String, dynamic>?;
    final isFallback = _queue?['nowPlayingIsFallback'] == true;
    final queue = (_queue?['queue'] as List<dynamic>? ?? const []);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.state.eventSlug ?? 'Control room'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: widget.state.logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
              ),
            _Card(
              title: 'Now playing',
              child: now == null
                  ? const Text('Nothing on stage', style: TextStyle(color: Colors.white54))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          now['title'] as String? ?? '',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isFallback
                              ? 'Fallback'
                              : 'requested by ${now['requesterName'] ?? '—'}',
                          style: const TextStyle(color: Colors.white54),
                        ),
                        if (!isFallback && now['id'] != null) ...[
                          const SizedBox(height: 12),
                          FilledButton.tonal(
                            onPressed: () => _act(now['id'] as String, 'next'),
                            child: const Text('Next / mark played'),
                          ),
                        ],
                      ],
                    ),
            ),
            const SizedBox(height: 12),
            _Card(
              title: 'Pending (${_pending.length})',
              child: _pending.isEmpty
                  ? const Text('Queue clear', style: TextStyle(color: Colors.white54))
                  : Column(
                      children: _pending.map((raw) {
                        final r = raw as Map<String, dynamic>;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(r['title'] as String? ?? ''),
                          subtitle: Text(r['requesterName'] as String? ?? ''),
                          trailing: Wrap(
                            spacing: 8,
                            children: [
                              IconButton(
                                tooltip: 'Approve',
                                onPressed: () => _act(r['id'] as String, 'approve'),
                                icon: const Icon(Icons.check_circle_outline),
                              ),
                              IconButton(
                                tooltip: 'Reject',
                                onPressed: () => _act(r['id'] as String, 'reject'),
                                icon: const Icon(Icons.cancel_outlined),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
            ),
            const SizedBox(height: 12),
            _Card(
              title: 'Up next (${queue.length})',
              child: queue.isEmpty
                  ? const Text('Empty', style: TextStyle(color: Colors.white54))
                  : Column(
                      children: queue.take(8).map((raw) {
                        final r = raw as Map<String, dynamic>;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(r['title'] as String? ?? ''),
                          subtitle: Text(
                            '${r['requesterName'] ?? ''} · ▲ ${r['voteCount'] ?? 0}',
                          ),
                          trailing: IconButton(
                            tooltip: 'Play now',
                            onPressed: () => _act(r['id'] as String, 'play'),
                            icon: const Icon(Icons.play_arrow),
                          ),
                        );
                      }).toList(),
                    ),
            ),
            const SizedBox(height: 12),
            _Card(
              title: 'Change password',
              child: Column(
                children: [
                  TextField(
                    controller: _curPw,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Current password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _newPw,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'New password (min 8)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FilledButton(
                      onPressed: _changePassword,
                      child: const Text('Update password'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF12141C),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF22D3EE),
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
