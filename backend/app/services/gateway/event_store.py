"""任务事件内存队列 — 供 SSE 端点消费。

每个任务维护一个事件环形缓冲区，任务完成后保留一段时间供客户端拉取。
"""
import asyncio
import logging
import time
from collections import defaultdict, deque
from typing import Optional

logger = logging.getLogger(__name__)

# 每个任务最多缓存的事件条数
_MAX_EVENTS_PER_TASK = 500
# 已完成任务的事件保留时间（秒）
_FINISHED_TTL = 300


class EventStore:
    """内存事件队列，支持多消费者订阅。"""

    def __init__(self):
        # task_id -> deque of event dicts
        self._events: dict[str, deque] = defaultdict(lambda: deque(maxlen=_MAX_EVENTS_PER_TASK))
        # task_id -> set of asyncio.Queue（SSE 消费者）
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # task_id -> 完成时间戳
        self._finished_at: dict[str, float] = {}

    def push(self, task_id: str, event: dict) -> None:
        """推送事件到队列，并通知所有订阅者。"""
        self._events[task_id].append(event)

        # 通知订阅者
        for q in self._subscribers.get(task_id, set()):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # 消费者太慢，跳过

        # done 事件标记任务完成
        if event.get("type") == "done":
            self._finished_at[task_id] = time.time()

    def subscribe(self, task_id: str) -> asyncio.Queue:
        """订阅任务事件流，返回队列供 SSE 消费。"""
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers[task_id].add(q)

        # 先把已有事件灌入队列
        for evt in self._events.get(task_id, deque()):
            try:
                q.put_nowait(evt)
            except asyncio.QueueFull:
                break

        return q

    def unsubscribe(self, task_id: str, q: asyncio.Queue) -> None:
        """取消订阅。"""
        subs = self._subscribers.get(task_id)
        if subs:
            subs.discard(q)

    def get_events(
        self, task_id: str, offset: int = 0, limit: int = 50
    ) -> tuple[list[dict], int]:
        """获取任务的分页事件列表。返回 (events_slice, total_count)。"""
        events = list(self._events.get(task_id, deque()))
        total = len(events)
        return events[offset:offset + limit], total

    def cleanup(self) -> None:
        """清理过期数据。"""
        now = time.time()
        expired = [
            tid for tid, ts in self._finished_at.items()
            if now - ts > _FINISHED_TTL
        ]
        for tid in expired:
            self._events.pop(tid, None)
            self._subscribers.pop(tid, None)
            del self._finished_at[tid]


# 模块级单例
event_store = EventStore()
