import { FirebaseCertificateError, verifyFirebaseIdToken } from "./firebase-auth.js";
import { createUserProject, listUserProjects } from "./firestore.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const DEV_LOGIN_TOKEN = "dev-only-token";
const devProjects = new Map();

function allowedOrigins(env) {
	return new Set(
		(env.ALLOWED_ORIGINS ?? "")
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean),
	);
}

function corsHeaders(request, env) {
	const origin = request.headers.get("Origin");
	const headers = new Headers({ Vary: "Origin" });
	if (origin && allowedOrigins(env).has(origin)) {
		headers.set("Access-Control-Allow-Origin", origin);
		headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
		if (request.method === "OPTIONS") headers.set("Access-Control-Max-Age", "86400");
	}
	return headers;
}

function jsonResponse(request, env, body, status = 200) {
	const headers = corsHeaders(request, env);
	for (const [name, value] of Object.entries(JSON_HEADERS)) headers.set(name, value);
	return new Response(JSON.stringify(body), { status, headers });
}

function bearerToken(request) {
	const authorization = request.headers.get("Authorization") ?? "";
	const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
	return match?.[1] ?? null;
}

function firestoreErrorResponse(request, env, error) {
	if (error.status === 403) {
		return jsonResponse(request, env, { error: "firestore_permission_denied" }, 403);
	}
	if (error.status === 404) {
		return jsonResponse(request, env, { error: "firestore_not_ready" }, 503);
	}
	return jsonResponse(request, env, { error: "firestore_unavailable" }, 502);
}

async function authenticatedUser(request, env) {
	const token = bearerToken(request);
	if (!token) return { response: jsonResponse(request, env, { error: "unauthorized" }, 401) };
	if (env.DEV_AUTH_ENABLED === "true" && token === DEV_LOGIN_TOKEN) {
		return {
			token,
			user: { uid: "dev-user", email: "dev@example.test", isDev: true },
		};
	}
	if (!env.FIREBASE_PROJECT_ID) {
		return { response: jsonResponse(request, env, { error: "firebase_not_configured" }, 503) };
	}

	try {
		const user = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
		return { token, user };
	} catch (error) {
		if (error instanceof FirebaseCertificateError) {
			return {
				response: jsonResponse(request, env, { error: "firebase_auth_unavailable" }, 503),
			};
		}
		return { response: jsonResponse(request, env, { error: "unauthorized" }, 401) };
	}
}

async function handleRequest(request, env) {
	const origin = request.headers.get("Origin");
	if (origin && !allowedOrigins(env).has(origin)) {
		return jsonResponse(request, env, { error: "origin_not_allowed" }, 403);
	}
	if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });

	const url = new URL(request.url);
	if (url.pathname === "/" && request.method === "GET") {
		return new Response("Hello World!", {
			headers: { ...Object.fromEntries(corsHeaders(request, env)), "Content-Type": "text/plain; charset=utf-8" },
		});
	}
	if (url.pathname === "/api/v1/dev/login") {
		if (env.DEV_AUTH_ENABLED !== "true") {
			return jsonResponse(request, env, { error: "not_found" }, 404);
		}
		if (request.method !== "POST") {
			return jsonResponse(request, env, { error: "method_not_allowed" }, 405);
		}
		return jsonResponse(request, env, {
			token: DEV_LOGIN_TOKEN,
			user: { uid: "dev-user", email: "dev@example.test" },
		});
	}
	if (url.pathname === "/health" && request.method === "GET") {
		return jsonResponse(request, env, { status: "ok" });
	}
	if (url.pathname === "/api/v1/me" && request.method === "GET") {
		const auth = await authenticatedUser(request, env);
		if (auth.response) return auth.response;
		return jsonResponse(request, env, { uid: auth.user.uid, email: auth.user.email ?? null });
	}
	if (url.pathname === "/api/v1/projects") {
		if (request.method !== "GET" && request.method !== "POST") {
			return jsonResponse(request, env, { error: "method_not_allowed" }, 405);
		}
		const auth = await authenticatedUser(request, env);
		if (auth.response) return auth.response;

		try {
			if (request.method === "GET") {
				const pageToken = url.searchParams.get("pageToken") ?? undefined;
				if (pageToken && pageToken.length > 4096) {
					return jsonResponse(request, env, { error: "invalid_page_token" }, 400);
				}
				if (auth.user.isDev) {
					return jsonResponse(request, env, {
						projects: devProjects.get(auth.user.uid) ?? [],
						nextPageToken: null,
					});
				}
				return jsonResponse(
					request,
					env,
					await listUserProjects(env, auth.token, auth.user.uid, pageToken),
				);
			}

			let body;
			try {
				body = await request.json();
			} catch {
				return jsonResponse(request, env, { error: "invalid_json" }, 400);
			}
			if (!body || typeof body !== "object" || Array.isArray(body)) {
				return jsonResponse(request, env, { error: "invalid_project" }, 400);
			}
			const keys = Object.keys(body);
			if (keys.some((key) => !["title", "subjectAreaId"].includes(key))) {
				return jsonResponse(request, env, { error: "invalid_project_fields" }, 400);
			}
			const title = typeof body.title === "string" ? body.title.trim() : "";
			const subjectAreaId = typeof body.subjectAreaId === "string" ? body.subjectAreaId.trim() : "";
			if (!title || title.length > 200 || !subjectAreaId || subjectAreaId.length > 120) {
				return jsonResponse(request, env, { error: "invalid_project" }, 400);
			}
			if (auth.user.isDev) {
				const now = new Date().toISOString();
				const project = {
					id: crypto.randomUUID(),
					title,
					subjectAreaId,
					status: "draft",
					createdAt: now,
					updatedAt: now,
				};
				const projects = devProjects.get(auth.user.uid) ?? [];
				projects.unshift(project);
				devProjects.set(auth.user.uid, projects);
				return jsonResponse(request, env, project, 201);
			}

			const project = await createUserProject(env, auth.token, auth.user.uid, {
				title,
				subjectAreaId,
			});
			return jsonResponse(request, env, project, 201);
		} catch (error) {
			return firestoreErrorResponse(request, env, error);
		}
	}

	return jsonResponse(request, env, { error: "not_found" }, 404);
}

export default {
	async fetch(request, env) {
		try {
			return await handleRequest(request, env);
		} catch {
			return jsonResponse(request, env, { error: "internal_error" }, 500);
		}
	},
};
