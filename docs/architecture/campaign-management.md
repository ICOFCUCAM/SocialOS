# Campaign Management

## Purpose

Campaigns provide a planning layer above individual social posts. Each campaign belongs to one organisation and one brand, and stores its objective, audience, key message, call to action, content pillars, selected channels, timeline, status and intended success metrics.

## Data model

Migration `20261110000700_campaign_management.sql` adds:
- `social_campaigns`: campaign strategy and lifecycle.
- `social_campaign_posts`: association between a campaign and existing posts from the same brand/workspace.

Campaign status values: draft, planned, active, paused, completed and archived. New campaigns may only be created as draft or planned.

The migration adds tenant-scoped read policies using the private brand-access helper. Mutations are performed through authenticated SECURITY DEFINER RPCs that verify workspace role, brand access and post/brand consistency. Campaign creation and edits write audit events.

## Application routes

- `/app/campaigns`: workspace campaign overview and status counts.
- `/app/campaigns/new`: campaign brief and planning form.
- `/app/campaigns/[campaignId]`: strategy overview, timeline, channels, pillars, success metrics and linked posts.

Campaigns are available in the workspace navigation.

## API

- `POST /api/social/campaigns`: create a campaign.
- `PATCH /api/social/campaigns/[campaignId]`: update its planning fields and lifecycle status.
- `POST /api/social/campaigns/[campaignId]/posts`: attach an existing post.

The API validates input sizes, supported channels, dates and status values. The database RPCs enforce tenant, role, brand and relationship boundaries independently of the UI.

## Workflow

1. Define a campaign for a brand.
2. Set the objective, audience, key message and CTA.
3. Choose channels and content pillars.
4. Set the campaign dates and intended success metrics.
5. Create individual posts in the existing AI Studio or Post Composer.
6. Link the relevant posts to the campaign.
7. Update the campaign lifecycle as work progresses.

Linking a post does not change its publishing schedule or status. Campaign status does not automatically schedule, pause or publish posts.

## Limitations

- Campaign success metrics are planning targets only. Live measurement and attribution are not implemented.
- Posts are linked after creation; campaign creation does not bulk-create posts.
- No approvals, budget management, paid media, cross-brand campaigns, automated content generation or campaign-level billing are included.
- No migration has been applied to a live SocialOS database. Apply migrations `0001`–`0015` in order in a dedicated SocialOS project before using these routes.
