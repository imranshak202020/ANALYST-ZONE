/* ============================================================
   Analyst Zone — Admin Login & Edit Mode
   ============================================================
   SETUP (one time):
   1. Go to https://console.firebase.google.com → Create a project.
   2. In the project: Build → Authentication → Sign-in method →
      enable "Email/Password". Then Users tab → Add user (this is
      your admin login — use your own email + a strong password).
   3. Build → Firestore Database → Create database (Production mode,
      any region). Once created, go to the "Rules" tab and paste:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /siteContent/{docId} {
              allow read: if true;
              allow write: if request.auth != null &&
                request.auth.token.email == "YOUR_ADMIN_EMAIL_HERE";
            }
            match /trades/{tradeId} {
              allow read: if true;
              allow write: if request.auth != null &&
                request.auth.token.email == "YOUR_ADMIN_EMAIL_HERE";
            }
          }
        }

      (replace YOUR_ADMIN_EMAIL_HERE with your real admin email,
       matching ADMIN_EMAIL below)

   4. Project settings (gear icon) → General → "Your apps" → Web app
      (</>) → register an app → copy the firebaseConfig object it
      shows you → paste it below, replacing the placeholder values.
   5. Set ADMIN_EMAIL below to the same email you added in step 2.
   6. Upload index.html, trading_journal.html and this admin.js file
      together (same folder) to GitHub / your host.

   HOW IT WORKS:
   - A small 🔒 icon appears bottom-right on every page for anyone.
   - Clicking it opens a login box. Only your admin email/password
     will succeed (everyone else gets an error).
   - Once logged in as admin, a bar appears at the bottom of the
     page with "Enable Edit Mode" and "Save Changes" buttons.
   - Edit Mode makes the main page content directly editable (click
     into text and type, like a Word doc).
   - "Save Changes" pushes your edits to Firestore. From then on,
     EVERY visitor (including logged-out ones) will see your edited
     version — the page fetches the saved version automatically.
   - Only index.html has this editable text region ("Save Changes"
     button does nothing on the trading journal page).
   - The trading journal page has its own, separate sync: every
     Add/Edit/Delete of a trade is written straight to the "trades"
     collection in Firestore, and every visitor's page listens live
     to that collection — so admin's changes show up for everyone
     automatically, without needing a "Save Changes" click.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDpVmh2-6YpQUWVGjiXfhT9mmua_s_gwx8",
  authDomain: "my-website-f5012.firebaseapp.com",
  projectId: "my-website-f5012",
  storageBucket: "my-website-f5012.firebasestorage.app",
  messagingSenderId: "945567270401",
  appId: "1:945567270401:web:ca626d7d90bd6dcbd92200"
};

const ADMIN_EMAIL = "imranshak202020@gmail.com"; // <-- change to your admin login email

const PAGE_KEY = document.body.getAttribute('data-page') || 'index';

let db, auth;

(function loadFirebaseSdk() {
  const s1 = document.createElement('script');
  s1.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
  s1.onload = () => {
    const s2 = document.createElement('script');
    s2.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js";
    s2.onload = () => {
      const s3 = document.createElement('script');
      s3.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js";
      s3.onload = initAdmin;
      document.head.appendChild(s3);
    };
    document.head.appendChild(s2);
  };
  document.head.appendChild(s1);
})();

function initAdmin() {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();

  injectUI();
  loadSavedContentForEveryone();

  auth.onAuthStateChanged((user) => {
    const isAdmin = !!(user && user.email === ADMIN_EMAIL);
    document.getElementById('az-admin-bar').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('az-lock').style.display = isAdmin ? 'none' : 'flex';
    if (!isAdmin) {
      const content = document.getElementById('editable-content');
      if (content) content.setAttribute('contenteditable', 'false');
    }
  });
}

function injectUI() {
  const style = document.createElement('style');
  style.textContent = `
    #az-lock{position:fixed;bottom:18px;right:18px;z-index:9999;background:#12151c;border:1px solid #242a35;color:#8b93a1;width:42px;height:42px;border-radius:50%;align-items:center;justify-content:center;cursor:pointer;font-size:17px;box-shadow:0 4px 14px rgba(0,0,0,.4);display:flex;}
    #az-lock:hover{color:#c9a84c;border-color:#c9a84c;}
    #az-admin-bar{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#12151c;border-top:1px solid #242a35;padding:10px 18px;display:none;align-items:center;gap:12px;font-family:sans-serif;font-size:13px;color:#e9e7de;flex-wrap:wrap;}
    #az-admin-bar button{background:#c9a84c;color:#0d0f14;border:none;padding:8px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;}
    #az-admin-bar button.secondary{background:transparent;border:1px solid #242a35;color:#e9e7de;}
    #az-login-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:none;align-items:center;justify-content:center;}
    #az-login-modal .box{background:#12151c;border:1px solid #242a35;border-radius:10px;padding:24px;width:280px;font-family:sans-serif;position:relative;}
    #az-login-modal input{width:100%;padding:8px;margin-bottom:10px;border-radius:6px;border:1px solid #242a35;background:#0d0f14;color:#e9e7de;box-sizing:border-box;}
    #az-login-modal button{width:100%;padding:9px;border-radius:6px;border:none;background:#c9a84c;color:#0d0f14;font-weight:600;cursor:pointer;}
    #az-login-modal .close{position:absolute;top:10px;right:14px;cursor:pointer;color:#8b93a1;}
    [contenteditable="true"]{outline:2px dashed rgba(201,168,76,.4);}
  `;
  document.head.appendChild(style);

  const lock = document.createElement('div');
  lock.id = 'az-lock';
  lock.title = 'Admin login';
  lock.innerHTML = '&#128274;';
  lock.onclick = () => { document.getElementById('az-login-modal').style.display = 'flex'; };
  document.body.appendChild(lock);

  const modal = document.createElement('div');
  modal.id = 'az-login-modal';
  modal.innerHTML = `
    <div class="box">
      <span class="close" id="az-close">&times;</span>
      <h3 style="color:#e9e7de;margin-top:0;">Admin Login</h3>
      <input id="az-email" type="email" placeholder="Email">
      <input id="az-pass" type="password" placeholder="Password">
      <button id="az-login-btn">Log In</button>
      <div id="az-login-error" style="color:#e05252;font-size:12px;margin-top:8px;"></div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('az-close').onclick = () => { modal.style.display = 'none'; };
  document.getElementById('az-login-btn').onclick = () => {
    const email = document.getElementById('az-email').value;
    const pass = document.getElementById('az-pass').value;
    auth.signInWithEmailAndPassword(email, pass)
      .then(() => { modal.style.display = 'none'; })
      .catch((err) => { document.getElementById('az-login-error').textContent = err.message; });
  };

  const bar = document.createElement('div');
  bar.id = 'az-admin-bar';
  bar.innerHTML = `
    <strong style="color:#c9a84c;">Admin</strong>
    <button id="az-toggle-edit">Enable Edit Mode</button>
    <button id="az-save" class="secondary">Save Changes</button>
    <span id="az-status" style="color:#8b93a1;"></span>
    <button id="az-signout" class="secondary" style="margin-left:auto;">Sign Out</button>
  `;
  document.body.appendChild(bar);
  document.getElementById('az-signout').onclick = () => auth.signOut();

  let editing = false;
  document.getElementById('az-toggle-edit').onclick = function () {
    const content = document.getElementById('editable-content');
    if (!content) { alert('This page has no editable content region.'); return; }
    editing = !editing;
    content.setAttribute('contenteditable', editing ? 'true' : 'false');
    this.textContent = editing ? 'Disable Edit Mode' : 'Enable Edit Mode';
  };

  document.getElementById('az-save').onclick = () => {
    const content = document.getElementById('editable-content');
    if (!content) return;
    document.getElementById('az-status').textContent = 'Saving...';
    db.collection('siteContent').doc(PAGE_KEY).set({
      html: content.innerHTML,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      document.getElementById('az-status').textContent = 'Saved ✓';
      setTimeout(() => { document.getElementById('az-status').textContent = ''; }, 2500);
    }).catch((err) => {
      document.getElementById('az-status').textContent = 'Error: ' + err.message;
    });
  };
}

// Runs for every visitor (admin or not) so they all see the latest saved edits.
function loadSavedContentForEveryone() {
  const content = document.getElementById('editable-content');
  if (!content) return;
  db.collection('siteContent').doc(PAGE_KEY).get().then((doc) => {
    if (doc.exists && doc.data().html) {
      content.innerHTML = doc.data().html;
    }
  }).catch(() => { /* no saved version yet — fine, keep default content */ });
}
