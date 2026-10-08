import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/LoginScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Xoto Workday — Sign in" },
      { name: "description", content: "Sign in to Xoto Workday to clock in and log your daily tasks." },
      { property: "og:title", content: "Xoto Workday — Sign in" },
      { property: "og:description", content: "Daily time and task tracking for the Xoto Proptech team." },
    ],
  }),
  component: LoginScreen,
});
