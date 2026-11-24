"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { RefreshCw, UserRound } from "lucide-react";

import AccountMenu from "@/components/account-menu";
import CookShell, { cookAccountLinks } from "@/components/cook-shell";
import NotificationBell from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import {
  SUPPORTED_PICKUP_HUBS,
  type SupportedPickupHub,
} from "@/lib/validate-supported-hubs";

type CookProfile = {
  display_name: string;
  bio: string | null;
  is_available: boolean;
  supported_hubs: SupportedPickupHub[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isProfile(value: unknown): value is CookProfile {
  return (
    isRecord(value) &&
    typeof value.display_name === "string" &&
    (typeof value.bio === "string" || value.bio === null) &&
    typeof value.is_available === "boolean" &&
    Array.isArray(value.supported_hubs) &&
    value.supported_hubs.every((hub) =>
      SUPPORTED_PICKUP_HUBS.includes(hub as SupportedPickupHub),
    )
  );
}

async function fetchCookProfile(): Promise<CookProfile> {
  const response = await fetch("/api/cook/profile", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Unable to load your profile.",
    );
  }

  if (!isRecord(payload) || !isProfile(payload.profile)) {
    throw new Error("The cook profile response was invalid.");
  }

  return payload.profile;
}

function getInitials(name: string | null) {
  if (!name) return "C";
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "C";
}

/* Page-specific styles only. The hero, sidebar, bell circle and account
   pill all come from CookShell's own styles, so this page matches Orders. */
const CLAY = "var(--color-clay-500, #B4472B)";

const profileStyles = `
  /* Circle sized and placed like the Offerings banner (this banner is shorter
     than Orders, so the shell's larger circle filled most of it). Declared after
     the shell's styles, so it wins at every width. */
  .ck-hero-bg::after{width:340px;height:340px;right:-90px;top:-150px}
  .pf-back{display:inline-flex;align-items:center;min-height:44px;font-size:14px;font-weight:600;
    color:#2A211C;text-decoration:none}
  .pf-back:hover{color:${CLAY}}
  .pf-back:focus-visible{outline:2px solid ${CLAY};outline-offset:2px;border-radius:8px}
  .pf-lead{margin:12px 0 0;max-width:34rem;font-size:14px;line-height:1.6;color:rgba(42,33,28,.78)}
  .pf-rule{display:block;margin-top:12px;width:56px;height:4px;border-radius:4px;background:#E8A030}

  .pf-grid{display:grid;gap:18px;margin-top:20px;align-items:start}
  .pf-card{background:#fff;border-radius:26px;padding:20px 18px;box-shadow:0 10px 30px rgba(120,70,30,.08);
    min-width:0}
  .pf-head{display:flex;align-items:center;gap:14px}
  .pf-headicon{display:flex;align-items:center;justify-content:center;flex:none;width:48px;height:48px;
    border-radius:14px;background:#FBE9D6}
  .pf-lab{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:20px;
    font-size:14px;font-weight:600}
  .pf-lab small{font-size:12px;font-weight:400;color:rgba(42,33,28,.55)}
  .pf-in{display:block;box-sizing:border-box;width:100%;margin-top:8px;min-height:52px;padding:0 16px;
    border:1.5px solid rgba(42,33,28,.18);border-radius:16px;background:#fff;font:inherit;
    font-size:16px;color:#2A211C}
  textarea.pf-in{min-height:112px;padding:14px 16px;resize:vertical;line-height:1.5}
  .pf-in:focus{outline:none;border-color:${CLAY};box-shadow:0 0 0 3px rgba(180,71,43,.2)}
  .pf-in::placeholder{color:rgba(42,33,28,.45)}

  .pf-sec{margin-top:24px;padding-top:22px;border-top:1px solid rgba(42,33,28,.12)}
  .pf-switchrow{display:flex;align-items:flex-start;gap:16px;cursor:pointer}
  .pf-switch{appearance:none;-webkit-appearance:none;flex:none;position:relative;width:52px;height:30px;
    margin:2px 0 0;border-radius:999px;background:#C9BDB1;cursor:pointer;transition:background .15s}
  .pf-switch::after{content:"";position:absolute;left:4px;top:4px;width:22px;height:22px;
    border-radius:50%;background:#fff;transition:transform .15s}
  .pf-switch:checked{background:${CLAY}}
  .pf-switch:checked::after{transform:translateX(22px)}
  .pf-switch:focus-visible{outline:2px solid ${CLAY};outline-offset:3px}
  .pf-note{margin:12px 0 0;padding:12px 14px;border-radius:14px;background:#FDF4E9;font-size:13px;
    line-height:1.5;color:rgba(42,33,28,.8)}

  .pf-hubs{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:12px}
  .pf-hub{display:flex;align-items:center;gap:12px;min-height:54px;padding:0 16px;border-radius:16px;
    border:2px solid rgba(42,33,28,.15);background:#fff;font-size:15px;font-weight:600;cursor:pointer}
  .pf-hub.is-on{border-color:${CLAY};background:#FDF4E9}
  .pf-hub:focus-within{outline:2px solid ${CLAY};outline-offset:2px}
  .pf-check{appearance:none;-webkit-appearance:none;flex:none;position:relative;width:22px;height:22px;
    margin:0;border-radius:6px;border:2px solid #C9BDB1;background:#fff;cursor:pointer}
  .pf-check:checked{background:${CLAY};border-color:${CLAY}}
  .pf-check:checked::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;
    border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
  .pf-check:focus-visible{outline:none}

  .pf-save{display:inline-flex!important;align-items:center;justify-content:center;gap:10px;width:100%;
    min-height:56px!important;padding:0 34px!important;border-radius:999px!important;
    font-size:16px!important;font-weight:600!important}
  .pf-msg{margin:0 0 16px;padding:12px 16px;border-radius:14px;font-size:14px;line-height:1.5}
  .pf-ok{background:rgba(91,113,87,.12);border:1px solid rgba(91,113,87,.3);color:#3F5B3B}
  .pf-bad{background:#FEF2F2;border:1px solid rgba(185,28,28,.2);color:#991B1B}

  .pf-side{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;min-width:0}
  .pf-rc{background:#fff;border-radius:26px;padding:20px;box-shadow:0 10px 30px rgba(120,70,30,.08);
    min-width:0}
  .pf-avatar{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;
    border-radius:50%;background:#E8A030;color:#2A211C;font-size:15px;font-weight:700;line-height:1}
  .pf-prev{margin-top:12px;padding:16px;border-radius:18px;background:#FDF4E9}
  .pf-status{margin-top:12px;padding:12px 14px;border-radius:16px;background:#E3EDDF}
  .pf-status.is-off{background:#FBE9D6}
  .pf-dot{display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:#3F7D4B}
  .pf-status.is-off .pf-dot{background:#E8A030}
  .pf-chip{display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;
    background:#FBE9D6;font-size:12px;font-weight:600}
  .pf-link{display:inline-flex;align-items:center;min-height:44px;font-size:14px;font-weight:600;
    color:${CLAY};text-decoration:none}
  .pf-link:hover{text-decoration:underline}

  @media (min-width:640px){
    .pf-card{padding:28px}
    .pf-hubs{grid-template-columns:repeat(3,minmax(0,1fr))}
    .pf-save{width:auto;min-width:220px}
  }
  @media (min-width:1280px){
    .pf-grid{grid-template-columns:minmax(0,1fr) 340px;gap:24px}
    .pf-side{display:flex;flex-direction:column}
  }
`;

export default function CookProfilePage() {
  const [profile, setProfile] = useState<CookProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await fetchCookProfile());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchCookProfile()
      .then((loadedProfile) => {
        if (active) setProfile(loadedProfile);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your profile.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/cook/profile", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Unable to save your profile.",
        );
      }

      if (!isRecord(payload) || !isProfile(payload.profile)) {
        throw new Error("The saved profile response was invalid.");
      }

      setProfile(payload.profile);
      setSuccess("Your cook profile has been saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  const previewName = profile?.display_name.trim() || "Your name";
  const previewBio = profile?.bio?.trim() ?? "";

  return (
    <CookShell desktopActions={false}>
      <main className="min-h-screen bg-cream-50">
        <style>{profileStyles}</style>

        <div className="ck-wrap">
          {/* Hero: same structure as the Orders page */}
          <header className="ck-hero">
            <div className="ck-hero-bg" aria-hidden="true" />

            <div className="ck-hero-top">
              <Link href="/cook" className="pf-back">
                &larr; Back to requests
              </Link>
              <div className="ck-hero-actions">
                <NotificationBell />
                <AccountMenu links={cookAccountLinks} />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <p className="ck-eyebrow">Cook workspace</p>
              <h1 className="ck-h1 font-display text-ink-900">
                Your cook <span className="text-clay-500">profile.</span>
              </h1>
              <span aria-hidden="true" className="pf-rule" />
              <p className="pf-lead">
                Set the public name and introduction customers see beside your
                published meals, and control whether you receive new requests.
              </p>
            </div>
          </header>

          <div className="pf-grid">
            <div style={{ minWidth: 0 }}>
              {loading && (
                <p
                  className="mb-4 flex items-center gap-2 text-sm text-ink-900/60"
                  role="status"
                >
                  <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
                  Loading your profile...
                </p>
              )}

              {error && (
                <div className="pf-msg pf-bad" role="alert">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setError("");
                      void loadProfile();
                    }}
                    className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-red-700/20 bg-white px-3 font-semibold hover:bg-red-50"
                  >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Retry
                  </button>
                </div>
              )}

              {success && (
                <p className="pf-msg pf-ok" role="status">
                  {success}
                </p>
              )}

              {!loading && profile && (
                <form onSubmit={handleSave} className="pf-card">
                  <div className="pf-head">
                    <span className="pf-headicon">
                      <UserRound
                        aria-hidden="true"
                        className="size-6 text-clay-500"
                      />
                    </span>
                    <div>
                      <h2 className="font-display text-2xl text-ink-900">
                        Public details
                      </h2>
                      <p className="text-xs text-ink-900/60">
                        These details are shown only with published meals.
                      </p>
                    </div>
                  </div>

                  <label htmlFor="display-name" className="pf-lab">
                    <span>Display name</span>
                    <small>{profile.display_name.length} / 100</small>
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={profile.display_name}
                    onChange={(event) =>
                      setProfile((current) =>
                        current
                          ? { ...current, display_name: event.target.value }
                          : current,
                      )
                    }
                    minLength={2}
                    maxLength={100}
                    required
                    className="pf-in"
                  />

                  <label htmlFor="introduction" className="pf-lab">
                    <span>Introduction</span>
                    <small>{(profile.bio ?? "").length} / 500</small>
                  </label>
                  <textarea
                    id="introduction"
                    value={profile.bio ?? ""}
                    onChange={(event) =>
                      setProfile((current) =>
                        current ? { ...current, bio: event.target.value } : current,
                      )
                    }
                    maxLength={500}
                    rows={4}
                    className="pf-in"
                    placeholder="Share a little about the food you prepare."
                  />

                  <div className="pf-sec">
                    <label className="pf-switchrow">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={profile.is_available}
                        onChange={(event) =>
                          setProfile((current) =>
                            current
                              ? { ...current, is_available: event.target.checked }
                              : current,
                          )
                        }
                        className="pf-switch"
                      />
                      <span>
                        <span className="block text-base font-semibold text-ink-900">
                          Accept new meal requests
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-ink-900/65">
                          Let customers&apos; new requests reach your cook
                          workspace.
                        </span>
                      </span>
                    </label>
                    <p className="pf-note">
                      When paused, your published meals stay visible, but new
                      requests are not sent to your cook workspace.
                    </p>
                  </div>

                  <fieldset
                    className="pf-sec"
                    style={{ margin: "24px 0 0", borderLeft: 0, borderRight: 0, borderBottom: 0 }}
                  >
                    <legend
                      className="text-base font-semibold text-ink-900"
                      style={{ padding: 0 }}
                    >
                      Pickup hubs you serve
                    </legend>
                    <p className="mt-1 text-sm leading-5 text-ink-900/65">
                      You will only receive new requests for the hubs you
                      select. Choose at least one.
                    </p>
                    <div className="pf-hubs">
                      {SUPPORTED_PICKUP_HUBS.map((hub) => {
                        const checked = profile.supported_hubs.includes(hub);
                        return (
                          <label
                            key={hub}
                            className={`pf-hub${checked ? " is-on" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setProfile((current) => {
                                  if (!current) return current;
                                  const supported_hubs = checked
                                    ? current.supported_hubs.filter(
                                        (currentHub) => currentHub !== hub,
                                      )
                                    : [...current.supported_hubs, hub];
                                  return { ...current, supported_hubs };
                                })
                              }
                              className="pf-check"
                            />
                            {hub}
                          </label>
                        );
                      })}
                    </div>
                    {profile.supported_hubs.length === 0 && (
                      <p className="mt-3 text-sm text-clay-500" role="alert">
                        Select at least one pickup hub to save your profile.
                      </p>
                    )}
                  </fieldset>

                  <div style={{ marginTop: 28 }}>
                    <Button
                      type="submit"
                      disabled={saving || profile.supported_hubs.length === 0}
                      className="pf-save"
                    >
                      {saving ? "Saving..." : "Save profile"}
                      {!saving && <span aria-hidden="true">&rarr;</span>}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            <aside className="pf-side" aria-label="Profile preview and status">
              <section className="pf-rc" aria-labelledby="pf-preview-heading">
                <h2
                  id="pf-preview-heading"
                  className="font-display text-xl text-ink-900"
                >
                  How customers see you
                </h2>
                <p className="mt-1 text-xs text-ink-900/60">
                  A live preview of your public details.
                </p>
                <div className="pf-prev">
                  <div className="flex items-center gap-3">
                    <span className="pf-avatar" aria-hidden="true">
                      {getInitials(profile?.display_name ?? null)}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="font-display text-lg font-semibold text-ink-900"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {previewName}
                      </p>
                      <p className="text-xs text-ink-900/60">
                        Beside your published meals
                      </p>
                    </div>
                  </div>
                  <p
                    className="mt-3 text-sm leading-6"
                    style={{
                      overflowWrap: "anywhere",
                      color: previewBio
                        ? "rgba(42,33,28,.8)"
                        : "rgba(42,33,28,.55)",
                      fontStyle: previewBio ? "normal" : "italic",
                    }}
                  >
                    {previewBio || "Share a little about the food you prepare."}
                  </p>
                </div>
              </section>

              {profile && (
                <section className="pf-rc" aria-labelledby="pf-status-heading">
                  <h2
                    id="pf-status-heading"
                    className="font-display text-xl text-ink-900"
                  >
                    Kitchen status
                  </h2>
                  <div
                    className={`pf-status${profile.is_available ? "" : " is-off"}`}
                  >
                    <p className="flex items-center text-sm font-semibold text-ink-900">
                      <span className="pf-dot" aria-hidden="true" />
                      {profile.is_available
                        ? "Accepting requests"
                        : "New requests paused"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-900/70">
                      {profile.is_available
                        ? "Customers can receive your offers."
                        : "Your published meals stay visible."}
                    </p>
                  </div>
                  <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-ink-900/55">
                    Serving
                  </p>
                  <div>
                    {profile.supported_hubs.length > 0 ? (
                      profile.supported_hubs.map((hub) => (
                        <span key={hub} className="pf-chip">
                          {hub}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-ink-900/60">
                        No pickup hubs selected.
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-900/55">
                    Shows the settings above. Save your profile to apply them.
                  </p>
                </section>
              )}

              <section
                className="pf-rc"
                style={{ background: "#FBE9D6", boxShadow: "none" }}
              >
                <h2 className="font-display text-lg text-ink-900">Your meals</h2>
                <p className="mt-1.5 text-sm leading-5 text-ink-900/75">
                  Add or edit the meals customers see with this profile.
                </p>
                <Link href="/cook/menu" className="pf-link">
                  Manage menu &rarr;
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </CookShell>
  );
}