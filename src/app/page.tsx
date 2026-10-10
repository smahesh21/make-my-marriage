type IconName =
  | "account_balance"
  | "account_balance_wallet"
  | "check"
  | "check_circle"
  | "check_box"
  | "check_box_outline_blank"
  | "chat_bubble_outline"
  | "chevron_right"
  | "done_all"
  | "download"
  | "expand_more"
  | "group"
  | "groups"
  | "link"
  | "mail"
  | "mark_email_read"
  | "photo_camera"
  | "qr_code_2"
  | "radio_button_unchecked"
  | "restaurant"
  | "share"
  | "task_alt"
  | "villa";

function MaterialIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`.trim()} aria-hidden="true">{name}</span>;
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 280 64" fill="none" aria-hidden="true">
      <g transform="translate(4, 8)">
        <rect x="0" y="0" width="48" height="48" rx="14" fill="#75836D" fillOpacity="0.12" stroke="#75836D" strokeOpacity="0.3" strokeWidth="1.2" />
        <circle cx="20" cy="24" r="11" stroke="#75836D" strokeWidth="2.5" />
        <circle cx="28" cy="24" r="11" stroke="#292C29" strokeWidth="2.5" />
        <path d="M24 16.5C25.5 19 25.5 29 24 31.5" stroke="#75836D" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M17 11 18 13.5 20.5 14.5 18 15.5 17 18 16 15.5 13.5 14.5 16 13.5Z" fill="#75836D" />
        <circle cx="31" cy="14" r="1.8" fill="#292C29" />
      </g>
      <text x="64" y="29" fontFamily="'DM Serif Display', 'Noto Serif', serif" fontSize="20" fontWeight="600" fill="#292C29" letterSpacing="-0.3">Make My Marriage</text>
      <text x="65" y="44" fontFamily="Inter, sans-serif" fontSize="9.5" fontWeight="500" fill="#75836D" letterSpacing="1.4">WEDDING WORKSPACE</text>
    </svg>
  );
}

function BrandLogo() {
  return (
    <span className="brand-logo">
      <BrandMark />
    </span>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  centered?: boolean;
}) {
  return (
    <div className={`section-intro${centered ? " section-intro--centered" : ""}`}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="feature-list">
      {items.map((item) => (
        <li key={item}>
          <MaterialIcon name="check" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DashboardPreview() {
  return (
    <div className="dashboard-preview">
      <div className="dashboard-heading">
        <div className="dashboard-title">
          <div className="avatar-stack" aria-hidden="true">
            <span className="avatar avatar--sage">A</span>
            <span className="avatar avatar--stone">M</span>
          </div>
          <div>
            <h3>Aarav &amp; Meera&apos;s Wedding</h3>
            <p>18 Dec 2025 · Bengaluru</p>
          </div>
        </div>
        <div className="dashboard-status">
          <span className="status-pill">142 days to go</span>
          <span className="sync-dot" title="Real-time sync active" />
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Total Budget</span>
          <strong>₹8,00,000</strong>
          <small>Target pool</small>
        </div>
        <div className="metric-card">
          <span>Spent So Far</span>
          <strong className="metric-card__accent">₹4,96,000</strong>
          <div className="progress-track"><i style={{ width: "62%" }} /></div>
        </div>
        <div className="metric-card">
          <span>Tasks Done</span>
          <strong>12 / 20</strong>
          <small className="metric-card__accent-text">60% completed</small>
        </div>
        <div className="metric-card">
          <span>Guest RSVPs</span>
          <strong>142</strong>
          <small>180 invited</small>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="dashboard-panel">
          <div className="panel-heading">
            <span>Critical Milestones</span>
            <a href="#features">View all (8)</a>
          </div>
          <div className="milestone-list">
            <div className="milestone-row">
              <MaterialIcon name="check_box" className="icon-primary icon-filled" />
              <div>
                <p className="is-complete">Confirm venue booking (Sangeet &amp; Reception)</p>
                <span className="label-primary">Paid &amp; locked</span>
              </div>
            </div>
            <div className="milestone-row">
              <MaterialIcon name="check_box" className="icon-primary icon-filled" />
              <div>
                <p className="is-complete">Book traditional candid photographer</p>
                <span className="label-primary">Advance paid</span>
              </div>
            </div>
            <div className="milestone-row">
              <MaterialIcon name="check_box_outline_blank" className="icon-secondary" />
              <div>
                <p>Finalize guest list &amp; RSVP deadline</p>
                <span className="label-error">Due in 5 days · Meera</span>
              </div>
            </div>
            <div className="milestone-row">
              <MaterialIcon name="check_box_outline_blank" className="icon-secondary" />
              <div>
                <p>Schedule catering tasting session</p>
                <span className="label-secondary">Due in 12 days · Aarav</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-heading">
            <span>Expense Categories</span>
            <span className="label-secondary">4 of 7</span>
          </div>
          <div className="category-list">
            <div className="category-row">
              <div><span>Venue &amp; Decor</span><strong>₹3,50,000 <em>/ ₹4,00,000</em></strong></div>
              <div className="progress-track"><i style={{ width: "87.5%" }} /></div>
            </div>
            <div className="category-row">
              <div><span>Catering &amp; Banquet</span><strong>₹1,80,000 <em>/ ₹2,20,000</em></strong></div>
              <div className="progress-track"><i style={{ width: "81%" }} /></div>
            </div>
            <div className="category-row">
              <div><span>Photography &amp; Films</span><strong>₹85,000 <em>/ ₹1,00,000</em></strong></div>
              <div className="progress-track"><i style={{ width: "85%" }} /></div>
            </div>
            <div className="category-row">
              <div><span>Attire &amp; Jewelry</span><strong>₹65,000 <em>/ ₹80,000</em></strong></div>
              <div className="progress-track"><i style={{ width: "81%" }} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseFeature() {
  return (
    <div className="feature-story">
      <div className="feature-copy feature-copy--order-two">
        <div className="feature-kicker"><MaterialIcon name="account_balance" />Financial Control</div>
        <h3>Know where your budget stands.</h3>
        <p>Track wedding expenses, organize vendor costs, and see how your spending compares with your planned budget in real time.</p>
        <FeatureList items={[
          "Multi-vendor payment schedule with due dates and milestones.",
          "Automatic remaining balance calculations in Indian Rupees (₹).",
          "Categorical breakdown across venue, decor, photography, and bridalwear.",
        ]} />
      </div>
      <div className="feature-module feature-module--order-one payment-schedule">
        <div className="module-heading">
          <div><h4>Payment Schedule</h4><p>Active vendor commitments</p></div>
          <div className="module-tabs"><span className="is-active">All</span><span>Catering</span><span>Venue</span><span>Attire</span></div>
        </div>
        <div className="payment-list">
          <div className="payment-row">
            <div className="payment-info"><span className="module-icon"><MaterialIcon name="villa" /></span><div><strong>The Grand Palace Hall</strong><small>Advance booking deposit paid</small></div></div>
            <div className="payment-amount"><strong>₹1,50,000</strong><span>Paid</span></div>
          </div>
          <div className="payment-row">
            <div className="payment-info"><span className="module-icon"><MaterialIcon name="restaurant" /></span><div><strong>Royal Caterers &amp; Sweets</strong><small>Next milestone due 15 Oct</small></div></div>
            <div className="payment-amount"><strong>₹1,00,000</strong><span className="payment-amount__neutral">Upcoming</span></div>
          </div>
          <div className="payment-row">
            <div className="payment-info"><span className="module-icon"><MaterialIcon name="photo_camera" /></span><div><strong>Stories by Kabir (Cinematography)</strong><small>Balance due after final album</small></div></div>
            <div className="payment-amount"><strong className="payment-amount__dark">₹45,000</strong><span className="payment-amount__muted">Pending</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksFeature() {
  return (
    <div className="feature-story feature-story--tasks">
      <div className="feature-module checklist-module">
        <div className="module-heading">
          <div><h4>Checklist &amp; Timeline</h4><p>Organized by ceremony urgency</p></div>
          <div className="module-pills"><span className="is-active">Timeline</span><span>Priority</span><span>By Partner</span></div>
        </div>
        <div className="checklist-group">
          <div className="checklist-meta"><span>3 MONTHS OUT (CRITICAL)</span><span>2 of 3 Done</span></div>
          <div className="checklist-row"><div><MaterialIcon name="check_circle" className="icon-primary icon-filled" /><span className="is-complete">Book DJ &amp; sound engineer for Sangeet</span></div><span className="tag-neutral">Done</span></div>
          <div className="checklist-row"><div><MaterialIcon name="radio_button_unchecked" className="icon-secondary" /><span>Bridal lehenga final trial &amp; alterations</span></div><div className="checklist-tags"><span className="tag-error">High Priority</span><span>Meera</span></div></div>
          <div className="checklist-row"><div><MaterialIcon name="radio_button_unchecked" className="icon-secondary" /><span>Book hotel rooms for outstation family</span></div><div className="checklist-tags"><span className="tag-neutral">Aarav&apos;s lead</span></div></div>
        </div>
      </div>
      <div className="feature-copy">
        <div className="feature-kicker"><MaterialIcon name="task_alt" />Collaborative Milestones</div>
        <h3>Stay on top of every detail.</h3>
        <p>Keep tasks, deadlines, and ceremony requirements structured so both partners always know what needs immediate attention.</p>
        <FeatureList items={[
          "Assign tasks by person or share responsibility across both families.",
          "Pre-built milestone templates calibrated for traditional Indian multi-day weddings.",
          "Automated deadline alerts before vendor cancellation penalties kick in.",
        ]} />
      </div>
    </div>
  );
}

function GuestFeature() {
  return (
    <div className="feature-story">
      <div className="feature-copy feature-copy--order-two">
        <div className="feature-kicker"><MaterialIcon name="group" />Guest Logistics</div>
        <h3>Keep your guest list in order.</h3>
        <p>Organize wedding attendees, household groupings, and RSVP responses from one calm, central registry.</p>
        <FeatureList items={[
          "Side-by-side family counts: Bride's side (95), Groom's side (85).",
          "Per-event guest selection: assign who attends Mehndi vs. Grand Reception.",
          "Dietary requirement notes (Jain, Pure Veg, Halal) linked directly to caterer counts.",
        ]} />
      </div>
      <div className="feature-module feature-module--order-one guest-module">
        <div className="guest-heading">
          <div><h4>Guest Registry</h4><span>180 Total</span></div>
          <div><strong>Bride: 95</strong><i>·</i><span>Groom: 85</span></div>
        </div>
        <div className="guest-table">
          <div className="guest-table-row guest-table-row--head"><span>Guest / Family</span><span>Side</span><span>Pax</span><span>Events</span><span>RSVP</span></div>
          <div className="guest-table-row"><div><strong>Dr. Rajesh &amp; Sunita Sharma</strong><small>Family · Mumbai</small></div><span>Bride</span><span>3 pax</span><span>All 3 Days</span><em>Accepted</em></div>
          <div className="guest-table-row"><div><strong>Vikramaditya Verma</strong><small>College Friend · Delhi</small></div><span>Groom</span><span>1 pax</span><span>Reception</span><em className="guest-status--neutral">Pending</em></div>
          <div className="guest-table-row"><div><strong>Ananya Deshmukh &amp; Family</strong><small>Cousin · Pune</small></div><span>Bride</span><span>4 pax</span><span>Sangeet + Wed</span><em>Accepted</em></div>
        </div>
      </div>
    </div>
  );
}

function InvitationsFeature() {
  return (
    <div className="feature-story feature-story--invitations">
      <div className="feature-module invitation-module">
        <div className="invitation-grid">
          <div className="save-date-card">
            <span className="save-date-label">Save The Date</span>
            <h4>Meera &amp; Aarav</h4>
            <p>Request the pleasure of your company</p>
            <span className="date-chip">18 December 2025 · Bengaluru Palace</span>
            <div className="qr-placeholder"><MaterialIcon name="qr_code_2" /></div>
          </div>
          <div className="sharing-options">
            <h5>Instant Sharing Options</h5>
            <a href="#start-planning"><span><MaterialIcon name="link" />Copy Private Guest Link</span><MaterialIcon name="chevron_right" /></a>
            <a href="#start-planning"><span><MaterialIcon name="share" />WhatsApp Broadcast Format</span><MaterialIcon name="chevron_right" /></a>
            <a href="#start-planning"><span><MaterialIcon name="mail" />Email Invitations</span><MaterialIcon name="chevron_right" /></a>
            <a href="#start-planning"><span><MaterialIcon name="download" />Download High-Res QR Code</span><MaterialIcon name="chevron_right" /></a>
          </div>
        </div>
      </div>
      <div className="feature-copy">
        <div className="feature-kicker"><MaterialIcon name="mark_email_read" />Seamless Communication</div>
        <h3>Make every invitation easy to share.</h3>
        <p>Share elegant wedding invitations and ceremony schedules through modern digital channels with zero friction for your guests.</p>
        <FeatureList items={[
          "Guests RSVP in one tap without downloading any app or creating an account.",
          "Integrated Google Maps venue pins and parking directions included.",
          "Instant RSVP tallying directly updates your master budget and catering counts.",
        ]} />
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <div className="landing-page">
      <header className="site-header">
        <div className="content-shell header-inner">
          <a className="brand" href="#top" aria-label="Make My Marriage home"><BrandLogo /></a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <a href="#features">Why Make My Marriage</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="header-actions">
            <a className="sign-in-link" href="#start-planning">Sign in</a>
            <a className="button button--header" href="#start-planning">Start planning for free</a>
          </div>
        </div>
      </header>

      <main id="top" className="site-main">
        <section className="hero-section">
          <div className="content-shell">
            <div className="hero-grid">
              <div className="hero-copy">
                <div className="hero-pill"><span />A better way to plan</div>
                <h1>Your wedding.<br className="hero-break" /> Beautifully organized.</h1>
                <p>One shared space for your plans, budget, guests, and every little detail across every ceremony.</p>
                <div className="hero-actions">
                  <a className="button button--hero-primary" href="#start-planning">Start planning for free</a>
                  <a className="button button--hero-secondary" href="#features">Explore the features</a>
                </div>
                <div className="hero-note"><MaterialIcon name="check_circle" />Bring your wedding plans together, one step at a time.</div>
              </div>
              <DashboardPreview />
            </div>
          </div>
        </section>

        <section className="challenge-section">
          <div className="content-shell">
            <SectionIntro centered eyebrow="The Challenge" title="Everything to plan. One place to manage it." description="Keep the moving pieces of your wedding connected, from everyday tasks to expenses and guest coordination." />
            <div className="challenge-grid">
              <article className="challenge-card">
                <div><span className="challenge-icon"><MaterialIcon name="chat_bubble_outline" /></span><h3>Scattered plans and deadlines</h3><p>Notes in chat apps, lost email attachments, and forgotten milestones that make coordination between both sides unnecessarily stressful.</p></div>
                <div className="challenge-resolution">Unified workspace resolution</div>
              </article>
              <article className="challenge-card">
                <div><span className="challenge-icon"><MaterialIcon name="account_balance_wallet" /></span><h3>Unclear spending and expenses</h3><p>Multiple bank transfers, untracked vendor advances, and surprise ceremony costs that quietly push your allocated budget off course.</p></div>
                <div className="challenge-resolution">Categorized ₹ visibility</div>
              </article>
              <article className="challenge-card">
                <div><span className="challenge-icon"><MaterialIcon name="groups" /></span><h3>Guest lists hard to coordinate</h3><p>Conflicting spreadsheet versions between families, missing dietary notes, and confusing RSVP counts across Haldi, Sangeet, and Reception.</p></div>
                <div className="challenge-resolution">Cross-family synchronized list</div>
              </article>
            </div>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="content-shell">
            <SectionIntro centered eyebrow="Connected Platform" title="Every detail, working together." description="Spend less time organizing information and more time making decisions together." />
            <div className="feature-stack">
              <ExpenseFeature />
              <TasksFeature />
              <GuestFeature />
              <InvitationsFeature />
            </div>
          </div>
        </section>

        <section className="plan-section">
          <div className="content-shell">
            <div className="plan-card">
              <div className="plan-grid">
                <div className="plan-copy">
                  <span className="section-eyebrow">Real-time Collaboration</span>
                  <h2>Two people. One shared plan.</h2>
                  <p>Bring your wedding plans together with a shared workspace that keeps both partners and key family organizers completely in sync.</p>
                  <div className="partner-pills"><span><i />Meera R. (Partner 1)</span><b>&amp;</b><span><i />Aarav S. (Partner 2)</span></div>
                  <p className="plan-detail">Both partners enjoy full administrative visibility, distinct logins, and real-time updates—say goodbye to asking &quot;Did you already reply to the caterer?&quot;</p>
                </div>
                <div className="activity-module">
                  <div className="activity-heading"><span>Recent Shared Activity</span><b>Live</b></div>
                  <div className="activity-list">
                    <div className="activity-row"><span className="activity-avatar activity-avatar--stone">A</span><div><p><strong>Aarav</strong> uploaded receipt for Mandap decor advance (₹45,000)</p><small>18 minutes ago</small></div></div>
                    <div className="activity-row"><span className="activity-avatar activity-avatar--sage">M</span><div><p><strong>Meera</strong> confirmed 14 RSVPs from Bengaluru relatives</p><small>2 hours ago</small></div></div>
                    <div className="activity-row"><span className="activity-avatar activity-avatar--high"><MaterialIcon name="done_all" /></span><div><p>Both partners approved the finalized multi-course Reception dinner menu</p><small>Yesterday</small></div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="process-section" id="how-it-works">
          <div className="content-shell">
            <SectionIntro centered eyebrow="Process" title="Getting started is simple." description="Four easy steps to bring structured calm to your wedding preparations." />
            <div className="process-grid">
              <article className="process-card"><span>01</span><h3>Create your wedding</h3><p>Set up your shared workspace with your target wedding dates and host city in less than two minutes.</p></article>
              <article className="process-card"><span>02</span><h3>Invite your partner</h3><p>Send a single invite link so both partners have equal editing control and transparent joint access.</p></article>
              <article className="process-card"><span>03</span><h3>Organize the details</h3><p>Add your budget estimates, start your ceremony checklists, and import initial family guest contacts.</p></article>
              <article className="process-card"><span>04</span><h3>Keep everything moving</h3><p>Log milestone payments in real time, check off items, and effortlessly distribute digital invites.</p></article>
            </div>
          </div>
        </section>

        <section className="faq-section" id="faq">
          <div className="faq-shell">
            <SectionIntro centered eyebrow="Questions & Answers" title="Trust & practical information" description="Everything you need to know about planning on Make My Marriage." />
            <div className="faq-list">
              <details open><summary>How do we get started?<MaterialIcon name="expand_more" /></summary><p>Simply create an account, enter your wedding date and approximate guest count, and your collaborative workspace is ready immediately. You can start adding expenses and checklists right away.</p></details>
              <details><summary>Can both partners use the same wedding workspace?<MaterialIcon name="expand_more" /></summary><p>Yes. Each partner creates their own login and joins the shared wedding space with full permissions to edit tasks, update expenses, and manage guests simultaneously from any device.</p></details>
              <details><summary>Can guests access invitation information without creating an account?<MaterialIcon name="expand_more" /></summary><p>Yes. Guests receive a direct link or QR code to view event details, maps, and submit RSVPs without needing to register or download an app.</p></details>
              <details><summary>How can we share digital invitations?<MaterialIcon name="expand_more" /></summary><p>You can generate private web links, share instantly via WhatsApp or email, or export a high-resolution QR code for printed stationery.</p></details>
              <details><summary>Is there a free plan?<MaterialIcon name="expand_more" /></summary><p>Yes. Make My Marriage offers core planning tools, checklists, guest lists, and basic budget tracking at no cost.</p></details>
            </div>
          </div>
        </section>

        <section className="final-cta-section" id="start-planning">
          <div className="content-shell">
            <div className="final-cta-card">
              <h2>Make room for what matters most.</h2>
              <p>Bring your plans, budget, and guests together in one place, and take the next step toward your wedding day.</p>
              <a className="button button--final" href="#top">Start planning for free</a>
              <small>Free to start · Collaborative for both partners · No credit card required</small>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="content-shell">
          <div className="footer-grid">
            <div className="footer-brand"><a href="#top" aria-label="Make My Marriage home"><BrandLogo /></a><p>A collaborative wedding-planning platform for couples in India. Your wedding, beautifully organized.</p></div>
            <div><h3>Product</h3><nav aria-label="Product navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#faq">FAQ</a><a href="#start-planning">Sign in</a><a href="#start-planning">Get started</a></nav></div>
            <div><h3>Legal</h3><nav aria-label="Legal navigation"><a href="#top">Privacy Policy</a><a href="#top">Terms of Service</a></nav></div>
          </div>
          <div className="footer-meta"><span>© 2025 Make My Marriage. All rights reserved.</span><div><a href="#top">Privacy</a><a href="#top">Terms</a></div></div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
