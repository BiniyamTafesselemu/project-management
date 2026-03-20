import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { api } from "../api/client";
import type { Project } from "../api/client";
import { useProjects } from "../hooks/useProjects";

vi.mock("../api/client", () => ({
  api: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

const mk = (over: Partial<Project> = {}): Project => ({
  _id: "p1",
  name: "Alpha",
  description: "desc",
  owner: "u1",
  createdAt: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getProjects).mockResolvedValue({ projects: [] });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useProjects optimistic updates", () => {
  it("optimistically adds a project and reconciles with server result", async () => {
    const serverProject = mk({ _id: "real-1", name: "New" });
    const d = deferred<{ project: Project }>();
    vi.mocked(api.createProject).mockReturnValue(d.promise as any);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(api.getProjects).toHaveBeenCalled());

    act(() => {
      result.current.createProject({ name: "New", description: "" });
    });

    // Optimistic temp item appears immediately.
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0].name).toBe("New");
    expect(result.current.projects[0]._id).toMatch(/^temp-/);

    await act(async () => {
      d.resolve({ project: serverProject });
    });

    // Reconciled: temp id replaced with server id.
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0]._id).toBe("real-1");
  });

  it("rolls back create on failure and surfaces error", async () => {
    const d = deferred<{ project: Project }>();
    vi.mocked(api.createProject).mockReturnValue(d.promise as any);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(api.getProjects).toHaveBeenCalled());

    act(() => {
      result.current.createProject({ name: "Bad" });
    });
    expect(result.current.projects).toHaveLength(1);

    await act(async () => {
      d.reject({ message: "nope" });
    });

    expect(result.current.projects).toHaveLength(0);
    expect(result.current.error).toBe("nope");
  });

  it("discards stale update responses (race condition)", async () => {
    vi.mocked(api.getProjects).mockResolvedValue({ projects: [mk()] });

    const d1 = deferred<{ project: Project }>();
    const d2 = deferred<{ project: Project }>();
    vi.mocked(api.updateProject)
      .mockReturnValueOnce(d1.promise as any)
      .mockReturnValueOnce(d2.promise as any);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.projects).toHaveLength(1));

    // Fire two rapid updates to the same item.
    act(() => {
      result.current.updateProject("p1", { name: "First" });
    });
    act(() => {
      result.current.updateProject("p1", { name: "Second" });
    });

    // Optimistic state reflects the latest (Second).
    expect(result.current.projects[0].name).toBe("Second");

    // Resolve the SECOND request first (out of order) — it's current.
    await act(async () => {
      d2.resolve({ project: mk({ name: "Second" }) });
    });
    expect(result.current.projects[0].name).toBe("Second");

    // Now the FIRST (stale) response arrives late — it must be discarded.
    await act(async () => {
      d1.resolve({ project: mk({ name: "First" }) });
    });
    expect(result.current.projects[0].name).toBe("Second");
  });

  it("does not roll back a failed stale update over a newer one", async () => {
    vi.mocked(api.getProjects).mockResolvedValue({ projects: [mk()] });

    const d1 = deferred<{ project: Project }>();
    const d2 = deferred<{ project: Project }>();
    vi.mocked(api.updateProject)
      .mockReturnValueOnce(d1.promise as any)
      .mockReturnValueOnce(d2.promise as any);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.projects).toHaveLength(1));

    act(() => {
      result.current.updateProject("p1", { name: "First" });
    });
    act(() => {
      result.current.updateProject("p1", { name: "Second" });
    });

    // Stale update fails late — error is surfaced but state is NOT rolled
    // back, since a newer mutation superseded it.
    await act(async () => {
      d1.reject({ message: "stale fail" });
    });
    expect(result.current.projects[0].name).toBe("Second");
    expect(result.current.error).toBe("stale fail");

    await act(async () => {
      d2.resolve({ project: mk({ name: "Second" }) });
    });
    expect(result.current.projects[0].name).toBe("Second");
  });

  it("rolls back delete on failure, restoring original position", async () => {
    const a = mk({ _id: "a", name: "A" });
    const b = mk({ _id: "b", name: "B" });
    const c = mk({ _id: "c", name: "C" });
    vi.mocked(api.getProjects).mockResolvedValue({ projects: [a, b, c] });

    const d = deferred<{ message: string }>();
    vi.mocked(api.deleteProject).mockReturnValue(d.promise as any);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.projects).toHaveLength(3));

    act(() => {
      result.current.deleteProject("b");
    });
    // Optimistic removal.
    expect(result.current.projects.map((p) => p._id)).toEqual(["a", "c"]);

    await act(async () => {
      d.reject({ message: "forbidden" });
    });
    // Rollback puts B back in the middle.
    expect(result.current.projects.map((p) => p._id)).toEqual(["a", "b", "c"]);
    expect(result.current.error).toBe("forbidden");
  });

  it("stale load does not clobber optimistic mutations", async () => {
    const d = deferred<{ projects: Project[] }>();
    vi.mocked(api.getProjects).mockReturnValue(d.promise as any);
    vi.mocked(api.createProject).mockResolvedValue({
      project: mk({ _id: "new", name: "Fresh" }),
    });

    const { result } = renderHook(() => useProjects());

    // Before the initial load resolves, user creates a project.
    act(() => {
      result.current.createProject({ name: "Fresh" });
    });
    await waitFor(() =>
      expect(
        result.current.projects.some((p) => p._id === "new")
      ).toBe(true)
    );

    // Now the stale initial load resolves — it should be ignored.
    await act(async () => {
      d.resolve({ projects: [] });
    });

    expect(result.current.projects.map((p) => p._id)).toEqual(["new"]);
  });
});
