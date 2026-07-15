import { HomepageShell } from "@/components/homepage/HomepageShell";

interface HomePageProps {
  searchParams: Promise<{ department?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const initialRevealed = Boolean(params.department);

  return <HomepageShell initialRevealed={initialRevealed} />;
}
