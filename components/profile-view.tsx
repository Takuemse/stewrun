import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

// Presentation only. The save-name form and sign-out button are passed in
// as children so their existing logic is untouched.
// Photo for the banner plate. Swap the path if you prefer another image.
const PLATE_PHOTO = "/images/sadza-beef-stew.jpg";

type ProfileViewProps = {
  name: string;
  email: string | null;
  form: ReactNode;
  signOut: ReactNode;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

const css = `
.pf{--pf-clay:var(--color-clay-500,#B4472B);--pf-ink:var(--color-ink-900,#1F1B16);--pf-amber:#E8A030;
  min-height:100vh;background:var(--color-cream-50,#FAF5EF);padding:24px 20px 56px;box-sizing:border-box}
.pf-wrap{max-width:1000px;margin:0 auto}
.pf-back{display:inline-flex;align-items:center;min-height:44px;font-size:14px;font-weight:600;color:var(--pf-clay);text-decoration:none}
.pf-back:hover{color:var(--pf-ink)}
.pf-hero{position:relative;margin-top:8px;overflow:hidden;box-sizing:border-box;min-height:200px;
  padding:36px 28px;border-radius:28px 28px 28px 72px;
  background:linear-gradient(120deg,#F3E4D0 0%,#F7EBDA 55%,#EFD2B0 100%)}
.pf-disc{display:none;position:absolute;right:-60px;top:-70px;width:340px;height:340px;border-radius:50%;background:var(--pf-clay);opacity:.9}
.pf-plate{display:none;position:absolute;right:70px;top:30px;width:240px;height:240px;border-radius:50%;background:#FAF5EF;box-shadow:0 18px 40px rgba(31,27,22,.18)}
.pf-photo{display:none;position:absolute;right:104px;top:64px;width:172px;height:172px;border-radius:50%;overflow:hidden;background:#EDE0CF}
.pf-eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:#6B5A48}
.pf-h1{margin:10px 0 0;font-size:40px;line-height:1.05;letter-spacing:-.01em;color:var(--pf-ink)}
.pf-h1 span{color:var(--pf-clay)}
.pf-rule{width:56px;height:4px;background:var(--pf-amber);margin-top:16px}
.pf-sub{margin:16px 0 0;max-width:420px;font-size:16px;line-height:1.6;color:rgba(31,27,22,.75)}
.pf-grid{margin-top:24px;display:grid;grid-template-columns:1fr;gap:24px}
.pf-card{background:#fff;border:1px solid rgba(31,27,22,.08);border-radius:28px;padding:24px;box-shadow:0 12px 40px rgba(31,27,22,.05);box-sizing:border-box}
.pf-id{display:flex;gap:20px;align-items:center;padding-bottom:24px;border-bottom:1px solid rgba(31,27,22,.1)}
.pf-avatar{flex:none;width:84px;height:84px;border-radius:50%;background:var(--pf-amber);border:4px solid #fff;outline:3px solid var(--pf-clay);
  display:grid;place-items:center;font-size:30px;font-weight:600;color:var(--pf-ink)}
.pf-name{margin:0;font-size:26px;line-height:1.15;word-break:break-word;color:var(--pf-ink)}
.pf-pill{display:inline-block;margin-top:8px;padding:5px 14px;border-radius:999px;background:rgba(180,71,43,.1);color:#8E341C;font-size:13px;font-weight:600}
.pf-h3{margin:24px 0 0;font-size:20px;font-weight:600;color:var(--pf-ink)}
.pf-form{margin-top:16px}
.pf-form input{min-height:52px;border-radius:14px;font-size:16px}
.pf-form button{min-height:52px;border-radius:999px;font-weight:600;padding-left:28px;padding-right:28px}
.pf-email{margin-top:20px;padding-top:20px;border-top:1px solid rgba(31,27,22,.1)}
.pf-label{font-size:14px;font-weight:500;color:var(--pf-ink)}
.pf-emailbox{margin-top:8px;min-height:52px;border-radius:14px;background:var(--color-cream-50,#FAF5EF);display:flex;align-items:center;gap:10px;padding:0 16px;font-size:16px;font-weight:600;word-break:break-all;color:var(--pf-ink)}
.pf-note{margin:8px 0 0;font-size:13px;color:rgba(31,27,22,.65)}
.pf-ziva{background:#2A221B;color:#FAF5EF;border-radius:28px 28px 28px 72px;padding:28px 28px 32px}
.pf-ziva .pf-eyebrow{color:var(--pf-amber)}
.pf-ziva h2{margin:12px 0 0;font-size:26px;line-height:1.15;font-weight:600}
.pf-ziva h2 span{color:var(--pf-amber)}
.pf-ziva p{margin:12px 0 22px;font-size:14px;line-height:1.6;color:rgba(250,245,239,.78)}
.pf-cta{display:inline-flex;align-items:center;min-height:48px;padding:0 24px;border-radius:999px;background:var(--pf-amber);color:#1F1B16;font-weight:600;font-size:15px;text-decoration:none}
.pf-h2{margin:40px 0 16px;font-size:24px;font-weight:600;color:var(--pf-ink)}
.pf-two{display:grid;grid-template-columns:1fr;gap:20px}
.pf-link{position:relative;display:block;overflow:hidden;min-height:170px;box-sizing:border-box;padding:28px;border-radius:28px;
  background:#fff;border:1px solid rgba(31,27,22,.08);text-decoration:none;color:var(--pf-ink)}
.pf-link:hover{box-shadow:0 12px 32px rgba(31,27,22,.1)}
.pf-link:focus-visible{outline:2px solid var(--pf-clay);outline-offset:2px}
.pf-dot{position:absolute;right:-30px;bottom:-40px;width:150px;height:150px;border-radius:50%}
.pf-link h3{position:relative;margin:0;font-size:22px;font-weight:600}
.pf-link p{position:relative;margin:10px 0 18px;max-width:300px;font-size:15px;line-height:1.55;color:rgba(31,27,22,.72)}
.pf-link span.go{position:relative;font-weight:600;font-size:15px;color:var(--pf-clay)}
.pf-actions{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
  background:#fff;border:1px solid rgba(31,27,22,.08);border-radius:28px;padding:22px 24px}
.pf-actions strong{display:block;font-size:16px}
.pf-actions small{display:block;margin-top:2px;font-size:14px;color:rgba(31,27,22,.7)}
.pf-signout button{min-height:48px;border-radius:999px;padding-left:28px;padding-right:28px;font-weight:600}
@media (min-width:640px){
  .pf{padding:32px 32px 64px}
  .pf-hero{padding:44px 48px}
  .pf-h1{font-size:52px}
  .pf-card{padding:32px}
  .pf-two{grid-template-columns:1fr 1fr}
}
@media (min-width:768px){
  .pf-disc,.pf-plate,.pf-photo{display:block}
  .pf-sub{max-width:360px}
}
@media (min-width:1024px){
  .pf-grid{grid-template-columns:1.6fr 1fr;align-items:stretch}
  .pf-sub{max-width:420px}
}
@media (prefers-reduced-motion:reduce){.pf-link{transition:none}}
`;

export default function ProfileView({ name, email, form, signOut }: ProfileViewProps) {
  return (
    <main className="pf">
      <style>{css}</style>
      <div className="pf-wrap">
        <Link href="/dashboard" className="pf-back">
          ← Back to dashboard
        </Link>

        <section className="pf-hero" aria-labelledby="profile-heading">
          <div className="pf-disc" aria-hidden="true" />
          <div className="pf-plate" aria-hidden="true" />
          <div className="pf-photo" aria-hidden="true">
            <Image
              src={PLATE_PHOTO}
              alt=""
              fill
              sizes="172px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <p className="pf-eyebrow">Your account</p>
            <h1 id="profile-heading" className="pf-h1 font-display">
              Your <span>profile.</span>
            </h1>
            <div className="pf-rule" />
            <p className="pf-sub">
              Manage your details and jump back into your requests and orders.
            </p>
          </div>
        </section>

        <section className="pf-grid">
          <div className="pf-card" aria-labelledby="account-details-heading">
            <div className="pf-id">
              <div className="pf-avatar font-display" aria-hidden="true">
                {initialsOf(name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="pf-name font-display">{name}</p>
                <span className="pf-pill">Customer</span>
              </div>
            </div>

            <h2 id="account-details-heading" className="pf-h3 font-display">
              Account details
            </h2>
            <div className="pf-form">{form}</div>

            <div className="pf-email">
              <p className="pf-label">Email address</p>
              <div className="pf-emailbox">
                {email ?? "No email address is associated with this account."}
              </div>
              <p className="pf-note">
                Your email is used to sign in and can’t be changed here.
              </p>
            </div>
          </div>

          <div className="pf-ziva">
            <p className="pf-eyebrow">Ziva</p>
            <h2 className="font-display">
              Craving <span>something?</span>
            </h2>
            <p>
              Tell Ziva what you’d like and set your budget. Cooks reply with
              their own prices.
            </p>
            <Link href="/dashboard" className="pf-cta">
              Start a lunch request →
            </Link>
          </div>
        </section>

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="pf-h2 font-display">
            Your lunch
          </h2>
          <div className="pf-two">
            <Link href="/my-requests" className="pf-link">
              <span className="pf-dot" style={{ background: "rgba(232,160,48,.22)" }} aria-hidden="true" />
              <h3 className="font-display">My Requests</h3>
              <p>Review your meal requests and cook offers.</p>
              <span className="go">View my requests →</span>
            </Link>
            <Link href="/orders" className="pf-link">
              <span className="pf-dot" style={{ background: "rgba(180,71,43,.14)" }} aria-hidden="true" />
              <h3 className="font-display">My Orders</h3>
              <p>Review your orders, pickup details and cash-at-pickup instructions.</p>
              <span className="go">View my orders →</span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="account-actions-heading">
          <h2 id="account-actions-heading" className="pf-h2 font-display">
            Account actions
          </h2>
          <div className="pf-actions">
            <div>
              <strong>Sign out</strong>
              <small>End your session on this device.</small>
            </div>
            <div className="pf-signout">{signOut}</div>
          </div>
        </section>
      </div>
    </main>
  );
}