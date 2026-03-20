import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as AuthContext from "../context/AuthContext";
import { api } from "../api/client";
import Projects from "../pages/Projects";
import type { Project } from "../api/client";

vi.mock("../context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthContext>();
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../api/client", () => ({
  api: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

const mockUser = { id: "user1", name: "Alice", email: "alice@example.com" };

const sampleProject: Project = {
  _id: "proj1",
  name: "Alpha Project",
  description: "First project",
  owner: "user1",
  createdAt: new Date().toISOString(),
};

function renderProjects() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>
  );
}

function mockAuth(overrides: Partial<ReturnType<typeof AuthContext.useAuth>> = {}) {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    user: mockUser,
    token: "tok",
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset drops any unconsumed mockResolvedValueOnce entries left over
  // from earlier tests (optimistic updates mean reloads no longer happen,
  // so those queued Once values would otherwise bleed into the next test).
  vi.mocked(api.getProjects).mockReset();
  vi.mocked(api.getProjects).mockResolvedValue({ projects: [] });
});

describe("Projects page", () => {
  it("shows a greeting with the user name", async () => {
    mockAuth();
    renderProjects();

    await waitFor(() => {
      expect(screen.getByText(/hi, alice/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no projects", async () => {
    mockAuth();
    vi.mocked(api.getProjects).mockResolvedValue({ projects: [] });
    renderProjects();

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });

  it("renders a list of projects returned by the API", async () => {
    mockAuth();
    vi.mocked(api.getProjects).mockResolvedValue({ projects: [sampleProject] });
    renderProjects();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
      expect(screen.getByText("First project")).toBeInTheDocument();
    });
  });

  it("creates a project and reloads the list", async () => {
    mockAuth();
    const newProject: Project = {
      ...sampleProject,
      _id: "proj2",
      name: "Beta Project",
      description: "",
    };
    vi.mocked(api.getProjects)
      .mockResolvedValueOnce({ projects: [] })
      .mockResolvedValueOnce({ projects: [newProject] });
    vi.mocked(api.createProject).mockResolvedValue({ project: newProject });

    renderProjects();

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText("Project name"), "Beta Project");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith({
        name: "Beta Project",
        description: "",
      });
      expect(screen.getByText("Beta Project")).toBeInTheDocument();
    });
  });

  it("shows an error message when creating a project fails", async () => {
    mockAuth();
    vi.mocked(api.createProject).mockRejectedValue({ message: "Validation failed" });

    renderProjects();
    await screen.findByRole("button", { name: /create project/i });

    await userEvent.type(screen.getByPlaceholderText("Project name"), "Bad");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(screen.getByText("Validation failed")).toBeInTheDocument();
    });
  });

  it("deletes a project after confirmation and reloads", async () => {
    mockAuth();
    vi.mocked(api.getProjects)
      .mockResolvedValueOnce({ projects: [sampleProject] })
      .mockResolvedValueOnce({ projects: [] });
    vi.mocked(api.deleteProject).mockResolvedValue({ message: "Project deleted" });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderProjects();

    const deleteBtn = await screen.findByRole("button", { name: /delete/i });
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(api.deleteProject).toHaveBeenCalledWith("proj1");
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });

  it("does not delete when confirmation is cancelled", async () => {
    mockAuth();
    vi.mocked(api.getProjects).mockResolvedValue({ projects: [sampleProject] });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderProjects();

    const deleteBtn = await screen.findByRole("button", { name: /delete/i });
    await userEvent.click(deleteBtn);

    expect(api.deleteProject).not.toHaveBeenCalled();
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
  });

  it("calls logout when the logout button is clicked", async () => {
    const logout = vi.fn();
    mockAuth({ logout });
    renderProjects();

    const logoutBtn = await screen.findByRole("button", { name: /logout/i });
    await userEvent.click(logoutBtn);

    expect(logout).toHaveBeenCalledOnce();
  });

  it("enters edit mode and saves updated project", async () => {
    mockAuth();
    const updatedProject: Project = { ...sampleProject, name: "Alpha Updated" };
    vi.mocked(api.getProjects)
      .mockResolvedValueOnce({ projects: [sampleProject] })
      .mockResolvedValueOnce({ projects: [updatedProject] });
    vi.mocked(api.updateProject).mockResolvedValue({ project: updatedProject });

    renderProjects();

    const editBtn = await screen.findByRole("button", { name: /edit/i });
    await userEvent.click(editBtn);

    const nameInput = screen.getByDisplayValue("Alpha Project");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Alpha Updated");

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(api.updateProject).toHaveBeenCalledWith("proj1", {
        name: "Alpha Updated",
        description: "First project",
      });
      expect(screen.getByText("Alpha Updated")).toBeInTheDocument();
    });
  });

  it("renders project as a link to its tasks page", async () => {
    mockAuth();
    vi.mocked(api.getProjects).mockResolvedValue({ projects: [sampleProject] });
    renderProjects();

    const link = await screen.findByRole("link", { name: "Alpha Project" });
    expect(link).toHaveAttribute("href", "/projects/proj1/tasks");
  });
});
