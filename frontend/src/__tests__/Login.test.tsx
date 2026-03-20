import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as AuthContext from "../context/AuthContext";
import Login from "../pages/Login";

vi.mock("../context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthContext>();
  return { ...actual, useAuth: vi.fn() };
});

function renderLogin(initialPath = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<Login />} />
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

describe("Login page", () => {
  it("renders email, password inputs and a submit button", () => {
    mockAuth();
    renderLogin();

    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("renders a link to the register page", () => {
    mockAuth();
    renderLogin();

    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute("href", "/register");
  });

  it("navigates to /projects on successful login", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockAuth({ login });
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("Email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText("Projects Page")).toBeInTheDocument();
    });
    expect(login).toHaveBeenCalledWith("alice@example.com", "secret123");
  });

  it("displays an error message when login fails", async () => {
    const login = vi.fn().mockRejectedValue({ message: "Invalid email or password" });
    mockAuth({ login });
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("Email"), "wrong@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "badpassword");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });

  it("clears any previous error before a new submission", async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce({ message: "Invalid email or password" })
      .mockResolvedValueOnce(undefined);
    mockAuth({ login });
    renderLogin();

    // First submission fails
    await userEvent.type(screen.getByPlaceholderText("Email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });

    // Second submission succeeds - error should be cleared
    await userEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
    });
  });
});
