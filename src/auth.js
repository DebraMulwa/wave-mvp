import {
  auth,
  db,
  createUserWithEmailAndPassword,
  doc,
  getDoc,
  setDoc,
  signInWithEmailAndPassword,
  updateProfile,
} from "./firebase.js";

function roleHome(role) {
  return role === "influencer" ? "/influencer" : "/";
}

function showMessage(targetId, message, tone) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message;
  el.className = "form-note " + (tone || "");
}

async function fetchProfile(user) {
  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.exists() ? snap.data() : {};

  return {
    uid: user.uid,
    name: data.name || user.displayName || "Wave User",
    email: user.email || "",
    role: data.role || "brand",
  };
}

function bindSignupForm() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = String(document.getElementById("signupName").value || "").trim();
    const email = String(document.getElementById("signupEmail").value || "").trim();
    const password = String(document.getElementById("signupPassword").value || "");
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : "";

    if (!name || !email || !password || !role) {
      showMessage("signupMessage", "Fill out every field and choose a role.", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("signupMessage", "Use a password with at least 6 characters.", "error");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email: cred.user.email,
        role,
        createdAt: new Date().toISOString(),
      });

      showMessage("signupMessage", "Account created. Redirecting to your workspace...", "success");
      window.setTimeout(function () {
        window.location.href = roleHome(role);
      }, 500);
    } catch (error) {
      console.error("Signup failed", error);
      showMessage("signupMessage", error.message || "Could not create account.", "error");
    }
  });
}

function bindLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = String(document.getElementById("loginEmail").value || "").trim();
    const password = String(document.getElementById("loginPassword").value || "");

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchProfile(cred.user);
      showMessage("loginMessage", "Login successful. Redirecting...", "success");
      window.setTimeout(function () {
        window.location.href = roleHome(profile.role);
      }, 400);
    } catch (error) {
      console.error("Login failed", error);
      showMessage("loginMessage", error.message || "Email or password is incorrect.", "error");
    }
  });
}

async function redirectAuthPagesIfLoggedIn() {
  const currentPath = window.location.pathname;
  const authPages = ["/login", "/login.html", "/signup", "/signup.html"];
  if (!authPages.includes(currentPath)) return;

  if (document.body.dataset.autoRedirectAuth !== "true") return;

  const user = auth.currentUser;
  if (!user) return;

  const profile = await fetchProfile(user);
  window.location.href = roleHome(profile.role);
}

async function initAuthPage() {
  bindLoginForm();
  bindSignupForm();

  await auth.authStateReady();
  await redirectAuthPagesIfLoggedIn();
}

initAuthPage().catch((error) => {
  console.error("Auth initialization failed", error);
});
