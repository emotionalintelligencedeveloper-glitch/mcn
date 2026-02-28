<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>CONTRIBUTING — EID Community Story Game</title>
  <style>
    :root{
      --bg:#ffffff;
      --text:#0f172a;
      --muted:#475569;
      --card:#f8fafc;
      --border:#e2e8f0;
      --accent:#2563eb;
    }
    body{
      margin:0;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      background:var(--bg);
      color:var(--text);
      line-height:1.6;
    }
    .wrap{
      max-width:920px;
      margin:0 auto;
      padding:28px 18px 56px;
    }
    header{
      padding:18px 18px 10px;
      border:1px solid var(--border);
      background:var(--card);
      border-radius:16px;
    }
    h1{
      margin:0 0 8px;
      font-size:1.65rem;
      line-height:1.2;
    }
    .sub{
      margin:0;
      color:var(--muted);
      font-size:1rem;
    }
    .pill{
      display:inline-block;
      margin-top:12px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid var(--border);
      background:#fff;
      color:var(--muted);
      font-size:.9rem;
    }
    section{
      margin-top:18px;
      padding:18px;
      border:1px solid var(--border);
      border-radius:16px;
      background:#fff;
    }
    h2{
      margin:0 0 10px;
      font-size:1.2rem;
    }
    ul{
      margin:10px 0 0 18px;
      padding:0;
    }
    li{ margin:6px 0; }
    .note{
      padding:12px 14px;
      border-left:4px solid var(--accent);
      background:var(--card);
      border-radius:12px;
      color:var(--muted);
      margin-top:12px;
    }
    code, pre{
      font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    pre{
      padding:12px;
      border:1px solid var(--border);
      border-radius:12px;
      background:var(--card);
      overflow:auto;
      margin:10px 0 0;
      font-size:.95rem;
    }
    a{
      color:var(--accent);
      text-decoration:none;
    }
    a:hover{ text-decoration:underline; }
    footer{
      margin-top:22px;
      color:var(--muted);
      font-size:.95rem;
      text-align:center;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>🤝 Contributing to EID Community Story Game</h1>
      <p class="sub">
        Thank you for your interest in contributing to the <strong>EID Community Story Game</strong>.
        This project is part of <strong>Emotional Intelligence Developer</strong> — an open-source wellbeing platform focused on emotional intelligence, collaborative writing, and community growth.
      </p>
      <div class="pill">We welcome developers, designers, writers, and thoughtful contributors.</div>
    </header>

    <section>
      <h2>🎯 Project Purpose</h2>
      <p>
        The EID Community Story Game is a real-time collaborative storytelling tool where:
      </p>
      <ul>
        <li>Users submit headlines</li>
        <li>The community votes</li>
        <li>Paragraphs unlock through voting</li>
        <li>A final story is published and downloadable as a PDF</li>
      </ul>
      <div class="note">
        The goal is to blend emotional intelligence with interactive writing while keeping the experience
        <strong>secure</strong>, <strong>stable</strong>, and <strong>accessible</strong>.
      </div>
    </section>

    <section>
      <h2>🛠 Contribution Focus Areas</h2>
      <ul>
        <li>Improving UI / mobile responsiveness</li>
        <li>Enhancing accessibility (ARIA, keyboard support)</li>
        <li>Refining voting logic</li>
        <li>Improving Firebase realtime stability</li>
        <li>Strengthening security rules</li>
        <li>Optimizing performance</li>
        <li>Improving PDF generation reliability</li>
        <li>Fixing bugs</li>
        <li>Suggesting feature improvements</li>
      </ul>
    </section>

    <section>
      <h2>📌 How to Contribute</h2>
      <ol>
        <li>Fork the repository</li>
        <li>Create a new branch</li>
        <li>Make your improvements</li>
        <li>Submit a Pull Request with a clear explanation of:
          <ul>
            <li>What problem you solved</li>
            <li>Why it improves the project</li>
            <li>Any database or logic changes</li>
          </ul>
        </li>
      </ol>

      <pre><code>Suggested branch names:
feature/improve-voting-ui
fix/realtime-sync-bug
perf/reduce-firestore-reads</code></pre>
    </section>

    <section>
      <h2>🔐 Important Security Rules (Non-Negotiable)</h2>
      <p>This project uses Firebase (Firestore + Auth). Contributors <strong>must NOT</strong>:</p>
      <ul>
        <li>Change Firebase API keys</li>
        <li>Change Firebase project IDs</li>
        <li>Remove domain restrictions</li>
        <li>Expose secrets</li>
        <li>Add unrestricted write rules</li>
        <li>Remove security validation</li>
        <li>Add unsafe third-party scripts</li>
      </ul>
      <div class="note">
        All Firebase interactions must remain abuse-resistant and secure.
      </div>
    </section>

    <section>
      <h2>💻 Technical Guidelines</h2>
      <ul>
        <li>Vanilla HTML, CSS, JavaScript (no build tools)</li>
        <li>Must remain GitHub Pages compatible</li>
        <li>Prefer single-file structure for main tools</li>
        <li>Must work on desktop and mobile</li>
        <li>Realtime multiplayer must remain functional</li>
      </ul>
    </section>

    <section>
      <h2>💬 Before Starting Major Changes</h2>
      <p>If you plan to:</p>
      <ul>
        <li>Modify Firestore structure</li>
        <li>Change voting thresholds</li>
        <li>Alter game flow logic</li>
        <li>Refactor authentication</li>
      </ul>
      <p>Please open an Issue first to discuss your idea.</p>
    </section>

    <section>
      <h2>🌍 Community Guidelines</h2>
      <p>
        Be respectful. Be constructive. Be collaborative.
        This is a wellbeing-driven project — emotional intelligence applies here too.
      </p>
    </section>

    <section>
      <h2>❤️ Why This Matters</h2>
      <p>
        This project aims to create meaningful, free, community-supported emotional wellbeing tools.
        By contributing, you help build safe, thoughtful digital spaces.
      </p>
    </section>

    <footer>
      Built by Emotional Intelligence Developer —
      <a href="https://emotionalintelligencedeveloper.com/" target="_blank" rel="noopener">https://emotionalintelligencedeveloper.com/</a>
    </footer>
  </div>
</body>
</html>
