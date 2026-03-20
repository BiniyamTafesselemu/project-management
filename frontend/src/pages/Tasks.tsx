import { useState, useEffect, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { api, Task, Project } from "../api/client";
import { sanitize } from "../utils/sanitize";
import { useTasks } from "../hooks/useTasks";
import { ThemeToggle } from "../components/ThemeToggle";

export default function Tasks() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const { tasks, error, createTask, updateTask, deleteTask } =
    useTasks(projectId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<Task["status"]>("todo");

  // Project metadata (header title) — not part of optimistic flow.
  useEffect(() => {
    if (!projectId) return;
    api
      .getProjects()
      .then((d) => {
        const p = d.projects.find((p) => p._id === projectId);
        if (p) setProject(p);
      })
      .catch(() => {});
  }, [projectId]);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    createTask({ title, description });
    setTitle("");
    setDescription("");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this task?")) return;
    deleteTask(id);
  };

  const handleStatusChange = (id: string, status: Task["status"]) => {
    updateTask(id, { status });
  };

  const startEdit = (t: Task) => {
    setEditingId(t._id);
    setEditTitle(t.title);
    setEditDesc(t.description);
    setEditStatus(t.status);
  };

  const handleUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    updateTask(editingId, {
      title: editTitle,
      description: editDesc,
      status: editStatus,
    });
    setEditingId(null);
  };

  const statusClass = (s: string) =>
    s === "done" ? "status-done" : s === "in_progress" ? "status-progress" : "status-todo";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/projects" className="back-link">&larr; Projects</Link>
          <h1>{project ? sanitize(project.name) : "Tasks"}</h1>
        </div>
        <div className="header-right">
          <ThemeToggle />
        </div>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleCreate} className="create-form">
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Add Task</button>
      </form>

      <div className="list">
        {tasks.length === 0 && <p className="empty">No tasks yet. Add one above.</p>}
        {tasks.map((t) => (
          <div key={t._id} className="card">
            {editingId === t._id ? (
              <form onSubmit={handleUpdate} className="edit-form">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as Task["status"])}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <div className="card-actions">
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="card-body">
                  <div className="task-header">
                    <span className="card-title">{sanitize(t.title)}</span>
                    <select
                      className={`status-badge ${statusClass(t.status)}`}
                      value={t.status}
                      onChange={(e) => handleStatusChange(t._id, e.target.value as Task["status"])}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  {t.description && <p className="card-desc">{sanitize(t.description)}</p>}
                </div>
                <div className="card-actions">
                  <button onClick={() => startEdit(t)} className="btn-secondary">Edit</button>
                  <button onClick={() => handleDelete(t._id)} className="btn-danger">Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
