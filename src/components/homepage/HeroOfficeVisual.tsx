import heroAvif960 from "@/assets/office-photos/hero-chaos-office-960.avif";
import heroAvif1536 from "@/assets/office-photos/hero-chaos-office-1536.avif";
import heroWebp960 from "@/assets/office-photos/hero-chaos-office-960.webp";
import heroWebp1536 from "@/assets/office-photos/hero-chaos-office-1536.webp";
import styles from "./HeroOfficeVisual.module.css";

function assetSrc(asset: { src: string } | string): string {
  return typeof asset === "string" ? asset : asset.src;
}

export function HeroOfficeVisual() {
  return (
    <figure className={styles.visual}>
      <picture className={styles.picture}>
        <source
          type="image/avif"
          srcSet={`${assetSrc(heroAvif960)} 960w, ${assetSrc(heroAvif1536)} 1536w`}
          sizes="(min-width: 1200px) 92vw, (min-width: 768px) 90vw, calc(100vw - 24px)"
        />
        <source
          type="image/webp"
          srcSet={`${assetSrc(heroWebp960)} 960w, ${assetSrc(heroWebp1536)} 1536w`}
          sizes="(min-width: 1200px) 92vw, (min-width: 768px) 90vw, calc(100vw - 24px)"
        />
        <img
          src={assetSrc(heroWebp1536)}
          alt="Офис: переход от ручного хаоса к организованным бизнес-процессам"
          className={styles.image}
          width={1536}
          height={1024}
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      <div className={styles.imageScrim} aria-hidden="true" />
    </figure>
  );
}
