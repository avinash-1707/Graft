import { redirect } from "next/navigation";

/** Entry point — the app group guard sorts authenticated vs. login from here. */
export default function RootPage() {
  redirect("/dashboard");
}
