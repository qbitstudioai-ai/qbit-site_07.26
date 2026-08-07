import { ContactForm } from "./ContactForm";
import type { ContactChannel, ContactsCopy } from "./contactData";
import styles from "./ContactsExperience.module.css";

/**
 * Страница контактов: переговорная комната как продолжение офисной сцены сайта.
 *
 * Серверный компонент. Весь текст — заголовки, эмоциональный подзаголовок, все четыре способа
 * связи — приходит в серверном HTML: фотография остаётся декорацией и ничего не сообщает ни
 * поисковым системам, ни скринридерам (`alt=""`, `aria-hidden`). Единственный клиентский код
 * раздела — `ContactForm`.
 *
 * Композиция повторяет геометрию фотографии (1672×941): верхний текстовый блок занимает левую
 * безопасную зону, рабочая панель стоит внизу над столом, а полоса между ними оставлена пустой —
 * там висит телевизор с логотипом, и перекрывать его нельзя. Поэтому раскладка — сетка
 * `auto / 1fr / auto`: свободное место всегда достаётся середине кадра, а не панели.
 */
export function ContactsExperience({
  channels,
  copy,
}: {
  /** Каналы связи из общего источника контактов — того же, что питает шапку сайта. */
  channels: ContactChannel[];
  copy: ContactsCopy;
}) {
  return (
    <main className={styles.stage}>
      <div className={styles.photo} aria-hidden="true">
        <picture>
          <source
            type="image/avif"
            srcSet="/contacts/contacts-meeting-room-720.avif 720w, /contacts/contacts-meeting-room-1080.avif 1080w, /contacts/contacts-meeting-room-1672.avif 1672w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/contacts/contacts-meeting-room-720.webp 720w, /contacts/contacts-meeting-room-1080.webp 1080w, /contacts/contacts-meeting-room-1672.webp 1672w"
            sizes="100vw"
          />
          {/* Ручной <picture>/srcSet — тот же подход, что в FaqExperience и ProductsExperience.
              Исходный PNG (2.2 МБ) в разметку не попадает: у него роль оригинала для генерации
              производных, а не фона страницы. */}
          <img
            src="/contacts/contacts-meeting-room-1672.webp"
            alt=""
            width={1672}
            height={941}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>

      <div className={styles.layout}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.heading}>{copy.heading}</h1>
          <p className={styles.subheading}>{copy.subheading}</p>
          <p className={styles.introText}>{copy.intro}</p>
        </div>

        <div className={styles.panel}>
          <section className={styles.contacts} aria-labelledby="contacts-direct-heading">
            <h2 className={styles.panelHeading} id="contacts-direct-heading">
              {copy.contactsHeading}
            </h2>

            {/* <address> — семантика контактов организации. Курсив по умолчанию снят в CSS. */}
            <address className={styles.address}>
              {channels.map((channel) => (
                <a
                  key={channel.id}
                  className={styles.channel}
                  href={channel.href}
                  aria-label={channel.accessibleLabel}
                  {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  <span className={styles.channelLabel}>{channel.label}</span>
                  <span className={styles.channelValue}>{channel.value}</span>
                </a>
              ))}
            </address>
          </section>

          <section className={styles.formSection} aria-labelledby="contacts-form-heading">
            <h2 className={styles.panelHeading} id="contacts-form-heading">
              {copy.formHeading}
            </h2>
            <p className={styles.formDescription}>{copy.formDescription}</p>
            <ContactForm channels={channels} page="/contacts" />
          </section>
        </div>
      </div>
    </main>
  );
}
