"""Connection state machine (§12, docs/rakuten_mt4.md):

    MT4 disconnected
      -> trading disabled
      -> user notification
      -> manual login (a human, never automated)
      -> connection verification
      -> trading enabled

This container cannot observe a real Rakuten MT4 connection
(docs/assumptions.md #1); this module implements the state machine and its
safety logic (``can_place_new_order()``) so a Windows-side bridge (EA log
tailing, MT4 Manager API, etc.) can drive it with real observed events. The
login step itself is never automated -- ``on_manual_login_requested`` only
records that the user has been asked to log in by hand.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from enum import Enum


class ConnectionState(str, Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    AWAITING_MANUAL_LOGIN = "AWAITING_MANUAL_LOGIN"
    VERIFYING = "VERIFYING"


@dataclass
class ConnectionMonitor:
    state: ConnectionState = ConnectionState.DISCONNECTED
    trading_enabled: bool = False
    history: list[dict] = field(default_factory=list)

    def _log(self, event: str) -> None:
        self.history.append(
            {"at": _dt.datetime.now(_dt.timezone.utc).isoformat(), "state": self.state.value, "event": event}
        )

    def on_disconnected(self) -> None:
        self.state = ConnectionState.DISCONNECTED
        self.trading_enabled = False
        self._log("MT4 disconnected: trading disabled, awaiting manual login")

    def on_manual_login_requested(self) -> None:
        self.state = ConnectionState.AWAITING_MANUAL_LOGIN
        self._log("User notified: manual login required (never automated, see docs/rakuten_mt4.md)")

    def on_connection_observed(self, *, quotes_updating: bool, trade_allowed: bool, market_open: bool) -> None:
        """Call after a manual login attempt, with observed terminal state."""

        self.state = ConnectionState.VERIFYING
        self._log(
            f"Connection observed: quotes_updating={quotes_updating} "
            f"trade_allowed={trade_allowed} market_open={market_open}"
        )
        if quotes_updating and trade_allowed and market_open:
            self.state = ConnectionState.CONNECTED
            self.trading_enabled = True
            self._log("Connection verified: trading enabled")
        else:
            self.state = ConnectionState.AWAITING_MANUAL_LOGIN
            self.trading_enabled = False
            self._log("Connection verification failed: trading remains disabled")

    def can_place_new_order(self) -> bool:
        return self.state == ConnectionState.CONNECTED and self.trading_enabled
