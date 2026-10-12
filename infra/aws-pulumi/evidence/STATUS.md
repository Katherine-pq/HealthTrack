# HealthTrack AWS deployment status

- Verified at: `2026-10-12T11:49:59-05:00`
- Pulumi stack: `production`
- AWS account: `948218213320`
- Region: `us-east-1`
- Public URL: <https://d2j9gtscg2zs3p.cloudfront.net>
- CloudFront distribution: `ER1FTS9SE24SC` (`Deployed`, WAF attached)
- ECS: `2/2` tasks running, rollout completed
- RDS: PostgreSQL `18.6`, private, encrypted, Multi-AZ, deletion protection enabled
- CloudTrail: logging enabled
- Public smoke test: health, readiness, registration, login, session, device, sync, dashboard and logout passed
- Pulumi reconciliation: `62 unchanged`

The current AWS account plan limits automated RDS backup retention to one day.
The reusable stack default remains seven days for an upgraded account plan.
