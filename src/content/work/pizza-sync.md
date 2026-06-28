---
title: Pizza Sync
publishDate: 2026-06-13 00:00:00
img: /assets/pizza.jpg
img_alt: Close-up of a pizza with colorful toppings
description: |
  A group pizza ordering bot that lives in iMessage. Text your preference,
  get back a calculated recommendation — no app, no link, no friction.
tags:
  - Bot
  - iMessage
  - Backend
---

## Origin: Agent Native Company Hackathon

Pizza Sync was built at the [Agent Native Company Hackathon](https://luma.com/kxnzm12b) in Sunnyvale, CA — a single-day event (9:30 AM to 5 PM) organized by Beta University with co-hosts Butterbase and EverMind. The premise: intelligence is cheap and fast now, so the bottleneck is execution. Teams of 1–2 had one day to ship something real.

The initial version — iMessage bot connected, votes flowing, results endpoint live — came together in roughly three hours. The MVP Speed-Run track rewarded exactly that: fast deployment to a messaging platform with a working demo. Three minutes, three slides, done.

## The problem

Group pizza orders are a surprisingly hard coordination problem. Someone has to collect preferences, remember who's gluten-free, tally the votes, and then actually decide. It's a lot of overhead for a Friday lunch.

Pizza Sync moves that whole loop into iMessage — the one app everyone already has open.

## How it works

The bot runs on [Spectrum](https://photon.codes/docs/spectrum-ts), an SDK that bridges an agent loop to messaging providers. The iMessage provider handles inbound and outbound messages; the bot's logic sits in a simple async event loop that pattern-matches on incoming text.

Participants text their preference — `cheese`, `pepperoni`, `veggie`, or `gluten` — and get an immediate confirmation. When anyone texts `results`, the bot returns a live link to a [Butterbase](https://butterbase.ai) serverless function that aggregates votes and produces a pizza-by-pizza breakdown: how many of each type to order, with gluten-free needs surfaced separately.

No group chat thread to lose. No shared spreadsheet. No one has to remember to forward the form link.

## Architecture

- **Spectrum + iMessage** — the messaging layer. One long-running Node process, a for-await loop over incoming messages.
- **Butterbase function** (`/fn/pizza-calculator`) — the computation layer. Stateless endpoint that receives a session ID, queries the vote store, and returns a JSON payload with the order breakdown.
- **Separated concerns** — the bot itself stores nothing. Vote state lives in Butterbase; the bot just routes messages and hands back the API URL.

This separation means the bot stays small and replaceable — the calculation logic can be updated, retested, or swapped out entirely without touching the messaging layer.

## What I'd do differently

The current flow hands participants a raw API URL when they text `results`, which isn't pretty. A next iteration would format the results inline as a reply — e.g., *"Order 2 cheese, 1 pepperoni, 1 gluten-free veggie"* — so participants never leave iMessage at all. That's a one-line change once the aggregation logic is finalized.
