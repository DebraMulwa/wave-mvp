import { auth, db, doc, getDoc, signOut } from "./firebase.js";

window.WaveAuthGuard = {
  authorized: false,
  profile: null,
  ready: Promise.resolve(),
};

function roleHome(role) {
  return role === "influencer" ? "/influencer" : "/";
}

function applySessionUI(profile) {
  if (!profile) return;

  document.querySelectorAll("[data-auth-name]").forEach((el) => {
    el.textContent = profile.name || "Wave User";
  });

  document.querySelectorAll("[data-auth-role-label]").forEach((el) => {
    el.textContent = profile.role === "influencer" ? "Influencer" : "Brand";
  });

  document.querySelectorAll("[data-auth-email]").forEach((el) => {
    el.textContent = profile.email || "";
  });
}

async function fetchProfile(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.exists() ? snap.data() : {};

  return {
    uid: user.uid,
    name: data.name || user.displayName || "Wave User",
    email: user.email || "",
    role: data.role || "brand",
  };
}

function bindLogout() {
  document.querySelectorAll("[data-auth-logout]").forEach((button) => {
    button.addEventListener("click", async function () {
      await signOut(auth);
      window.location.href = "/login";
    });
  });
}

async function guardDashboard() {
  document.documentElement.style.visibility = "hidden";

  const requiredRole = document.body.dataset.authRole;
  await auth.authStateReady();

  const user = auth.currentUser;
  if (!user) {
    window.location.replace("/login");
    return;
  }

  const profile = await fetchProfile(user);
  if (requiredRole && profile.role !== requiredRole) {
    window.location.replace(roleHome(profile.role));
    return;
  }

  applySessionUI(profile);
  bindLogout();

  window.WaveAuthGuard.authorized = true;
  window.WaveAuthGuard.profile = profile;
  document.documentElement.style.visibility = "";
}

window.WaveAuthGuard.ready = guardDashboard().catch((error) => {
  console.error("Dashboard auth guard failed", error);
  window.location.replace("/login");
});
