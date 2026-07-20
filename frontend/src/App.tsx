import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { routes } from "@/router";

// Built here, not in router.tsx, because createBrowserRouter reads `document`
// at construction: importing the route tree under Node for the prerender step
// crashed on "document is not defined" before the render even started. App is
// only ever loaded by main.tsx in a browser, so this is the right home for it,
// and router.tsx stays a plain data module both environments can import.
const router = createBrowserRouter(routes);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
