import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Project } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { sanitize } from "../utils/sanitize";
import { useProjects } from "../hooks/useProjects";
import { ThemeToggle } from "../components/ThemeToggle";

export default function Projects() {
  const { logout, user } = useAuth();
  const { projects, error, createProject, updateProject, deleteProject } =
    useProjects();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    createProject({ name, description });
    setName("");
    setDescription("");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this project and all its tasks?")) return;
    deleteProject(id);
  };

  const startEdit = (p: Project) => {
    setEditingId(p._id);
    setEditName(p.name);
    setEditDesc(p.description);
  };

  const handleUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    updateProject(editingId, { name: editName, description: editDesc });
    setEditingId(null);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Projects</h1>
        <div className="header-right">
          <span>Hi, {user?.name}</span>
          <button onClick={logout} className="btn-secondary">Logout</button>
          <ThemeToggle />
        </div>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleCreate} className="create-form">
        <input
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Create Project</button>
      </form>

      <div className="list">
        {projects.length === 0 && <p className="empty">No projects yet. Create one above.</p>}
        {projects.map((p) => (
          <div key={p._id} className="card">
            {editingId === p._id ? (
              <form onSubmit={handleUpdate} className="edit-form">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                <div className="card-actions">
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="card-body">
                  <Link to={`/projects/${p._id}/tasks`} className="card-title">{sanitize(p.name)}</Link>
                  {p.description && <p className="card-desc">{sanitize(p.description)}</p>}
                </div>
                <div className="card-actions">
                  <button onClick={() => startEdit(p)} className="btn-secondary">Edit</button>
                  <button onClick={() => handleDelete(p._id)} className="btn-danger">Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
