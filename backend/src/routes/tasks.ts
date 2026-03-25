import { Router, Response } from "express";
import { Task } from "../models/Task";
import { Project } from "../models/Project";
import { authenticate, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createTaskSchema, updateTaskSchema } from "../validators/task";

const router = Router();

router.use(authenticate);

// List tasks for a project
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { project } = req.query;
    if (!project) {
      res.status(400).json({ error: { message: "project query parameter is required" } });
      return;
    }

    // Verify project belongs to user
    const proj = await Project.findOne({ _id: project, owner: req.userId });
    if (!proj) {
      res.status(404).json({ error: { message: "Project not found" } });
      return;
    }

    const tasks = await Task.find({ project, owner: req.userId }).sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Create task
router.post("/", validate(createTaskSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Verify project belongs to user
    const proj = await Project.findOne({ _id: req.body.project, owner: req.userId });
    if (!proj) {
      res.status(404).json({ error: { message: "Project not found" } });
      return;
    }

    const task = await Task.create({ ...req.body, owner: req.userId });
    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Get single task
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.userId });
    if (!task) {
      res.status(404).json({ error: { message: "Task not found" } });
      return;
    }
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Update task
router.put("/:id", validate(updateTaskSchema), async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!task) {
      res.status(404).json({ error: { message: "Task not found" } });
      return;
    }
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Delete task
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!task) {
      res.status(404).json({ error: { message: "Task not found" } });
      return;
    }
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

export default router;
