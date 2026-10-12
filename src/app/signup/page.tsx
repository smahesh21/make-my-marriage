import Link from "next/link";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { AuthForm } from "@/app/auth/AuthForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ inviteToken?: string }> }) {
  const { inviteToken } = await searchParams;

  return (
    <main className="auth-design-page signup-design-page">
      <header className="auth-design-header">
        <div className="auth-design-header__inner">
          <div className="auth-design-header__leading">
            <AuthBrand />
            <span className="auth-design-divider" aria-hidden="true" />
            <Link className="auth-design-back" href="/"><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>Back to home</Link>
          </div>
          <div className="auth-design-header__trailing">
            <nav className="auth-design-nav" aria-label="Authentication navigation">
              <Link href="/#features">Explore</Link>
              <Link href="/#how-it-works">Concierge</Link>
              <Link className="is-active" href={inviteToken ? `/login?inviteToken=${encodeURIComponent(inviteToken)}&mode=accept` : "/login"}>Sign In</Link>
            </nav>
            <span className="auth-design-profile" aria-hidden="true"><span className="material-symbols-outlined">person</span></span>
          </div>
        </div>
      </header>

      <div className="auth-design-main">
        <div className="auth-design-content signup-design-content">
          <div className="auth-design-ambient auth-design-ambient--top" aria-hidden="true" />
          <div className="auth-design-ambient auth-design-ambient--bottom" aria-hidden="true" />
          <section className="signup-card" aria-labelledby="signup-heading">
            <header className="signup-card__header">
              <span className="section-eyebrow">Create your account</span>
              <h1 id="signup-heading">A calmer way to carry the details.</h1>
              <p>Bring your wedding plans, people, and next steps into one thoughtful workspace.</p>
            </header>
            <AuthForm mode="signup" inviteToken={inviteToken} />
            <footer className="signup-card__footer">
              <p>Already have an account? <Link href={inviteToken ? `/login?inviteToken=${encodeURIComponent(inviteToken)}&mode=accept` : "/login"}>Sign in</Link></p>
              <div className="signup-trust-row"><span><span className="material-symbols-outlined" aria-hidden="true">lock</span>Private by design</span><span><span className="material-symbols-outlined" aria-hidden="true">verified_user</span>Built for families</span></div>
            </footer>
          </section>
        </div>
        <footer className="auth-design-footer">
          <p>© 2025 Make My Marriage Technologies. Crafted with architectural warmth.</p>
          <nav aria-label="Legal navigation"><Link href="#privacy">Privacy</Link><Link href="#terms">Terms</Link><Link href="#help">Help</Link></nav>
        </footer>
      </div>
    </main>
  );
}
