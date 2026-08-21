from src.mt4.compiler import compile_ea
from src.mt4.connection_monitor import ConnectionMonitor
from src.mt4.terminal import get_terminal_status


def test_compile_ea_missing_file_fails():
    result = compile_ea("/nonexistent/path/foo.mq4")
    assert result.status == "FAILED"


def test_compile_ea_not_available_in_this_container(tmp_path, monkeypatch):
    monkeypatch.delenv("METAEDITOR_PATH", raising=False)
    monkeypatch.setattr("shutil.which", lambda name: None)
    mq4 = tmp_path / "dummy.mq4"
    mq4.write_text("// dummy")
    result = compile_ea(str(mq4))
    assert result.status == "NOT_AVAILABLE"


def test_terminal_status_not_available_without_path(monkeypatch):
    monkeypatch.delenv("RAKUTEN_MT4_TERMINAL_PATH", raising=False)
    result = get_terminal_status()
    assert result.status == "NOT_AVAILABLE"


def test_terminal_status_not_available_for_missing_exe():
    result = get_terminal_status("/nonexistent/terminal.exe")
    assert result.status == "NOT_AVAILABLE"


def test_connection_monitor_full_recovery_cycle():
    mon = ConnectionMonitor()
    assert mon.can_place_new_order() is False

    mon.on_disconnected()
    assert mon.state.value == "DISCONNECTED"
    assert mon.can_place_new_order() is False

    mon.on_manual_login_requested()
    assert mon.state.value == "AWAITING_MANUAL_LOGIN"
    assert mon.can_place_new_order() is False

    mon.on_connection_observed(quotes_updating=True, trade_allowed=True, market_open=True)
    assert mon.state.value == "CONNECTED"
    assert mon.can_place_new_order() is True


def test_connection_monitor_verification_failure_keeps_trading_disabled():
    mon = ConnectionMonitor()
    mon.on_disconnected()
    mon.on_manual_login_requested()
    mon.on_connection_observed(quotes_updating=False, trade_allowed=True, market_open=True)
    assert mon.state.value == "AWAITING_MANUAL_LOGIN"
    assert mon.can_place_new_order() is False


def test_connection_monitor_logs_every_transition():
    mon = ConnectionMonitor()
    mon.on_disconnected()
    mon.on_manual_login_requested()
    mon.on_connection_observed(quotes_updating=True, trade_allowed=True, market_open=True)
    # disconnected, login-requested, "observed", and "verified" are each logged
    assert len(mon.history) == 4
