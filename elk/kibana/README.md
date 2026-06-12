# Kibana saved objects

Versioned export of the Kibana saved objects for the Orion observability stack,
so the dashboard is reproducible from the repository (it is otherwise only stored
inside the `es-data` Docker volume).

`orion-dashboard.ndjson` contains:

- the **data view** `orion-logs-*` (time field `@timestamp`);
- the **dashboard** "Orion — Observabilité" and its five visualizations
  (embedded by value): volume by tier, HTTP errors by status, HTTP status
  distribution, backend response time, log distribution by tier.

## Import into a fresh Kibana

Bring up the ELK stack, then import the objects:

```bash
docker compose -f docker-compose-elk.yml up -d

curl -s -X POST 'http://localhost:5601/api/saved_objects/_import?overwrite=true' \
  -H 'kbn-xsrf: true' \
  -F file=@elk/kibana/orion-dashboard.ndjson
```

Then open Kibana (http://localhost:5601) → **Dashboard** → "Orion — Observabilité".

> Alternatively, import via the UI: **Stack Management → Saved Objects → Import**.

## Re-export after changes

If you edit the dashboard in Kibana and want to version the new state:

```bash
curl -s -X POST 'http://localhost:5601/api/saved_objects/_export' \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"type":["dashboard"],"includeReferencesDeep":true}' \
  -o elk/kibana/orion-dashboard.ndjson
```
