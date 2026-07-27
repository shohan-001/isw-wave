import 'dart:async';
import 'package:flutter/material.dart';
import 'package:isw_wave_admin/src/api/api_client.dart';
import 'package:isw_wave_admin/src/state/app_state.dart';
import 'package:isw_wave_admin/src/theme.dart';
import 'package:isw_wave_admin/src/screens/staff/dashboard_tab.dart';
import 'package:isw_wave_admin/src/screens/staff/requests_tab.dart';
import 'package:isw_wave_admin/src/screens/staff/events_tab.dart';
import 'package:isw_wave_admin/src/screens/staff/invites_tab.dart';
import 'package:isw_wave_admin/src/screens/staff/more_tab.dart';

class StaffShell extends StatefulWidget {
  const StaffShell({super.key, required this.state});
  final AppState state;

  @override
  State<StaffShell> createState() => _StaffShellState();
}

class _StaffShellState extends State<StaffShell> {
  int _tab = 0;
  Map<String, dynamic>? overview;
  String? error;
  Timer? _timer;
  bool _loading = false;

  int get pendingRequests {
    final stats = overview?['stats'] as Map<String, dynamic>?;
    return (stats?['pendingRequests'] as num?)?.toInt() ?? 0;
  }

  @override
  void initState() {
    super.initState();
    refresh();
    _timer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (_tab == 0 || _tab == 2) refresh();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> refresh() async {
    if (_loading) return;
    _loading = true;
    try {
      final body = await widget.state.staffApi.overview();
      if (!mounted) return;
      setState(() {
        overview = body;
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

  @override
  Widget build(BuildContext context) {
    final pages = [
      StaffDashboardTab(
        state: widget.state,
        overview: overview,
        error: error,
        onRefresh: refresh,
        onOpenRequests: () => setState(() => _tab = 1),
      ),
      StaffRequestsTab(state: widget.state, onChanged: refresh),
      StaffEventsTab(state: widget.state, overview: overview, onChanged: refresh),
      StaffInvitesTab(state: widget.state),
      StaffMoreTab(state: widget.state),
    ];

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        child: KeyedSubtree(key: ValueKey(_tab), child: pages[_tab]),
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
                icon: Icon(Icons.dashboard_rounded),
                label: 'Home',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: pendingRequests > 0,
                  label: Text('$pendingRequests'),
                  child: const Icon(Icons.mail_outline_rounded),
                ),
                label: 'Requests',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.event_rounded),
                label: 'Events',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.vpn_key_rounded),
                label: 'Invites',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.more_horiz_rounded),
                label: 'More',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
