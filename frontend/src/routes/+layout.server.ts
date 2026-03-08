import { logEnvStatus } from '$lib/server/envValidator.server';

let envLogged = false;

export function load() {
	if (!envLogged) {
		logEnvStatus();
		envLogged = true;
	}
}
