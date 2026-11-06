#!/usr/bin/env python3
"""Sync activities from Garmin Connect into data/ using the Garmin Connect Personal API.

Usage:
    GARMIN_API_KEY=... python3 sync.py [--out data]

Create the key at https://connect.garmin.com/app/settings/personalApiToken.
Refreshes the summaries of all activities and downloads the .fit file of every
activity that has none in data/fit/ yet. Works on top of an export prepared
with prepare_data.py or on an empty data/ folder.
Requires: pip install fitdecode
"""

import argparse
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import UTC, datetime

from prepare_data import fit_path, read_index, save_fit, scan_fit, write_index

BASE = "https://personal.connectapi.garmin.com"
PAGE = 100


class Api:
    def __init__(self, key):
        self.token = (
            self._request(
                "POST",
                "/personalapitoken-service/personal-api/personal-api-key/token",
                {"Authorization": f"ApiKey {key}"},
            )
            .decode()
            .strip()
        )

    def _request(self, method, path, headers, accept="*/*"):
        for attempt in range(4):
            req = urllib.request.Request(
                BASE + path, method=method, headers={**headers, "Accept": accept}
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    return resp.read()
            except urllib.error.HTTPError as e:
                if (e.code == 429 or e.code >= 500) and attempt < 3:
                    wait = int(e.headers.get("Retry-After") or 0) or 10 * 2**attempt
                    print(f"  HTTP {e.code} on {path}, retrying in {wait}s", flush=True)
                    time.sleep(wait)
                    continue
                if e.code == 401 and "Bearer" not in str(headers):
                    sys.exit(
                        "Garmin rejected the API key. It may have expired; create a new one at "
                        "https://connect.garmin.com/app/settings/personalApiToken"
                    )
                raise
            except urllib.error.URLError as e:
                sys.exit(f"Cannot reach Garmin Connect: {e.reason}")

    def get(self, path, accept="application/json"):
        return self._request(
            "GET", path, {"Authorization": f"Bearer {self.token}"}, accept
        )

    def activities(self):
        acts, start = [], 0
        while True:
            page = json.loads(
                self.get(
                    f"/activitylist-service/activities/search/activities?start={start}&limit={PAGE}"
                )
            )
            acts += page
            start += len(page)
            if len(page) < PAGE:
                return acts

    def fit_files(self, activity_id):
        try:
            data = self.get(
                f"/download-service/files/activity/{activity_id}", accept="*/*"
            )
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            raise
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return [z.read(n) for n in z.namelist() if n.lower().endswith(".fit")]


def as_utc_ms(s):
    """'2026-10-27 11:50:41' -> ms. For startTimeLocal this gives the wall clock as ms, like the export."""
    return int(
        datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC).timestamp() * 1000
    )


def r(v, nd):
    return None if v is None else round(v, nd)


def summarize(a):
    """Personal API activity (SI units) -> the summary format of data/index.json."""
    zones = [a.get(f"hrTimeInZone_{i}") for i in range(7)]
    return {
        "id": a["activityId"],
        "name": a.get("activityName") or a["activityType"]["typeKey"],
        "type": a["activityType"]["typeKey"],
        "start": a.get("beginTimestamp")
        or as_utc_ms(a["startTimeGMT"]),  # multi-sport parents lack beginTimestamp
        "local": as_utc_ms(a["startTimeLocal"]),
        "loc": a.get("locationName") or None,
        "dist": r(a.get("distance"), 1),
        "dur": r(a.get("duration"), 1),
        "mov": r(a.get("movingDuration"), 1),
        "elapsed": r(a.get("elapsedDuration"), 1),
        "spd": r(a.get("averageSpeed"), 3),
        "maxSpd": r(a.get("maxSpeed"), 3),
        "hr": a.get("averageHR"),
        "maxHr": a.get("maxHR"),
        "up": r(a.get("elevationGain"), 1),
        "down": r(a.get("elevationLoss"), 1),
        "cal": r(a.get("calories"), 0),
        "cad": a.get("averageRunningCadenceInStepsPerMinute")
        or a.get("averageBikingCadenceInRevPerMinute"),
        "pwr": a.get("avgPower"),
        "np": a.get("normPower"),
        "maxPwr": a.get("maxPower"),
        "te": a.get("aerobicTrainingEffect"),
        "ate": a.get("anaerobicTrainingEffect"),
        "teLabel": a.get("trainingEffectLabel"),
        "load": r(a.get("activityTrainingLoad"), 0),
        "steps": a.get("steps"),
        "laps": a.get("lapCount"),
        "zones": [round(z or 0) for z in zones] if any(zones) else None,
        "fav": bool(a.get("favorite")),
        "pr": bool(a.get("pr")),
        "lat": a.get("startLatitude"),
        "lon": a.get("startLongitude"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
    )
    args = ap.parse_args()
    key = os.environ.get("GARMIN_API_KEY", "").strip()
    if not key:
        sys.exit(
            "Set GARMIN_API_KEY to a key from https://connect.garmin.com/app/settings/personalApiToken"
        )

    os.makedirs(args.out, exist_ok=True)
    known = {a["id"]: a for a in read_index(args.out)}
    api = Api(key)
    remote = api.activities()
    print(f"{len(remote)} activities on Garmin Connect, {len(known)} in {args.out}")

    # New activities, and known ones whose recording is missing from data/fit/
    todo = []
    for raw in remote:
        s = summarize(raw)
        if s["id"] in known:
            # Keep what the API lacks (VO2 max, sport, track flags) and the export's finer HR zones (0-6).
            old = known[s["id"]]
            old.update(
                {
                    k: v
                    for k, v in s.items()
                    if v not in (None, "") and not (k == "zones" and old.get(k))
                }
            )
            if old.get("track") and not os.path.exists(fit_path(args.out, old["id"])):
                todo.append((old, raw))
        else:
            s.update(track=False, gps=False, vo2=None)
            known[s["id"]] = s
            todo.append((s, raw))

    acts = list(known.values())
    for i, (act, raw) in enumerate(todo, 1):
        act["track"] = False
        if os.path.exists(fit_path(args.out, act["id"])):
            with open(fit_path(args.out, act["id"]), "rb") as fh:
                files = [fh.read()]
        elif raw.get("manualActivity"):
            files = []
        else:
            files = api.fit_files(act["id"])
        for data in files:
            info = scan_fit(data)
            if save_fit(args.out, act, data, info):
                act["vo2"] = act.get("vo2") or info["vo2"]
                break
        print(
            f"  {i}/{len(todo)} {datetime.fromtimestamp(act['local'] / 1000, UTC):%Y-%m-%d} "
            f"{act['name']}{'' if act['track'] else ' (no recording)'}",
            flush=True,
        )
        if i % 50 == 0:
            write_index(args.out, acts)
    write_index(args.out, acts)
    print(f"Done: {len(todo)} activities updated. Wrote {args.out}")


if __name__ == "__main__":
    main()
