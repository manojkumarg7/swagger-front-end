/**
 * Users CRUD UI for https://swagger-api-2.onrender.com/users
 * Routes use MongoDB **_id** (string) in the URL: /users/:_id
 * - GET    /users
 * - POST   /users
 * - PUT    /users/:_id
 * - DELETE /users/:_id
 *
 * Run: npm run dev → http://localhost:5173
 */

const API_URL = "http://localhost:3000/users";

const loadingEl = document.getElementById("state-loading");
const errorEl = document.getElementById("state-error");
const errorMessageEl = document.getElementById("error-message");
const successEl = document.getElementById("state-success");
const successSummaryEl = document.getElementById("success-summary");
const tbodyEl = document.getElementById("users-tbody");
const retryBtn = document.getElementById("retry-btn");
const addForm = document.getElementById("add-user-form");
const feedbackEl = document.getElementById("action-feedback");

/** Last loaded list — used when switching a row to edit mode */
let usersCache = [];

/**
 * MongoDB `_id` as a string for URLs and `data-mongodb-id`.
 * Supports normal JSON (`"_id": "abc..."`) and `{ "$oid": "..." }`.
 */
function mongoIdString(user) {
  const raw = user?._id;
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw.$oid != null) return String(raw.$oid);
  return String(raw);
}

function showOnly(which) {
  loadingEl.hidden = which !== "loading";
  errorEl.hidden = which !== "error";
  successEl.hidden = which !== "success";
}

function setFeedback(message, isError = false) {
  feedbackEl.textContent = message || "";
  feedbackEl.classList.toggle(
    "action-feedback--error",
    Boolean(message && isError),
  );
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Safe for HTML attribute values */
function escapeAttr(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function parseSkills(input) {
  if (!input || typeof input !== "string") return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/480x300?text=User";

function numOrNull(raw) {
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function buildUserPayloadFromFormData(formData) {
  const name = String(formData.get("name") || "").trim();
  const age = numOrNull(formData.get("age"));
  const isActive = Boolean(formData.get("isActive"));
  const city = String(formData.get("city") || "").trim();
  const pincode = numOrNull(formData.get("pincode"));
  const skills = parseSkills(String(formData.get("skills") || ""));
  const bio = String(formData.get("bio") || "").trim();
  const image = String(formData.get("image") || "").trim();

  return {
    name,
    age,
    isActive,
    skills,
    address: {
      city: city || "—",
      pincode: pincode ?? 0,
    },
    bio,
    image: image || PLACEHOLDER_IMAGE,
  };
}

function formatErrorMessage(err, httpStatus) {
  if (window.location.protocol === "file:") {
    return "This page was opened as a file (file://). Run npm run dev and open http://localhost:5173.";
  }
  if (httpStatus) {
    return `The server returned HTTP ${httpStatus}.`;
  }
  const msg = err && err.message ? String(err.message) : "Unknown error";
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed")
  ) {
    return "Network error. Check connection and CORS: the API must allow your page origin (e.g. http://localhost:5173).";
  }
  return msg;
}

function renderReadRow(user) {
  const pk = mongoIdString(user);
  const name = escapeHtml(String(user.name ?? "—"));
  const age = user.age != null ? escapeHtml(String(user.age)) : "—";
  const active = Boolean(user.isActive);
  const activeLabel = active ? "Yes" : "No";
  const activeClass = active ? "cell-active-yes" : "cell-active-no";
  const city = escapeHtml(String(user.address?.city ?? "—"));
  const pin =
    user.address?.pincode != null
      ? escapeHtml(String(user.address.pincode))
      : "—";
  const skills = Array.isArray(user.skills)
    ? escapeHtml(user.skills.join(", "))
    : "—";
  const bio = escapeHtml(String(user.bio ?? ""));
  const imgSrc = user.image
    ? escapeHtml(String(user.image))
    : "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect fill="#2a3444" width="40" height="40"/><text x="20" y="24" fill="#8b9cb3" font-size="10" text-anchor="middle">—</text></svg>',
      );

  const pkAttr = escapeAttr(pk);

  return `
    <tr data-mongodb-id="${pkAttr}">
      <td class="cell-thumb">
        <img class="thumb" src="${imgSrc}" alt="${name} photo" width="40" height="40" loading="lazy" />
      </td>
      <td>${name}</td>
      <td>${age}</td>
      <td class="${activeClass}">${activeLabel}</td>
      <td>${city}</td>
      <td>${pin}</td>
      <td class="cell-skills">${skills}</td>
      <td class="cell-bio">${bio}</td>
      <td class="cell-actions cell-actions--row">
        <button type="button" class="btn btn--small js-edit-user" data-mongodb-id="${pkAttr}">
          Edit
        </button>
        <button
          type="button"
          class="btn btn--small btn--danger js-delete-user"
          data-mongodb-id="${pkAttr}"
          data-user-name="${escapeAttr(String(user.name ?? ""))}"
        >
          Delete
        </button>
      </td>
    </tr>
  `;
}

function renderEditRow(user) {
  const pk = mongoIdString(user);
  const pkAttr = escapeAttr(pk);
  const skillsStr = Array.isArray(user.skills) ? user.skills.join(", ") : "";
  const imgVal = escapeAttr(user.image || PLACEHOLDER_IMAGE);
  const thumbSrc = escapeAttr(String(user.image || PLACEHOLDER_IMAGE));
  const nameVal = escapeAttr(user.name || "");
  const ageVal = user.age != null ? escapeAttr(String(user.age)) : "";
  const cityVal = escapeAttr(user.address?.city || "");
  const pinVal =
    user.address?.pincode != null
      ? escapeAttr(String(user.address.pincode))
      : "";
  const checked = user.isActive ? "checked" : "";

  return `
    <tr data-mongodb-id="${pkAttr}" class="tr--editing">
      <td class="cell-thumb cell-thumb--edit">
        <img class="thumb" src="${thumbSrc}" alt="" width="40" height="40" />
        <input class="input input--compact" type="url" name="image" value="${imgVal}" aria-label="Image URL" />
      </td>
      <td><input class="input" type="text" name="name" value="${nameVal}" required /></td>
      <td><input class="input" type="number" name="age" min="0" max="150" value="${ageVal}" /></td>
      <td><label class="check-inline"><input type="checkbox" name="isActive" ${checked} /> Yes</label></td>
      <td><input class="input" type="text" name="city" value="${cityVal}" /></td>
      <td><input class="input" type="number" name="pincode" min="0" value="${pinVal}" /></td>
      <td class="cell-skills"><input class="input" type="text" name="skills" value="${escapeAttr(skillsStr)}" placeholder="comma-separated" /></td>
      <td class="cell-bio"><textarea class="input input--textarea" name="bio" rows="2">${escapeHtml(String(user.bio ?? ""))}</textarea></td>
      <td class="cell-actions cell-actions--stack">
        <button type="button" class="btn btn--small js-save-user">Save</button>
        <button type="button" class="btn btn--secondary btn--small js-cancel-edit">Cancel</button>
      </td>
    </tr>
  `;
}

function startEditRow(_id) {
  const _idStr = String(_id);
  const user = usersCache.find((u) => mongoIdString(u) === _idStr);
  if (!user) return;
  // _id is a 24-char hex string from MongoDB — safe inside the quoted attribute
  const row = tbodyEl.querySelector(`tr[data-mongodb-id="${_idStr}"]`);
  if (!row) return;
  row.outerHTML = renderEditRow(user);
}

function readRowPayload(tr) {
  const name = tr.querySelector('[name="name"]')?.value?.trim() ?? "";
  const age = numOrNull(tr.querySelector('[name="age"]')?.value);
  const isActive = tr.querySelector('[name="isActive"]')?.checked ?? false;
  const city = tr.querySelector('[name="city"]')?.value?.trim() ?? "";
  const pincode = numOrNull(tr.querySelector('[name="pincode"]')?.value);
  const skills = parseSkills(tr.querySelector('[name="skills"]')?.value ?? "");
  const bio = tr.querySelector('[name="bio"]')?.value?.trim() ?? "";
  const image = tr.querySelector('[name="image"]')?.value?.trim() ?? "";

  return {
    name,
    age,
    isActive,
    skills,
    address: {
      city: city || "—",
      pincode: pincode ?? 0,
    },
    bio,
    image: image || PLACEHOLDER_IMAGE,
  };
}

/** Parse `{ message }` / `{ error }` from API JSON error bodies */
async function readApiErrorMessage(res) {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw);
    return j.message || j.error || raw || `HTTP ${res.status}`;
  } catch {
    return raw || `HTTP ${res.status}`;
  }
}

/**
 * DELETE /users/:_id — `_id` is MongoDB’s ObjectId string.
 * Checks res.ok so a 404/500 does not pretend the delete worked.
 */
async function deleteUser(_id) {
  console.log("[delete] 1. Started — raw _id from UI:", _id);

  const _idStr = String(_id || "").trim();
  if (!_idStr) {
    console.log("[delete] 2. Aborted — empty _id after trim");
    setFeedback("Invalid _id.", true);
    return;
  }

  const deleteUrl = `${API_URL}/${encodeURIComponent(_idStr)}`;
  console.log("[delete] 2. Normalized _id:", _idStr);
  console.log("[delete] 3. Request URL:", deleteUrl);

  setFeedback("");
  try {
    console.log("[delete] 4. Sending DELETE…");
    const res = await fetch(deleteUrl, {
      method: "DELETE",
      mode: "cors",
    });

    console.log("[delete] 5. Response status:", res.status, res.statusText);

    if (!res.ok) {
      const msg = await readApiErrorMessage(res);
      console.log("[delete] 6. Error body / message:", msg);
      throw new Error(msg);
    }

    console.log("[delete] 7. Success — refreshing user list");
    setFeedback("User deleted.");
    await loadUsers(true);
    console.log("[delete] 8. Done — list refreshed");
  } catch (err) {
    console.error("[delete] Failed at some step:", err);
    setFeedback(err.message || "Could not delete user.", true);
  }
}

async function saveUserRow(tr) {
  const _idStr = String(tr.dataset.mongodbId || "").trim();
  if (!_idStr) return;
  setFeedback("");
  const payload = readRowPayload(tr);
  if (!payload.name) {
    setFeedback("Name is required.", true);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/${encodeURIComponent(_idStr)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      mode: "cors",
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    setFeedback("User updated.");
    await loadUsers(true);
  } catch (err) {
    console.error(err);
    setFeedback(err.message || "Could not save user.", true);
  }
}

tbodyEl.addEventListener("click", (e) => {
  const delBtn = e.target.closest(".js-delete-user");
  if (delBtn) {
    const label = (delBtn.dataset.userName || "this user").trim();
    if (
      !window.confirm(
        `Delete user "${label}"?\n\nThis removes the record from the database.`,
      )
    ) {
      return;
    }
    deleteUser(delBtn.dataset.mongodbId);
    return;
  }
  const editBtn = e.target.closest(".js-edit-user");
  if (editBtn) {
    startEditRow(editBtn.dataset.mongodbId);
    return;
  }
  const saveBtn = e.target.closest(".js-save-user");
  if (saveBtn) {
    const tr = saveBtn.closest("tr");
    if (tr) saveUserRow(tr);
    return;
  }
  if (e.target.closest(".js-cancel-edit")) {
    loadUsers(true);
  }
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (window.location.protocol === "file:") {
    setFeedback("Open this app via npm run dev (not file://).", true);
    return;
  }
  setFeedback("");
  const fd = new FormData(addForm);
  const payload = buildUserPayloadFromFormData(fd);
  if (!payload.name) {
    setFeedback("Name is required.", true);
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      mode: "cors",
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    addForm.reset();
    const activeCb = addForm.querySelector('input[name="isActive"]');
    if (activeCb) activeCb.checked = true;
    setFeedback("User added.");
    await loadUsers(true);
  } catch (err) {
    console.error(err);
    setFeedback(err.message || "Could not add user.", true);
  }
});

retryBtn.addEventListener("click", () => {
  loadUsers(false);
});

async function loadUsers(silent) {
  if (window.location.protocol === "file:") {
    showOnly("error");
    errorMessageEl.textContent = formatErrorMessage(null, null);
    return;
  }

  if (!silent) {
    showOnly("loading");
    errorMessageEl.textContent = "";
    tbodyEl.innerHTML = "";
  }

  let httpStatus = null;

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      mode: "cors",
    });

    httpStatus = response.status;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("API did not return a JSON array.");
    }

    usersCache = data;
    successSummaryEl.textContent = `${data.length} user(s) — add new rows above or edit existing ones.`;

    const rows = data
      .filter((u) => mongoIdString(u))
      .map(renderReadRow)
      .join("");

    tbodyEl.innerHTML =
      data.length === 0
        ? `<tr><td colspan="9" class="cell-empty">No users yet. Add one using the form above.</td></tr>`
        : rows ||
          `<tr><td colspan="9" class="cell-empty">Users are missing <code>_id</code>. Check the API response.</td></tr>`;

    showOnly("success");
  } catch (err) {
    console.error(err);
    if (!silent) {
      showOnly("error");
      errorMessageEl.textContent = formatErrorMessage(err, httpStatus);
    } else {
      setFeedback(formatErrorMessage(err, httpStatus), true);
    }
  }
}

loadUsers(false);
