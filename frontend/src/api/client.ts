const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw data.error || { message: "Request failed" };
  }
  return data;
}

export const api = {
  // Auth
  register: (body: { name: string; email: string; password: string }) =>
    request<{ token: string; user: { id: string; name: string; email: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; name: string; email: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMe: () =>
    request<{ user: { id: string; name: string; email: string } }>("/auth/me"),

  // Projects
  getProjects: () =>
    request<{ projects: Project[] }>("/projects"),
  createProject: (body: { name: string; description?: string }) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProject: (id: string, body: { name?: string; description?: string }) =>
    request<{ project: Project }>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteProject: (id: string) =>
    request<{ message: string }>(`/projects/${id}`, { method: "DELETE" }),

  // Tasks
  getTasks: (projectId: string) =>
    request<{ tasks: Task[] }>(`/tasks?project=${projectId}`),
  createTask: (body: { title: string; description?: string; status?: string; project: string }) =>
    request<{ task: Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTask: (id: string, body: { title?: string; description?: string; status?: string }) =>
    request<{ task: Task }>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteTask: (id: string) =>
    request<{ message: string }>(`/tasks/${id}`, { method: "DELETE" }),
};

export interface Project {
  _id: string;
  name: string;
  description: string;
  owner: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  project: string;
  owner: string;
  createdAt: string;
}
