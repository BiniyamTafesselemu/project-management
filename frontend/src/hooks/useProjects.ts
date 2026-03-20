import { useState, useEffect, useRef, useCallback } from "react";
import { api, Project } from "../api/client";

let tempIdCounter = 0;

/**
 * Manages the list of projects with optimistic create/update/delete.
 *
 * Race-condition handling:
 *  - A per-item version map (`itemVersions`) ensures that when multiple
 *    mutations target the same project and their responses arrive out of
 *    order, only the latest mutation's response is applied. Earlier (stale)
 *    responses are discarded so they don't overwrite newer optimistic state.
 *  - A list-level version (`listVersion`) prevents a slow `load()` response
 *    from clobbering optimistic additions/removals that happened after the
 *    load request was issued.
 */
export function useProjects() {
  const [projects, setProjectsState] = useState<Project[]>([]);
  const [error, setError] = useState("");

  // Ref mirror of state so mutation handlers can synchronously read the
  // current list without depending on possibly-stale closure state.
  const projectsRef = useRef<Project[]>([]);
  const setProjects = (
    updater: Project[] | ((prev: Project[]) => Project[])
  ) => {
    const next =
      typeof updater === "function" ? updater(projectsRef.current) : updater;
    projectsRef.current = next;
    setProjectsState(next);
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
    const v = ++listVersion.current;
    try {
      const data = await api.getProjects();
      if (listVersion.current !== v) return;
      setProjects(data.projects);
    } catch (err: any) {
      if (listVersion.current !== v) return;
      setError(err.message || "Failed to load projects");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createProject = useCallback(
    async (input: { name: string; description?: string }) => {
      setError("");
      const tempId = `temp-${++tempIdCounter}`;
      const optimistic: Project = {
        _id: tempId,
        name: input.name,
        description: input.description ?? "",
        owner: "",
        createdAt: new Date().toISOString(),
      };

      // List membership is changing; invalidate any in-flight load.
      listVersion.current++;
      const version = bumpItem(tempId);

      setProjects((prev) => [...prev, optimistic]);

      try {
        const { project } = await api.createProject(input);
        // If the temp item was superseded (e.g., user deleted the pending
        // item), drop the response.
        if (!isCurrent(tempId, version)) return;
        // Migrate the version entry from tempId → real id so subsequent
        // mutations on the real id are tracked correctly.
        itemVersions.current.delete(tempId);
        itemVersions.current.set(project._id, version);
        setProjects((prev) =>
          prev.map((p) => (p._id === tempId ? project : p))
        );
      } catch (err: any) {
        // Rollback: remove the optimistic item.
        setProjects((prev) => prev.filter((p) => p._id !== tempId));
        itemVersions.current.delete(tempId);
        setError(err.message || "Failed to create project");
      }
    },
    []
  );

  const updateProject = useCallback(
    async (id: string, patch: { name?: string; description?: string }) => {
      setError("");

      const previous = projectsRef.current.find((p) => p._id === id);
      if (!previous) return;

      const version = bumpItem(id);

      setProjects((prev) =>
        prev.map((p) => (p._id === id ? { ...p, ...patch } : p))
      );

      try {
        const { project } = await api.updateProject(id, patch);
        // Drop stale responses — a newer update for this item is already
        // reflected in state.
        if (!isCurrent(id, version)) return;
        setProjects((prev) =>
          prev.map((p) => (p._id === id ? project : p))
        );
      } catch (err: any) {
        // Only roll back if this mutation is still the latest for this item;
        // otherwise a newer optimistic update has already superseded us and
        // rolling back would overwrite it.
        if (isCurrent(id, version)) {
          setProjects((prev) =>
            prev.map((p) => (p._id === id ? previous : p))
          );
        }
        setError(err.message || "Failed to update project");
      }
    },
    []
  );

  const deleteProject = useCallback(async (id: string) => {
    setError("");

    const previousIndex = projectsRef.current.findIndex((p) => p._id === id);
    const previous = projectsRef.current[previousIndex];
    if (!previous) return;

    listVersion.current++;
    const version = bumpItem(id);

    setProjects((prev) => prev.filter((p) => p._id !== id));

    try {
      await api.deleteProject(id);
      if (!isCurrent(id, version)) return;
      itemVersions.current.delete(id);
    } catch (err: any) {
      if (isCurrent(id, version)) {
        // Rollback: restore the item at its original position.
        setProjects((prev) => {
          if (prev.some((p) => p._id === id)) return prev;
          const next = [...prev];
          const insertAt =
            previousIndex >= 0 && previousIndex <= next.length
              ? previousIndex
              : next.length;
          next.splice(insertAt, 0, previous);
          return next;
        });
      }
      setError(err.message || "Failed to delete project");
    }
  }, []);

  return {
    projects,
    error,
    clearError: () => setError(""),
    createProject,
    updateProject,
    deleteProject,
    reload: load,
  };
}
