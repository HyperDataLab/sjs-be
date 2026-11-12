function apiBase(env) {
	const projectId = env.FIREBASE_PROJECT_ID;
	const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
	if (!projectId) throw new Error("Firebase project is not configured");
	return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;
}

export function firestoreValue(value) {
	if (typeof value === "string") return { stringValue: value };
	if (value instanceof Date) return { timestampValue: value.toISOString() };
	throw new TypeError("Unsupported Firestore value");
}

function decodeValue(value) {
	if ("stringValue" in value) return value.stringValue;
	if ("timestampValue" in value) return value.timestampValue;
	return null;
}

function decodeProject(document) {
	const fields = document.fields ?? {};
	return {
		id: document.name.split("/").at(-1),
		title: decodeValue(fields.title ?? {}),
		subjectAreaId: decodeValue(fields.subjectAreaId ?? {}),
		status: decodeValue(fields.status ?? {}),
		createdAt: decodeValue(fields.createdAt ?? {}),
		updatedAt: decodeValue(fields.updatedAt ?? {}),
	};
}

async function firestoreFetch(url, token, init = {}) {
	const response = await fetch(url, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...init.headers,
		},
	});
	if (!response.ok) {
		const error = new Error("Firestore request failed");
		error.status = response.status;
		throw error;
	}
	return response.json();
}

export async function listUserProjects(env, token, uid, pageToken) {
	const url = new URL(`${apiBase(env)}/users/${encodeURIComponent(uid)}/projects`);
	url.searchParams.set("pageSize", "100");
	if (pageToken) url.searchParams.set("pageToken", pageToken);
	const result = await firestoreFetch(url, token);
	return {
		projects: (result.documents ?? []).map(decodeProject),
		nextPageToken: result.nextPageToken ?? null,
	};
}

export async function createUserProject(env, token, uid, project) {
	const projectId = crypto.randomUUID();
	const url = new URL(`${apiBase(env)}/users/${encodeURIComponent(uid)}/projects`);
	url.searchParams.set("documentId", projectId);
	const now = new Date();
	const result = await firestoreFetch(url, token, {
		method: "POST",
		body: JSON.stringify({
			fields: {
				title: firestoreValue(project.title),
				subjectAreaId: firestoreValue(project.subjectAreaId),
				status: firestoreValue("draft"),
				createdAt: firestoreValue(now),
				updatedAt: firestoreValue(now),
			},
		}),
	});
	return decodeProject(result);
}
