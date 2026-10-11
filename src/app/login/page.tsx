import Link from "next/link";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { LoginPanel } from "@/app/login/LoginPanel";

export default function LoginPage() {
  return (
    <main className="auth-design-page">
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
              <Link className="is-active" href="/login" aria-current="page">Sign In</Link>
            </nav>
            <span className="auth-design-profile" aria-hidden="true"><span className="material-symbols-outlined">person</span></span>
          </div>
        </div>
      </header>

      <div className="auth-design-main">
        <div className="auth-design-content">
          <div className="auth-design-ambient auth-design-ambient--top" aria-hidden="true" />
          <div className="auth-design-ambient auth-design-ambient--bottom" aria-hidden="true" />
          <LoginPanel />
        </div>
        <footer className="auth-design-footer">
          <p>© 2025 Make My Marriage Technologies. Crafted with architectural warmth.</p>
          <nav aria-label="Legal navigation">
            <Link href="#privacy">Privacy</Link>
            <Link href="#terms">Terms</Link>
            <Link href="#help">Help</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
