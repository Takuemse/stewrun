"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import AccountSignOut from "@/components/account-sign-out";
import { createClient } from "@/lib/supabase/client";

export type AccountMenuLink = { href: string; label: string };

const customerLinks: AccountMenuLink[] = [
  { href: "/profile", label: "Profile" },
  { href: "/my-requests", label: "My Lunch" },
];

/* "Welcome back, Name ▾" with links and Sign out in a dropdown.
   Desktop only: on phones, sign out stays in the bottom navigation. */
export default function AccountMenu({
  links = customerLinks,
}: {
  links?: AccountMenuLink[];
}) {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadIdentity() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      const user = data.user;
      const metadata: unknown = user?.user_metadata;
      const metadataName =
        typeof metadata === "object" &&
        metadata !== null &&
        typeof (metadata as Record<string, unknown>).full_name === "string"
          ? ((metadata as Record<string, unknown>).full_name as string).trim()
          : "";
      const metadataDisplayName =
        typeof metadata === "object" &&
        metadata !== null &&
        typeof (metadata as Record<string, unknown>).name === "string"
          ? ((metadata as Record<string, unknown>).name as string).trim()
          : "";
      const accountEmail = user?.email?.trim() ?? "";
      const emailName = accountEmail.includes("@")
        ? accountEmail.split("@")[0].replace(/[._-]+/g, " ").trim()
        : "";

      setName(metadataName || metadataDisplayName || emailName || null);
      setEmail(accountEmail || null);
    }

    void loadIdentity();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadIdentity();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const nameParts = name?.split(/\s+/).filter(Boolean) ?? [];
  const initial =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.[0] ?? email?.[0] ?? "A").toUpperCase();
  const displayName = nameParts.length ? nameParts.join(" ") : email?.split("@")[0] ?? "Account";

  return (
    <div ref={rootRef} className="acct">
      <style>{`
        .acct{position:relative}
        .acct-btn{display:flex;align-items:center;gap:10px;min-height:48px;
          padding:0 4px 0 0;border:0;background:none;cursor:pointer;
          color:#2A211C;text-align:left}
        .acct-btn:focus-visible{outline:2px solid #B4472B;outline-offset:3px;
          border-radius:999px}
        .acct-avatar{flex:none;width:44px;height:44px;border-radius:50%;
          background:#B4472B;color:#fff;display:flex;align-items:center;
          justify-content:center;font-size:18px;font-weight:600}
        .acct-text{font-size:13px;line-height:1.25;color:#4A3F38}
        .acct-text b{display:block;font-size:15px;font-weight:600;color:#2A211C;
          max-width:11rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .acct-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:60;
          width:232px;padding:8px;background:#fff;border-radius:16px;
          border:1px solid rgba(42,33,28,.08);
          box-shadow:0 12px 32px rgba(31,27,22,.18)}
        .acct-link{display:flex;align-items:center;min-height:44px;padding:0 12px;
          border-radius:10px;font-size:14px;font-weight:600;color:#2A211C;
          text-decoration:none}
        .acct-link:hover{background:#FAF5EF}
        .acct-link:focus-visible{outline:2px solid #B4472B;outline-offset:-2px}
        .acct-sep{height:1px;margin:6px 4px;background:rgba(42,33,28,.1)}
        .acct-pop button{width:100%}
      `}</style>

      <button
        ref={buttonRef}
        type="button"
        className="acct-btn"
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="acct-avatar">
          {initial}
        </span>
        <span className="acct-text">
          Welcome back,
          <b title={email ?? displayName}>{displayName}</b>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4"
          style={{
            transition: "transform .15s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <div id="account-menu-panel" className="acct-pop">
          {email && (
            <p className="acct-link" style={{ cursor: "default", color: "#6B5E55" }}>
              {email}
            </p>
          )}
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="acct-link"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="acct-sep" aria-hidden="true" />
          <AccountSignOut />
        </div>
      )}
    </div>
  );
}