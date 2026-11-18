// Talks to the server. Errors come back as ApiError with the server's code (and per-field messages).
export class ApiError extends Error {
  constructor(code, status, fields = null) { super(code); this.code = code; this.status = status; this.fields = fields; }
}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { "X-Requested-With": "app", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("offline", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new ApiError(data.error ?? "server_error", res.status, data.fields ?? null); e.data = data; throw e; }
  return data;
}

/** Uploads a photo with real progress (fetch can't report upload progress). */
export function uploadPhoto(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/photos");
    xhr.setRequestHeader("X-Requested-With", "app");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data.error ?? "server_error", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("offline", 0));
    xhr.send(file);
  });
}
