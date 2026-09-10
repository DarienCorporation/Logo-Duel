const API_BASE =
  window.LOGO_DUEL_API_BASE ||
  (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:5050/api"
      : "/api"
  );

let ownerToken =
  sessionStorage.getItem("logo_duel_owner_token") || "";

function getAuthHeaders() {
  return ownerToken
    ? {
        Authorization: `Bearer ${ownerToken}`
      }
    : {};
}

async function apiRequest(path, options = {}) {
  const isFormData =
    options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(!isFormData
      ? {
          "Content-Type":
            "application/json"
        }
      : {}),
    ...(options.headers || {}),
    ...getAuthHeaders()
  };

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers
    }
  );

  let data = null;

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    data = await response.json();
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        `Request failed (${response.status})`
    );

    error.status =
      response.status;

    throw error;
  }

  return data;
}


/* =========================
   BACKEND HEALTH
========================= */

async function checkBackend() {
  return apiRequest(
    "/health"
  );
}


/* =========================
   OWNER LOGIN
========================= */

async function ownerLogin(passcode) {
  const result =
    await apiRequest(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          passcode
        })
      }
    );

  if (!result?.token) {
    throw new Error(
      "Server did not return an owner token."
    );
  }

  ownerToken =
    result.token;

  sessionStorage.setItem(
    "logo_duel_owner_token",
    ownerToken
  );

  return result;
}


function ownerLogout() {
  ownerToken = "";

  sessionStorage.removeItem(
    "logo_duel_owner_token"
  );
}


function isOwnerAuthenticated() {
  return Boolean(ownerToken);
}


/* =========================
   LOGOS
========================= */

async function getLogos() {
  const result =
    await apiRequest(
      "/logos"
    );

  return Array.isArray(
    result?.logos
  )
    ? result.logos
    : [];
}


async function createLogo(data) {
  return apiRequest(
    "/logos",
    {
      method: "POST",
      body: JSON.stringify(data)
    }
  );
}


async function uploadLogo({
  name,
  version,
  mark,
  colorIndex,
  file
}) {
  const formData =
    new FormData();

  formData.append(
    "name",
    name
  );

  formData.append(
    "version",
    version
  );

  formData.append(
    "mark",
    mark || ""
  );

  formData.append(
    "colorIndex",
    String(
      colorIndex ?? 0
    )
  );

  formData.append(
    "image",
    file
  );

  return apiRequest(
    "/logos",
    {
      method: "POST",
      body: formData
    }
  );
}


async function updateLogo(
  id,
  data
) {
  return apiRequest(
    `/logos/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data)
    }
  );
}


async function deleteLogo(id) {
  return apiRequest(
    `/logos/${encodeURIComponent(id)}`,
    {
      method: "DELETE"
    }
  );
}


async function reorderLogos(
  ids
) {
  return apiRequest(
    "/logos/reorder",
    {
      method: "PUT",
      body: JSON.stringify({
        ids
      })
    }
  );
}


/* =========================
   TEST
========================= */

async function getTest(
  testId
) {
  return apiRequest(
    `/tests/${encodeURIComponent(testId)}`
  );
}


async function updateTest(
  testId,
  data
) {
  return apiRequest(
    `/tests/${encodeURIComponent(testId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data)
    }
  );
}


/* =========================
   SESSION
========================= */

function getSessionId() {
  let id =
    sessionStorage.getItem(
      "logo_duel_session_id"
    );

  if (!id) {
    id =
      window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `session-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    sessionStorage.setItem(
      "logo_duel_session_id",
      id
    );
  }

  return id;
}


/* =========================
   VOTES
========================= */

async function submitVote({
  testId,
  logoAId,
  logoBId,
  winnerId,
  loserId
}) {
  return apiRequest(
    "/votes",
    {
      method: "POST",
      body: JSON.stringify({
        testId,
        sessionId:
          getSessionId(),
        logoAId,
        logoBId,
        winnerId,
        loserId,
        skipped: false
      })
    }
  );
}


async function skipVote({
  testId,
  logoAId,
  logoBId
}) {
  return apiRequest(
    "/votes",
    {
      method: "POST",
      body: JSON.stringify({
        testId,
        sessionId:
          getSessionId(),
        logoAId,
        logoBId,
        skipped: true
      })
    }
  );
}


async function getResults(
  testId
) {
  return apiRequest(
    `/votes/results/${encodeURIComponent(testId)}`
  );
}


/* =========================
   IMAGE URL
========================= */

function getLogoImageUrl(
  logo
) {
  if (!logo) {
    return null;
  }

  if (logo.imageUrl) {
    return logo.imageUrl;
  }

  if (logo.image_url) {
    return logo.image_url;
  }

  if (logo.imageFileId) {
    return `${API_BASE}/logos/image/${logo.imageFileId}`;
  }

  return null;
}


/* =========================
   EXPORT
========================= */

window.LogoDuelAPI = {
  API_BASE,

  checkBackend,

  ownerLogin,
  ownerLogout,
  isOwnerAuthenticated,

  getLogos,
  createLogo,
  uploadLogo,
  updateLogo,
  deleteLogo,
  reorderLogos,

  getTest,
  updateTest,

  getSessionId,

  submitVote,
  skipVote,
  getResults,

  getLogoImageUrl
};