import asyncio
import logging
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

class TaskCancellationManager:
    """
    Manages speculative tasks and ensures their results are discarded if canceled.
    Prevents 'Zombie Tasks' from polluting session state or causing race conditions.
    """
    def __init__(self):
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._completed_results: Dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def spawn_speculative(
        self, 
        task_id: str, 
        coro_factory: Callable[[], Any],
        confidence: float = 1.0
    ) -> Optional[asyncio.Task]:
        """
        Spawn a speculative task. If one with the same ID exists, cancel it.
        
        Args:
            task_id: Unique identifier for the intent (e.g., 'check_balance')
            coro_factory: A function that returns a coroutine to execute
            confidence: Intent confidence (0.0 to 1.0)
        """
        async with self._lock:
            # 1. Check if we should cancel an existing task for this intent
            if task_id in self._active_tasks:
                existing = self._active_tasks[task_id]
                if not existing.done():
                    existing.cancel()
                    logger.debug("TaskCancellationManager: Cancelled zombie task '%s'", task_id)
                del self._active_tasks[task_id]

            # 2. Confidence Gating (Phase 2)
            # > 85%: Full Execution
            # 50-85%: Pre-warm only (not implemented here, but can be targeted by coro_factory)
            # < 50%: Ignore
            if confidence < 0.5:
                return None

            # 3. Create and track the new task
            task = asyncio.create_task(self._execute_and_store(task_id, coro_factory()))
            self._active_tasks[task_id] = task
            return task

    async def _execute_and_store(self, task_id: str, coro):
        """Internal wrapper to handle completion and safe storage."""
        try:
            result = await coro
            async with self._lock:
                # Only store result if the task wasn't cancelled in the meantime
                # (asyncio.CancelledError would have been raised if still tracking)
                if task_id in self._active_tasks and self._active_tasks[task_id] == asyncio.current_task():
                    self._completed_results[task_id] = result
                    logger.debug("TaskCancellationManager: Speculative result stored for '%s'", task_id)
            return result
        except asyncio.CancelledError:
            # Task was explicitly cancelled — result is automatically discarded
            logger.debug("TaskCancellationManager: Task '%s' was cancelled (discarding result)", task_id)
            raise
        except Exception as e:
            logger.error("TaskCancellationManager: Error in task '%s': %s", task_id, e)
            return None
        finally:
            async with self._lock:
                if self._active_tasks.get(task_id) == asyncio.current_task():
                    del self._active_tasks[task_id]

    async def get_speculative_result(self, task_id: str) -> Optional[Any]:
        """Retrieve a completed result if available, otherwise return None."""
        async with self._lock:
            return self._completed_results.pop(task_id, None)

    def cancel_all(self):
        """Emergency kill for all active speculative tasks (e.g., on session end)."""
        for task_id, task in self._active_tasks.items():
            task.cancel()
        self._active_tasks.clear()
        self._completed_results.clear()
        logger.info("TaskCancellationManager: All speculative tasks cleared.")
