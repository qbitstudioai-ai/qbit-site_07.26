import type { Department, DepartmentId, OfficeZone } from "@/content/types";
import { DepartmentHotspot } from "./DepartmentHotspot";
import { officeSceneById, OFFICE_SCENE_SIZES } from "./departmentPhotos";
import { OfficeScenePhoto } from "./OfficePhoto";
import styles from "./OfficeSemanticMap.module.css";

interface OfficeSemanticMapProps {
  departments: Department[];
  officeZones: OfficeZone[];
  onSelectDepartment: (departmentId: DepartmentId) => void;
}

export function OfficeSemanticMap({
  departments,
  officeZones,
  onSelectDepartment,
}: OfficeSemanticMapProps) {
  const zones = officeZones.slice().sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <nav aria-label="Отделы компании" className={styles.map}>
      {/* Step 12 (OQ-A2-1 = (a)): overview — настоящая мастер-сцена офиса, отделы поверх неё как
          зоны, а не карточки на токен-фоне. Сцена и список зон — соседи внутри .scene, а не
          вложенные друг в друга: <ul> по HTML может содержать только <li>, поэтому фото нельзя
          положить внутрь .zoneList. Фото декоративно и не влияет на работоспособность overview —
          при отказе загрузки OfficeScenePhoto подставляет нейтральный плейсхолдер, а пять кнопок
          остаются на месте (fallback-контракт Step 8). */}
      {/* Забронированные места под будущий текст слева и справа от сцены (запрос пользователя
          2026-07-18, см. WORKPLAN.md Amendment 9). Сейчас они пустые и НИЧЕГО не рисуют: видимая
          заглушка с рамкой читалась бы как недоделанный интерфейс. Они занимают поля, которые и так
          пустуют — кадр сцены ограничен по высоте, а не по ширине, поэтому колонки забирают
          свободную ширину и сцену не сжимают. На ширинах < 1280px колонки схлопываются (см.
          .module.css): там они отняли бы у сцены место, которого нет. */}
      <div className={styles.asideSlot} data-overview-slot="left" />
      <div className={styles.scene}>
        <OfficeScenePhoto
          sources={officeSceneById.overview}
          sizes={OFFICE_SCENE_SIZES}
          className={styles.scenePhoto}
        />
        <ul id="office-map" className={styles.zoneList}>
          {zones.map((zone) => {
            const department = departments.find((d) => d.id === zone.departmentId);
            if (!department) {
              throw new Error(
                `OfficeSemanticMap: no department found for zone.departmentId="${zone.departmentId}"`,
              );
            }
            return (
              <li key={zone.departmentId} className={styles.zoneItem}>
                <DepartmentHotspot
                  zone={zone}
                  department={department}
                  onSelect={onSelectDepartment}
                />
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.asideSlot} data-overview-slot="right" />
    </nav>
  );
}
