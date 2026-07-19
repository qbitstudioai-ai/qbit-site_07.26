import { HomepageShell } from "@/components/homepage/HomepageShell";
import { getDepartmentIds } from "@/content/departments";
import type { DepartmentId } from "@/content/types";
import { TASK_SECTION_ID, type OfficeSectionId } from "@/features/office-machine/reducer";

interface HomePageProps {
  searchParams: Promise<{ department?: string; section?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const requestedDepartment = params.department;
  const requestedSection = params.section;

  const departmentId: DepartmentId | null =
    requestedDepartment && getDepartmentIds().includes(requestedDepartment as DepartmentId)
      ? (requestedDepartment as DepartmentId)
      : null;

  // Приоритет у отдела: если в адресе оказались оба параметра, побеждает более специфичный, а не
  // тот, что стоит раньше в строке запроса. Иначе `?department=sales&section=task` открывал бы
  // разное в зависимости от того, как ссылку склеили.
  const initialSectionId: OfficeSectionId | null =
    departmentId ?? (requestedSection === TASK_SECTION_ID ? TASK_SECTION_ID : null);

  // hero пропускается при ЛЮБОМ запросе раздела — в том числе с невалидным id (поведение docs/05:
  // «URL с несуществующим id деградирует к overview, но hero всё равно пропускается»). Для
  // `?section=` тот же принцип: непонятное значение раздел не откроет, но намерение «показать офис»
  // уже выражено.
  const initialRevealed = Boolean(requestedDepartment) || Boolean(requestedSection);

  return <HomepageShell initialRevealed={initialRevealed} initialSectionId={initialSectionId} />;
}
