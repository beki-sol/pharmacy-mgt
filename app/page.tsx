import { auth } from "@/app/lib/auth"; // adjust path to your NextAuth v5 config
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/auth/login");
  }
}