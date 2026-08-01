import { LoginForm } from "@/features/auth/components/login-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : undefined;

  return <LoginForm nextPath={nextPath} />;
}
