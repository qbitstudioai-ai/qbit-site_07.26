import { HomepageShell } from "@/components/homepage/HomepageShell";
import { getDepartmentIds } from "@/content/departments";
import type { DepartmentId } from "@/content/types";

interface HomePageProps {
  searchParams: Promise<{ department?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const requestedDepartment = params.department;
  const initialRevealed = Boolean(requestedDepartment);
  const initialDepartmentId: DepartmentId | null =
    requestedDepartment && getDepartmentIds().includes(requestedDepartment as DepartmentId)
      ? (requestedDepartment as DepartmentId)
      : null;

  return (
    <HomepageShell initialRevealed={initialRevealed} initialDepartmentId={initialDepartmentId} />
  );
}
