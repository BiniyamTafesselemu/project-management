import { useState, useEffect, useRef, useCallback } from "react";
import { api, Task } from "../api/client";

let tempIdCounter = 0;

/**
 * Manages the list of tasks for a project with optimistic
 * create/update/delete.
 *
 * Race-condition handling mirrors useProjects:
 *  - Per-item versioning discards out-of-order mutation responses.
 *  - A list-level version prevents stale `load()` responses from
 *    overwriting optimistic changes.
 */
export function useTasks(projectId: string | undefined) {
  const [tasks, setTasksState] = useState<Task[]>([]);
  const [error, setError] = useState("");

  const tasksRef = useRef<Task[]>([]);
  const setTasks = (updater: Task[] | ((prev: Task[]) => Task[])) => {
    const next =
      typeof updater === "function" ? updater(tasksRef.current) : updater;
    tasksRef.current = next;
    setTasksState(next);
  };

  const itemVersions = useRef(new Map<string, number>());
  const listVersion = useRef(0);

  const bumpItem = (id: string): number => {
    const next = (itemVersions.current.get(id) ?? 0) + 1;
    itemVersions.current.set(id, next);
    return next;
  };

  const isCurrent = (id: string, version: number): boolean =>
    (itemVersions.current.get(id) ?? 0) === version;

  const load = useCallback(async () => {
    if (!projectId) return;
    const v = ++listVersion.current;
    try {
      const data = await api.getTasks(projectId);
      if (listVersion.current !== v) return;
      setTasks(data.tasks);
    } catch (err: any) {
      if (listVersion.current !== v) return;
      setError(err.message || "Failed to load tasks");
    }
  }, [projectId]);

  useEffect(() => {
    // Reset state when switching projects.
    setTasks([]);
    itemVersions.current.clear();
    load();
  }, [load]);

  const createTask = useCallback(
    async (input: { title: string; description?: string }) => {
      if (!projectId) return;
      setError("");
      const tempId = `temp-${++tempIdCounter}`;
      const optimistic: Task = {
        _id: tempId,
        title: input.title,
        description: input.description ?? "",
        status: "todo",
        project: projectId,
        owner: "",
        createdAt: new Date().toISOString(),
      };

      listVersion.current++;
      const version = bumpItem(tempId);

      setTasks((prev) => [...prev, optimistic]);

      try {
        const { task } = await api.createTask({
          title: input.title,
          description: input.description,
          project: projectId,
        });
        if (!isCurrent(tempId, version)) return;
        itemVersions.current.delete(tempId);
        itemVersions.current.set(task._id, version);
        setTasks((prev) => prev.map((t) => (t._id === tempId ? task : t)));
      } catch (err: any) {
        setTasks((prev) => prev.filter((t) => t._id !== tempId));
        itemVersions.current.delete(tempId);
        setError(err.message || "Failed to create task");
      }
    },
    [projectId]
  );

  const updateTask = useCallback(
    async (
      id: string,
      patch: { title?: string; description?: string; status?: Task["status"] }
    ) => {
      setError("");

      const previous = tasksRef.current.find((t) => t._id === id);
      if (!previous) return;

      const version = bumpItem(id);

      setTasks((prev) =>
        prev.map((t) => (t._id === id ? { ...t, ...patch } : t))
      );

      try {
        const { task } = await api.updateTask(id, patch);
        if (!isCurrent(id, version)) return;
        setTasks((prev) => prev.map((t) => (t._id === id ? task : t)));
      } catch (err: any) {
        if (isCurrent(id, version)) {
          setTasks((prev) =>
            prev.map((t) => (t._id === id ? previous : t))
          );
        }
        setError(err.message || "Failed to update task");
      }
    },
    []
  );

  const deleteTask = useCallback(async (id: string) => {
    setError("");

    const previousIndex = tasksRef.current.findIndex((t) => t._id === id);
    const previous = tasksRef.current[previousIndex];
    if (!previous) return;

    listVersion.current++;
    const version = bumpItem(id);

    setTasks((prev) => prev.filter((t) => t._id !== id));

    try {
      await api.deleteTask(id);
      if (!isCurrent(id, version)) return;
      itemVersions.current.delete(id);
    } catch (err: any) {
      if (isCurrent(id, version)) {
        setTasks((prev) => {
          if (prev.some((t) => t._id === id)) return prev;
          const next = [...prev];
          const insertAt =
            previousIndex >= 0 && previousIndex <= next.length
              ? previousIndex
              : next.length;
          next.splice(insertAt, 0, previous);
          return next;
        });
      }
      setError(err.message || "Failed to delete task");
    }
  }, []);

  return {
    tasks,
    error,
    clearError: () => setError(""),
    createTask,
    updateTask,
    deleteTask,
    reload: load,
  };
}
