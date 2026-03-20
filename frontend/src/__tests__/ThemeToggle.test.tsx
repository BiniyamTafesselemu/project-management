import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../context/ThemeContext";
import { ThemeToggle } from "../components/ThemeToggle";

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("defaults to light and applies data-theme attribute", () => {
    renderToggle();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(
      screen.getByRole("button", { name: /switch to dark mode/i })
    ).toBeInTheDocument();
  });

  it("toggles to dark, updates DOM and persists to localStorage", async () => {
    renderToggle();

    await userEvent.click(
      screen.getByRole("button", { name: /switch to dark mode/i })
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: /switch to light mode/i })
    ).toBeInTheDocument();
  });

  it("restores persisted theme on mount", () => {
    localStorage.setItem("theme", "dark");
    renderToggle();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: /switch to light mode/i })
    ).toBeInTheDocument();
  });

  it("toggles back to light", async () => {
    localStorage.setItem("theme", "dark");
    renderToggle();

    await userEvent.click(
      screen.getByRole("button", { name: /switch to light mode/i })
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("renders without a ThemeProvider (safe fallback)", () => {
    // No provider wrapper — useTheme should fall back gracefully.
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /switch to dark mode/i })
    ).toBeInTheDocument();
  });
});
