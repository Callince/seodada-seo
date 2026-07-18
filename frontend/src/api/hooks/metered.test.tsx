import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useMeteredMutation } from "@/api/hooks/metered";

vi.mock("@/api/client", () => ({
  api: { post: vi.fn(async (path: string) => ({ data: { echo: path } })) },
}));

describe("useMeteredMutation", () => {
  it("posts to the path and invalidates the usage summary", async () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMeteredMutation<{ q: string }, { echo: string }>("/serp/ranking"), { wrapper });
    const data = await result.current.mutateAsync({ q: "pizza" });

    expect(data).toEqual({ echo: "/serp/ranking" });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["usage", "summary"] }),
    );
  });
});
