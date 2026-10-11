import Link from "next/link";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { AuthForm } from "@/app/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro">
          <AuthBrand className="auth-logo" markClassName="auth-logo__mark" />
          <div>
            <span className="section-eyebrow">Your shared workspace</span>
            <h1>Start with a little calm.</h1>
            <p>Bring your wedding plans, people, and next steps into one thoughtful place.</p>
          </div>
          <span className="auth-note">Made for couples and the family members carrying the details together.</span>
        </section>
        <section className="auth-card" aria-labelledby="signup-heading">
          <span className="section-eyebrow">Create your account</span>
          <h2 id="signup-heading">Let&apos;s make room for what matters.</h2>
          <p className="auth-card__intro">Your account is the first step. You&apos;ll create your wedding workspace next.</p>
          <AuthForm mode="signup" />
          <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
