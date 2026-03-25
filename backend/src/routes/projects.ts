import { Router, Response } from "express";
import { Project } from "../models/Project";
import { Task } from "../models/Task";
import { authenticate, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createProjectSchema, updateProjectSchema } from "../validators/project";

const router = Router();

router.use(authenticate);

// List user's projects
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Create project
router.post("/", validate(createProjectSchema), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.create({ ...req.body, owner: req.userId });
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Get single project
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.userId });
    if (!project) {
      res.status(404).json({ error: { message: "Project not found" } });
      return;
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Update project
router.put("/:id", validate(updateProjectSchema), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!project) {
      res.status(404).json({ error: { message: "Project not found" } });
      return;
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Delete project and its tasks
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!project) {
      res.status(404).json({ error: { message: "Project not found" } });
      return;
    }
    await Task.deleteMany({ project: project._id });
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

export default router;
