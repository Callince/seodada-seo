import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState } from "@/components/shared/states";

afterEach(cleanup); // RTL auto-cleanup needs vitest globals, which are off

describe("EmptyState", () => {
  it("renders title and hint", () => {
    render(<EmptyState title="Nothing here" hint="Run a search first." />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.getByText("Run a search first.")).toBeTruthy();
  });
});

describe("ErrorState", () => {
  it("renders the message and fires onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Server unreachable" onRetry={onRetry} />);
    expect(screen.getByText("Server unreachable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry button without a handler", () => {
    render(<ErrorState message="Oops" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
