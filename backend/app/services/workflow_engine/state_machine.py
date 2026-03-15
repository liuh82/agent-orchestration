"""Execution state machine for workflow engine."""
import logging
from enum import Enum
from typing import Callable, Dict, Optional, Set

logger = logging.getLogger(__name__)


class ExecutionState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    WAITING = "waiting"  # waiting for human input
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Valid state transitions
_TRANSITIONS: Dict[ExecutionState, Set[ExecutionState]] = {
    ExecutionState.PENDING: {ExecutionState.RUNNING, ExecutionState.CANCELLED},
    ExecutionState.RUNNING: {
        ExecutionState.PAUSED,
        ExecutionState.WAITING,
        ExecutionState.COMPLETED,
        ExecutionState.FAILED,
        ExecutionState.CANCELLED,
    },
    ExecutionState.PAUSED: {
        ExecutionState.RUNNING,
        ExecutionState.CANCELLED,
    },
    ExecutionState.WAITING: {
        ExecutionState.RUNNING,
        ExecutionState.PAUSED,
        ExecutionState.CANCELLED,
        ExecutionState.FAILED,
    },
    ExecutionState.COMPLETED: set(),
    ExecutionState.FAILED: set(),
    ExecutionState.CANCELLED: set(),
}


class StateMachine:
    """Manages workflow execution state transitions."""

    def __init__(self, initial_state: ExecutionState = ExecutionState.PENDING):
        self._state = initial_state
        self._history: list = []

    @property
    def state(self) -> ExecutionState:
        return self._state

    def transition(self, new_state: ExecutionState) -> bool:
        """Attempt a state transition. Returns True if successful."""
        allowed = _TRANSITIONS.get(self._state, set())
        if new_state not in allowed:
            logger.warning(
                "Invalid state transition: %s -> %s",
                self._state.value,
                new_state.value,
            )
            return False

        old_state = self._state
        self._state = new_state
        self._history.append((old_state, new_state))
        logger.debug("State transition: %s -> %s", old_state.value, new_state.value)
        return True

    def can_transition(self, new_state: ExecutionState) -> bool:
        """Check if a transition is valid without performing it."""
        return new_state in _TRANSITIONS.get(self._state, set())

    @property
    def is_terminal(self) -> bool:
        """Whether the current state is terminal (no further transitions)."""
        return len(_TRANSITIONS.get(self._state, set())) == 0

    @property
    def history(self) -> list:
        return list(self._history)

    def reset(self, initial_state: ExecutionState = ExecutionState.PENDING):
        """Reset to a given state."""
        self._state = initial_state
        self._history.clear()
