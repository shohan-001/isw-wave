import 'dart:async';
import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/api/api_client.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/screens/organizer/live_tab.dart';
import 'package:isw_wave_admin/src/screens/organizer/pending_tab.dart';
import 'package:isw_wave_admin/src/screens/organizer/queue_tab.dart';
import 'package:isw_wave_admin/src/screens/organizer/more_tab.dart';

class OrganizerShell extends StatefulWidget {
  const OrganizerShell({super.key, required this.state});
  final AppState state;

  @override
  State<OrganizerShell> createState() => _OrganizerShellState();
}

class _OrganizerShellState extends State<OrganizerShell> {
  int _tab = 0;
  Map<String, dynamic>? queue;
  List<dynamic> pending = const [];
  Map<String, dynamic>? quota;
  String? error;
  Timer? _timer;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    refresh();
    _timer = Timer.periodic(const Duration(seconds: 6), (_) => refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> refresh() async {
    final eventId = widget.state.eventId;
    if (eventId == null || eventId.isEmpty) return;
    if (_loading) return;
    _loading = true;
    try {
      final q = await widget.state.api.queue(eventId: eventId);
      final p = await widget.state.api.pending();
      Map<String, dynamic>? quotaBody;
      try {
        quotaBody = await widget.state.api.quota();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        queue = q;
        pending = p;
        quota = quotaBody;
        error = null;
      });
    } catch (e) {
      if (e is UnauthorizedException) {
        widget.state.clearSessionOnUnauthorized();
        return;
      }
      if (!mounted) return;
      setState(() => error = e.toString());
    } finally {
      _loading = false;
    }
  }

  Future<void> act(String id, String action) async {
    try {
      await widget.state.api.patchRequest(id, action);
      await refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      OrganizerLiveTab(
        state: widget.state,
        queue: queue,
        pendingCount: pending.length,
        error: error,
        onRefresh: refresh,
        onAct: act,
      ),
      OrganizerPendingTab(
        pending: pending,
        onRefresh: refresh,
        onAct: act,
      ),
      OrganizerQueueTab(
        queue: queue,
        onRefresh: refresh,
        onAct: act,
      ),
      OrganizerMoreTab(
        state: widget.state,
        quota: quota,
        onRefresh: refresh,
      ),
    ];

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        child: KeyedSubtree(
          key: ValueKey(_tab),
          child: pages[_tab],
        ),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: WaveColors.surface,
          border: Border(top: BorderSide(color: Colors.white12)),
        ),
        child: SafeArea(
          child: BottomNavigationBar(
            currentIndex: _tab,
            onTap: (i) => setState(() => _tab = i),
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.graphic_eq_rounded),
                label: 'Live',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: pending.isNotEmpty,
                  label: Text('${pending.length}'),
                  child: const Icon(Icons.inbox_rounded),
                ),
                label: 'Pending',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.queue_music_rounded),
                label: 'Queue',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.tune_rounded),
                label: 'More',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
