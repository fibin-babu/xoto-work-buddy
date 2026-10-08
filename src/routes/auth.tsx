import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/LoginScreen";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Xoto Workday" },
      { name: "description", content: "Sign in with your Xoto company email." },
      { property: "og:title", content: "Sign in — Xoto Workday" },
      { property: "og:description", content: "Sign in with your Xoto company email." },
    ],
  }),
  component: LoginScreen,
});
