import { Router, Response } from "express";
import { User } from "../models/User";
import { signToken, authenticate, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { authLimiter } from "../middleware/rateLimiter";
import { registerSchema, loginSchema } from "../validators/auth";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), async (req, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: { message: "Email already registered" } });
      return;
    }

    const user = await User.create({ name, email, password });
    const token = signToken(String(user._id));

    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: { message: "Invalid email or password" } });
      return;
    }

    const token = signToken(String(user._id));

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

export default router;
