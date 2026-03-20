import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as AuthContext from "../context/AuthContext";
import Register from "../pages/Register";

vi.mock("../context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthContext>();
  return { ...actual, useAuth: vi.fn() };
});

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/projects" element={<div>Projects Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockAuth(overrides: Partial<ReturnType<typeof AuthContext.useAuth>> = {}) {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    user: null,
    token: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Register page", () => {
  it("renders name, email, password inputs and a submit button", () => {
    mockAuth();
    renderRegister();

    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register/i })).toBeInTheDocument();
  });

  it("renders a link to the login page", () => {
    mockAuth();
    renderRegister();

    expect(screen.getByRole("link", { name: /login/i })).toHaveAttribute("href", "/login");
  });

  it("calls register with form values and navigates to /projects on success", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    mockAuth({ register });
    renderRegister();

    await userEvent.type(screen.getByPlaceholderText("Name"), "Alice");
    await userEvent.type(screen.getByPlaceholderText("Email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText("Projects Page")).toBeInTheDocument();
    });
    expect(register).toHaveBeenCalledWith("Alice", "alice@example.com", "secret123");
  });

  it("shows an error when registration fails", async () => {
    const register = vi.fn().mockRejectedValue({ message: "Email already registered" });
    mockAuth({ register });
    renderRegister();

    await userEvent.type(screen.getByPlaceholderText("Name"), "Alice");
    await userEvent.type(screen.getByPlaceholderText("Email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText("Email already registered")).toBeInTheDocument();
    });
  });
});
