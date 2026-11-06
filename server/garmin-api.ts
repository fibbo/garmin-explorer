// Client for the Garmin Connect Personal API:
// https://developer.garmin.com/gc-developer-program/personal/personal-api/
import { setTimeout as sleep } from "node:timers/promises";
import { unzipSync } from "fflate";
import { UserError } from "./data-dir.ts";

const BASE = "https://personal.connectapi.garmin.com";
const PAGE = 100;
const TIMEOUT_MS = 120_000;
const RETRIES = 3;
export const KEY_URL =
  "https://connect.garmin.com/app/settings/personalApiToken";

export class HttpError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`Garmin Connect returned HTTP ${status} for ${path}`);
    this.status = status;
  }
}

/** One activity as the API lists it, in SI units. Only the fields we read. */
export interface ApiActivity {
  activityId: number;
  activityName?: string | null;
  activityType: { typeKey: string };
  beginTimestamp?: number | null;
  startTimeGMT: string;
  startTimeLocal: string;
  manualActivity?: boolean;
  [field: string]: unknown;
}

/** Reports a retry, e.g. "HTTP 503, retrying in 10 s" */
type Log = (text: string) => void;

async function request(
  path: string,
  headers: Record<string, string>,
  log: Log,
  method = "GET",
) {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(BASE + path, {
        method,
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      const reason =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : String(error);
      throw new UserError(`Cannot reach Garmin Connect: ${reason}`);
    }
    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < RETRIES
    ) {
      const wait =
        Number(response.headers.get("Retry-After")) || 10 * 2 ** attempt;
      log(`HTTP ${response.status} from Garmin Connect, retrying in ${wait} s`);
      await sleep(wait * 1000);
      continue;
    }
    if (response.status === 401 && headers.Authorization.startsWith("ApiKey"))
      throw new UserError(
        `Garmin rejected the API key. It may have expired. Create a new one at ${KEY_URL}`,
      );
    throw new HttpError(response.status, path);
  }
}

export class GarminApi {
  #token: string;
  #log: Log;

  private constructor(token: string, log: Log) {
    this.#token = token;
    this.#log = log;
  }

  /** Exchanges the API key for an access token. */
  static async connect(key: string, log: Log) {
    const token = await request(
      "/personalapitoken-service/personal-api/personal-api-key/token",
      { Authorization: `ApiKey ${key}`, Accept: "*/*" },
      log,
      "POST",
    );
    return new GarminApi(new TextDecoder().decode(token).trim(), log);
  }

  #get(path: string, accept = "application/json") {
    return request(
      path,
      { Authorization: `Bearer ${this.#token}`, Accept: accept },
      this.#log,
    );
  }

  /** All activities, newest first */
  async activities() {
    const all: ApiActivity[] = [];
    for (;;) {
      const page = JSON.parse(
        new TextDecoder().decode(
          await this.#get(
            `/activitylist-service/activities/search/activities?start=${all.length}&limit=${PAGE}`,
          ),
        ),
      ) as ApiActivity[];
      all.push(...page);
      if (page.length < PAGE) return all;
    }
  }

  /** The original .fit files of an activity. None when Garmin has no file for it. */
  async fitFiles(activityId: number) {
    let zip: Uint8Array;
    try {
      zip = await this.#get(
        `/download-service/files/activity/${activityId}`,
        "*/*",
      );
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return [];
      throw error;
    }
    return Object.values(
      unzipSync(zip, { filter: (f) => f.name.toLowerCase().endsWith(".fit") }),
    );
  }
}
