"use client";

import { useActionState, useState } from "react";
import { ArrowUpRight, CheckCircle } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { saveProfileAction, type ProfileActionState } from "@/app/actions/profile";
import { Button } from "@/components/ui/primitives";
import { BIO_MAX, type ProfileSettings as Settings } from "@/lib/profiles";
import type { Dictionary } from "@/lib/i18n";

const FIELD =
  "rounded-(--radius-md) border border-line bg-page px-3 py-2 text-sm leading-relaxed text-strong outline-none focus:border-line-focus";

/**
 * Ayarlar → Herkese Açık Profil. Form DENETİMLİ: React 19 form eylemi hata
 * döndürünce denetimsiz alanları sıfırlıyor (StoryEditor'daki ders).
 * Görünürlük anahtarları profil kapalıyken de işaretlenebilir — okuyucu
 * önce blokları seçip sonra tek anahtarla yayına açabilsin; kapalıyken
 * altta ne görüneceğini söyleyen bir satır durur.
 */
export function ProfileSettings({
  initial,
  username,
  labels,
}: {
  initial: Settings;
  username: string;
  labels: Dictionary["profile"]["settings"];
}) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    saveProfileAction,
    { status: "idle" },
  );
  const [bio, setBio] = useState(initial.bio ?? "");
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  /* SUNUCUNUN bildiği "açık" hâli — "Profilini Gör" yalnızca buna bakar.
     İlk kayıttan sonra status "saved"de KALIYOR; canlı checkbox'a bakmak,
     kaydedilmemiş bir işaretle 404 verecek adrese bağlantı basıyordu
     (15 Ekim incelemesi). Önceki-değer kalıbı ChangePassword'dekiyle aynı. */
  const [serverPublic, setServerPublic] = useState(initial.isPublic);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") setServerPublic(isPublic);
  }
  const [watchlists, setWatchlists] = useState(initial.showWatchlists);
  const [portfolio, setPortfolio] = useState(initial.showPortfolio);

  const toggle = (
    name: string,
    checked: boolean,
    onChange: (next: boolean) => void,
    label: string,
    hint?: string,
  ) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 sm:min-h-0">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-strong">{label}</span>
        {hint && <span className="text-small leading-relaxed text-muted">{hint}</span>}
      </span>
    </label>
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-small leading-relaxed text-body">{labels.hint}</p>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-small font-semibold text-body">{labels.bioLabel}</span>
          <span className="text-tiny text-muted" aria-hidden>
            {bio.length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          name="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value.slice(0, BIO_MAX))}
          maxLength={BIO_MAX}
          rows={3}
          placeholder={labels.bioPlaceholder}
          aria-describedby="profil-bio-sinir"
          className={FIELD}
        />
        {/* Gorsel sayac aria-hidden; sinirin okunur karsiligi bu satir. */}
        <span id="profil-bio-sinir" className="sr-only">
          {labels.bioLimit.replace("{n}", String(BIO_MAX))}
        </span>
      </label>

      <div className="flex flex-col gap-1 border-t border-line-soft pt-3">
        {toggle("public", isPublic, setIsPublic, labels.publicLabel, labels.publicHint)}
        {toggle("watchlists", watchlists, setWatchlists, labels.watchlistsLabel, labels.watchlistsHint)}
        {toggle("portfolio", portfolio, setPortfolio, labels.portfolioLabel, labels.portfolioHint)}
      </div>

      {!isPublic && <p className="text-small leading-relaxed text-muted">{labels.closedNote}</p>}

      {state.status === "failed" && (
        <p role="alert" className="text-small font-medium text-down">
          {labels.failed}
        </p>
      )}
      {state.status === "unavailable" && (
        <p role="alert" className="text-small font-medium text-down">
          {labels.unavailable}
        </p>
      )}
      <p
        role="status"
        className={
          state.status === "saved"
            ? "flex items-start gap-2 text-small leading-relaxed text-body"
            : "sr-only"
        }
      >
        {state.status === "saved" && (
          <>
            <CheckCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-up" aria-hidden />
            {labels.saved}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          aria-disabled={pending}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          className="aria-disabled:opacity-45"
        >
          {pending ? labels.saving : labels.submit}
        </Button>
        {serverPublic && (
          <Link
            href={`/u/${username}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-0"
          >
            {labels.view}
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        )}
      </div>
    </form>
  );
}
