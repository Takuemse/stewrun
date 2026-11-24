"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";

import CookMenuFrame from "@/components/cook-menu-frame";
import OfferingImage from "@/components/cook-meal-image";

type Offering = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  available: boolean;
};

type OfferingDraft = Omit<Offering, "id">;

const EMPTY_DRAFT: OfferingDraft = {
  name: "",
  description: "",
  price: 0,
  available: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isOffering(value: unknown): value is Offering {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    (typeof value.price === "number" || typeof value.price === "string") &&
    typeof value.available === "boolean"
  );
}

function normalizeDraft(draft: OfferingDraft): OfferingDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    description:
      typeof draft.description === "string"
        ? draft.description.trim() || null
        : null,
    price: Number(draft.price),
  };
}

function formatPrice(price: number | string) {
  return `$${Number(price).toFixed(2)}`;
}

async function fetchOfferings(): Promise<Offering[]> {
  const response = await fetch("/api/cook/menu?manage=1", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Unable to load your offerings.",
    );
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.menu) ||
    !payload.menu.every(isOffering)
  ) {
    throw new Error("The offerings response was invalid.");
  }

  return payload.menu;
}

export default function CookMenuPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [draft, setDraft] = useState<OfferingDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadOfferings = useCallback(async () => {
    try {
      setOfferings(await fetchOfferings());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your offerings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchOfferings()
      .then((loadedOfferings) => {
        if (active) setOfferings(loadedOfferings);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your offerings.",
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

  async function sendOffering(
    method: "POST" | "PATCH",
    body: unknown,
  ): Promise<Offering> {
    const response = await fetch("/api/cook/menu", {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : "Unable to save this offering.",
      );
    }

    if (!isRecord(payload) || !isOffering(payload.item)) {
      throw new Error("The saved offering response was invalid.");
    }

    return payload.item;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const item = await sendOffering("POST", normalizeDraft(draft));
      setOfferings((current) =>
        [...current, item].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setDraft(EMPTY_DRAFT);
      setSuccess(
        item.available
          ? "Offering created and published."
          : "Offering saved as a draft.",
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to save this offering.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(offering: Offering) {
    setSavingId(offering.id);
    setError("");
    setSuccess("");

    try {
      const updated = await sendOffering("PATCH", {
        id: offering.id,
        ...normalizeDraft(offering),
      });
      setOfferings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditingId(null);
      setSuccess(
        updated.available
          ? "Offering updated and published."
          : "Offering updated and unpublished.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update this offering.",
      );
    } finally {
      setSavingId(null);
    }
  }

  function updateOffering(id: string, updates: Partial<Offering>) {
    setOfferings((current) =>
      current.map((offering) =>
        offering.id === id ? { ...offering, ...updates } : offering,
      ),
    );
    setSuccess("");
  }

  function handleCancelEdit() {
    // Reload so any unsaved changes are discarded.
    setEditingId(null);
    void loadOfferings();
  }

  const busy = savingId !== null || creating || loading;

  return (
    <CookMenuFrame>
      {error && (
        <div className="mn-alert err" role="alert">
          <p style={{ margin: 0 }}>{error}</p>
          <button
            type="button"
            className="mn-btn mn-ghost"
            style={{ marginTop: 10 }}
            onClick={() => {
              setLoading(true);
              setError("");
              void loadOfferings();
            }}
          >
            <RefreshCw aria-hidden="true" size={16} />
            Retry
          </button>
        </div>
      )}

      {success && (
        <p className="mn-alert ok" role="status" style={{ marginBottom: 0 }}>
          {success}
        </p>
      )}

      <section className="mn-card" aria-labelledby="add-offering-heading">
        <div className="mn-headrow">
          <div>
            <h2 id="add-offering-heading" className="font-display">
              Add an offering
            </h2>
            <p className="mn-note">Let customers know what you are preparing.</p>
          </div>
          <button
            type="button"
            className="mn-btn mn-ghost"
            onClick={() => {
              setLoading(true);
              setError("");
              void loadOfferings();
            }}
            disabled={busy}
          >
            <RefreshCw aria-hidden="true" size={16} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div className="mn-formgrid">
            <OfferingImage name={draft.name} description={draft.description ?? ""} className="lg" hideIfNone />
            <div className="mn-fields">
              <label className="mn-field">
                Meal name
                <input
                  className="mn-in"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  minLength={2}
                  maxLength={150}
                  placeholder="e.g. Sadza with beef"
                  required
                />
              </label>
              <label className="mn-field">
                Price (USD)
                <input
                  className="mn-in"
                  type="number"
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  value={draft.price || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      price: event.target.value === "" ? 0 : Number(event.target.value),
                    }))
                  }
                  placeholder="e.g. 3.00"
                  required
                />
              </label>
              <label className="mn-field mn-span">
                Description
                <textarea
                  className="mn-ta"
                  value={draft.description ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="Describe your meal and what is included."
                />
              </label>
              <label className="mn-check mn-span">
                <input
                  type="checkbox"
                  checked={draft.available}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      available: event.target.checked,
                    }))
                  }
                />
                Publish this offering for customers to browse
              </label>
              <div className="mn-span">
                <button
                  type="submit"
                  className="mn-btn mn-full"
                  disabled={creating || loading}
                >
                  {creating ? "Saving..." : "Save offering"}
                </button>
              </div>
            </div>
          </div>
        </form>
        <p className="mn-note" style={{ marginTop: 14 }}>
          The photo is chosen from the meal name. It is an illustration, not a photo of your dish.
        </p>
      </section>

      <section className="mn-card" aria-labelledby="saved-offerings-heading">
        <div className="mn-headrow">
          <div>
            <h2 id="saved-offerings-heading" className="font-display">
              Saved offerings
            </h2>
            <p className="mn-note">Manage your published meals and drafts.</p>
          </div>
          {!loading && (
            <span className="mn-count">
              {offerings.length} {offerings.length === 1 ? "offering" : "offerings"}
            </span>
          )}
        </div>

        {loading && (
          <p className="mn-note" role="status" style={{ marginTop: 18 }}>
            Loading your offerings...
          </p>
        )}

        {!loading && offerings.length === 0 && !error && (
          <div className="mn-empty">
            <h3 className="font-display" style={{ margin: 0, fontSize: 22 }}>
              Add your first offering
            </h3>
            <p>
              You have not saved any offerings yet. Use the form above to add a meal
              customers can browse.
            </p>
          </div>
        )}

        <ul className="mn-list">
          {offerings.map((offering) => {
            const editing = editingId === offering.id;

            return (
              <li key={offering.id} className={editing ? "mn-row editing" : "mn-row"}>
                <OfferingImage name={offering.name} description={offering.description ?? ""} className="sm" />

                {!editing ? (
                  <>
                    <div className="mn-rbody">
                      <div className="mn-nameline">
                        <h3 className="font-display">{offering.name}</h3>
                        <span className={offering.available ? "mn-pill pub" : "mn-pill draft"}>
                          {offering.available ? "Published" : "Draft"}
                        </span>
                      </div>
                      <p className="mn-price font-display">{formatPrice(offering.price)}</p>
                      {offering.description && (
                        <p className="mn-desc">{offering.description}</p>
                      )}
                    </div>
                    <div className="mn-actions">
                      <button
                        type="button"
                        className="mn-btn mn-ghost"
                        onClick={() => setEditingId(offering.id)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="mn-btn mn-ghost"
                        onClick={() =>
                          void handleSave({ ...offering, available: !offering.available })
                        }
                        disabled={busy}
                      >
                        {savingId === offering.id
                          ? "Saving..."
                          : offering.available
                            ? "Unpublish"
                            : "Publish"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mn-rbody" style={{ minWidth: 0 }}>
                    <div className="mn-nameline">
                      <span className="mn-eyebrow" style={{ margin: 0 }}>Editing</span>
                      <span className={offering.available ? "mn-pill pub" : "mn-pill draft"}>
                        {offering.available ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="mn-editgrid" style={{ marginTop: 12 }}>
                      <label className="mn-field">
                        Meal name
                        <input
                          className="mn-in"
                          value={offering.name}
                          onChange={(event) =>
                            updateOffering(offering.id, { name: event.target.value })
                          }
                          maxLength={150}
                        />
                      </label>
                      <label className="mn-field">
                        Price (USD)
                        <input
                          className="mn-in"
                          type="number"
                          min="0.01"
                          max="99999999.99"
                          step="0.01"
                          value={offering.price}
                          onChange={(event) =>
                            updateOffering(offering.id, {
                              price:
                                event.target.value === ""
                                  ? 0
                                  : Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="mn-field" style={{ gridColumn: "1 / -1" }}>
                        Description
                        <textarea
                          className="mn-ta"
                          value={offering.description ?? ""}
                          onChange={(event) =>
                            updateOffering(offering.id, {
                              description: event.target.value,
                            })
                          }
                          maxLength={500}
                          rows={2}
                        />
                      </label>
                    </div>
                    <label className="mn-check">
                      <input
                        type="checkbox"
                        checked={offering.available}
                        onChange={(event) =>
                          updateOffering(offering.id, {
                            available: event.target.checked,
                          })
                        }
                      />
                      Published for customers
                    </label>
                    <div className="mn-saverow">
                      <button
                        type="button"
                        className="mn-btn mn-ghost"
                        onClick={handleCancelEdit}
                        disabled={savingId !== null}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="mn-btn"
                        disabled={busy}
                        onClick={() => void handleSave(offering)}
                      >
                        {savingId === offering.id ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </CookMenuFrame>
  );
}
