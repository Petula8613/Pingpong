// ---- Toast notifications ----
const toastContainer = document.createElement("div");
toastContainer.className = "toast-container";
document.body.appendChild(toastContainer);

function showToast(msg, type = "success", duration = 3500) {
  const icons = { success: "✓", error: "✕", warn: "⚠" };
  const t = document.createElement("div");
  t.className = `toast ${type !== "success" ? type : ""}`;
  t.innerHTML = `<span style="font-size:16px;font-weight:700">${icons[type] || icons.success}</span> ${msg}`;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.classList.add("hiding");
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ---- Modal helpers ----
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) {
    e.target.classList.remove("open");
  }
});

// ---- API ----
const API = {
  base: "/api",
  async get(path) {
    const r = await fetch(this.base + path);
    return r.json();
  },
  async post(path, data) {
    const r = await fetch(this.base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async patch(path, data) {
    const r = await fetch(this.base + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.base + path, { method: "DELETE" });
    return r.json();
  }
};

// ---- Format date ----
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---- Group label ----
function skupinaLabel(sk) {
  return sk === "dospeli" ? "Dospělí" : "Dorost";
}
