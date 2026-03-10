# Analyte Health — Metric Definitions

**Version**: 2.0
**Date**: February 18, 2026
**Purpose**: Single source of truth for how every metric is defined, what it includes, and what it does not. All downstream reporting (dashboards, board decks, daily monitoring) must use these definitions.

---

## Table of Contents

1. [Order Value Metrics](#1-order-value-metrics)
2. [Order Metrics](#2-order-metrics)
3. [Refund Metrics](#3-refund-metrics)
4. [Product & Service Metrics](#4-product--service-metrics)
5. [Clinical Metrics](#5-clinical-metrics)
6. [Lab & Testing Metrics](#6-lab--testing-metrics)
7. [Marketing Metrics](#7-marketing-metrics)
8. [Order Timing Milestones](#8-order-timing-milestones)
9. [Entity Glossary](#9-entity-glossary)
10. [Brand Reference](#10-brand-reference)

---

## Two Ways to Count Orders

Every count and rate metric comes in two versions. Dollar amounts are the same in both — only the counts differ.

### Operational View ("Manage Orders")

Counts every manage system order individually. If a customer abandons one order and places another, that's **2 orders**. Use this for operations, order management, and reconciliation.

### Customer Journey View ("Customer Orders")

Groups orders by the customer's engagement. If a customer abandons one order and places another, that's **1 engagement**. Use this for analytics, LTV, marketing, and customer behavior.

---

## Understanding Time Grain Selection

All time-based metrics are available at multiple aggregation levels:

**Available grains**: day, week (Monday-Sunday), month, quarter, year

---

## 1. Order Value Metrics

### Gross Order Value

**What it measures**: Total dollar amount collected from customers through all payment methods before any refunds are subtracted.

**Calculation**: Sum of all payment amounts

**Includes**:
- Credit/debit card payments
- PayPal payments
- Other payment methods (cryptocurrency, ACH, etc.)
- Voucher-funded payments (gift cards, promotional credits)
- Transferred payments (payment moved from one order to another)

**Excludes**:
- Refunds (those are subtracted separately to get Net Order Value)
- Pending/failed payment attempts

---

### Net Order Value (Current Order Value)

**What it measures**: Money kept after refunds are returned to customers. This is the primary order value figure for all reporting.

**Calculation**: Gross Order Value − Refunds Processed

**Includes**:
- All items in Gross Order Value, minus completed refund amounts

**Excludes**:
- Refunds that are still in progress or failed
- Chargebacks (not tracked in this system)

**Important**: A refund is counted in the period it was *issued*, not when the original payment was made. If a customer paid in December and was refunded in January, the refund reduces January's net order value.

---

### Net Cash Order Value

**What it measures**: Order value from actual customer payments, excluding vouchers and promotional credits.

**Calculation**: Gross Order Value − Voucher Revenue

**Includes**:
- Card payments, PayPal, crypto, ACH

**Excludes**:
- Gift card redemptions
- Promotional credit redemptions
- Partner voucher payments

**Why it matters**: Vouchers represent value already collected (when the gift card was purchased) or given away (promotional). Net cash order value shows fresh money coming in the door.

---

### Average Order Value (AOV)

**What it measures**: How much order value the average order generates.

**Calculation**: Gross Order Value ÷ Number of Distinct Orders (with payments)

**Important nuance**: An "order" can have multiple payments (original + upsells). AOV uses the *order* as the unit, not the individual payment. This means upsells increase AOV rather than being counted as separate transactions.

**Excludes**:
- Orders with no payment data (unpaid orders)
- Canceled orders with no payments

---

## 2. Order Metrics

### Order Count

**What it measures**: Number of distinct customer orders placed in a period.

**Calculation**: Count of distinct order IDs

**Important**: One customer visit can generate one order. That order may have multiple *activities* (original payment, upsells, cross-brand add-ons), but it is still one order.

**Applies to**: All brands

---

### Order Activity Count

**What it measures**: Total number of payment-level events across all orders. This is a finer grain than Order Count because one order can have multiple activities.

**Calculation**: Count of all order activities

**Activity types**:

| Classification | What it means |
|---------------|---------------|
| **Original Order** | The initial paid transaction — one per order |
| **Upsell** | Additional items/services added after the original purchase on the same order |
| **Cross Brand Order** | Items purchased on a different brand within the same engagement (rare) |
| **No Payment Data** | Order exists but no payment has been recorded |

---

### Upsell Rate

**What it measures**: How often an original order leads to an additional upsell purchase.

**Calculation**: Upsell Activity Count ÷ Original Order Activity Count

**What this tells you**: A rate of 0.37 means that for every 100 original orders, 37 upsell events occurred. (Some orders may have more than one upsell.)

**Applies to**: Brands with payment data (not WalkInLab or Amazon variants, which show as "No Payment Data")

---

### Cancellation Rate

**What it measures**: Percentage of order activities that were canceled.

**Calculation**: Canceled Activity Count ÷ Total Activity Count

**Important**: A "canceled" order means the order status was set to Canceled in the system. This does not automatically mean a refund was issued — those are tracked separately.

---

### Unpaid Order Count

**What it measures**: Orders that exist in the system with "Active" status but have no associated payment.

**Calculation**: Count of activities where classification = "No Payment Data" and status = "Active"

**Why it matters**: These represent potential revenue collection gaps — orders placed but never paid for.

---

## 3. Refund Metrics

### Refund Rate

**What it measures**: What percentage of collected order value was returned to customers.

**Calculation**: Refunds Processed ÷ Gross Order Value

**Uses completed refunds only** — refunds that are still in progress or failed are not counted in the dollar amount.

---

### Same-Week Refund Rate

**What it measures**: Refunds issued in the same calendar week (Monday–Sunday) as the original payment, as a percentage of gross order value.

**Calculation**: Same-Week Refund Amount ÷ Gross Order Value

**Why it matters**: Same-week refunds are significant for agent commission calculations. A refund in the same commission period (Mon–Sun) offsets the agent's commission-eligible amount for that week.

---

### Refund Completion Rate

**What it measures**: Of all refunds initiated, what percentage were successfully processed.

**Calculation**: Completed Refund Count ÷ Total Refund Count

**Refund statuses**:

| Status | Meaning |
|--------|---------|
| **Completed** | Refund processed and returned to customer |
| **In Progress** | Refund initiated, not yet settled |
| **Failed** | Refund attempted but did not process |

---

## 4. Product & Service Metrics

### Product Mix (by Service Concept)

**What it measures**: The breakdown of what customers are buying, categorized by type of service.

**Categories**:

| Service Concept | What it includes | Notes |
|----------------|------------------|-------|
| **Testing** | Individual lab tests and test panels | Largest category |
| **Consultation** | Doctor consultations (async or scheduled) | |
| **Consultation Add-on** | Additional services attached to consultations | |
| **Discount** | Promotional discounts, coupons | Negative dollar values |
| **Consultation Discount** | Discounts specific to consultation services | Negative dollar values |
| **OTC** | Over-the-counter products | |
| **Convenience** | Convenience services (e.g., overnight shipping) | |
| **Medication Upsell** | Additional medications | |
| **Medication Delivery** | Delivery charges for medications | |
| **Fee** | State compliance fees | |

### Discount Rate

**What it measures**: How much of the sticker price is being given away as discounts.

**Calculation**: Total Discount Dollar Amount ÷ Gross Line Item Value (positive-priced items only)

**Note**: Discounts show as negative-priced line items in the order. This metric expresses the total discounts as a percentage of what the full price would have been.

---

## 5. Clinical Metrics

### Consultation Count

**What it measures**: Number of consultations created in the period, regardless of outcome.

**Includes all statuses**: Prescribed, Incomplete, Canceled, Pending, Disqualified, Declined, No Answer, ID Mismatched

**Applies to**: STDcheck, Starfish, TreatMyUTI, HealthLabs (PaternityLab/WalkInLab/Anonymous do not have consultations)

---

### Prescription Rate

**What it measures**: Of all consultations initiated, what percentage resulted in a prescription being written.

**Calculation**: Consultations with status "Prescribed" ÷ Total Consultations

**Why it varies**: Starfish and TreatMyUTI are consultation-first businesses (every order triggers a consultation). STDcheck and HealthLabs are test-first — consultations happen only for positive results or specific add-ons, so the denominator includes more consultations that may be incomplete or disqualified.

---

### Consultation Type Mix

**What it measures**: Split between asynchronous (patient fills out form, clinician reviews later) and scheduled (live video/phone appointment).

**Types**:

| Type | Description |
|------|-------------|
| **Async** | Patient submits intake form; clinician reviews and prescribes without a live appointment |
| **Scheduled** | Live video or phone appointment with a clinician |

---

### Disqualification Rate

**What it measures**: Percentage of consultations where the patient was disqualified from treatment (based on intake answers, age, contraindications, etc.).

**Calculation**: Consultations with status "Disqualified" ÷ Total Consultations

---

### Average Consultation Fee

**What it measures**: The average fee charged per consultation. This represents cost to the company (clinician compensation), not revenue from the patient.

**Calculation**: Sum of consultation fees ÷ consultation count

---

### Total Consultation Fee Spend

**What it measures**: Total clinician compensation cost for consultations in the period.

**Calculation**: Sum of all consultation fees

**Why it matters**: This is a direct cost line item. Combined with Net Order Value, it contributes to gross margin analysis.

---

## 6. Lab & Testing Metrics

### Positivity Rate

**What it measures**: Among lab tests with completed results, what percentage came back positive (abnormal/detected).

**Calculation**: Positive Test Count ÷ Completed Test Count

**Important**:
- Only tests with a final result are included in the denominator (pending tests are excluded)
- This is at the *individual test* level, not the order level (one order can have many tests)

**Notes**: STDcheck orders typically include broad screening panels (10+ tests per order), so per-test positivity rate is lower than brands where patients order more targeted tests. Starfish and TreatMyUTI are consultation-first models where lab results data flows differently.

---

### Tests Per Order

**What it measures**: Average number of individual lab tests included per order.

**Calculation**: Total Lab Tests ÷ Distinct Orders (with lab tests)

**Why it matters**: Reflects panel composition and test bundling strategy. Higher tests-per-order means patients are ordering broader panels.

---

## 7. Marketing Metrics

> **Available for Starfish and TreatMyUTI only.** Google Ads data for STDcheck and HealthLabs is not yet accessible.

### Ad Spend

**What it measures**: Total advertising dollars spent across all platforms.

**Platforms**: Google Ads, Bing Ads

---

### ROAS (Return on Ad Spend)

**What it measures**: How many dollars of gross order value are generated per dollar of advertising spent.

**Calculation**: Gross Order Value ÷ Ad Spend

**Caveat**: This is a blended ROAS across all campaigns and platforms. It uses gross order value (before refunds). For net ROAS, use Net Order Value instead.

---

### Cost Per Conversion

**What it measures**: How much ad spend is required to generate one conversion (as tracked by the ad platform).

**Calculation**: Ad Spend ÷ Conversions (from ad platform)

**Important**: "Conversion" is defined by the ad platform's tracking pixel — it may not match our internal order count exactly due to attribution differences, cookie limitations, and cross-device tracking gaps.

---

### CPC (Cost Per Click)

**What it measures**: Average cost for each ad click.

**Calculation**: Ad Spend ÷ Total Clicks

---

### CTR (Click-Through Rate)

**What it measures**: Percentage of people who saw an ad and clicked on it.

**Calculation**: Clicks ÷ Impressions

---

### CVR (Conversion Rate)

**What it measures**: Percentage of ad clicks that resulted in a conversion.

**Calculation**: Conversions ÷ Clicks

---

## 8. Order Timing Milestones

Order timing milestones measure how far an order progresses through the fulfillment lifecycle and how long each transition takes.

### How Milestones Work

Each order can reach (or not reach) a set of lifecycle milestones. A milestone is the **first occurrence** of a specific event type for that order. Not all orders reach all milestones — test-first brands (STDcheck, HealthLabs) rarely have consultations; consultation-first brands (Starfish, TreatMyUTI) always do.

For each milestone, three things are tracked:
- **Timestamp**: When the order first reached that milestone (NULL if never reached)
- **Duration**: Minutes from `order_placed` to that milestone (NULL if never reached)
- **Flag**: Boolean — did this order reach this milestone at all?

### Milestone Definitions

#### Order Placed

**What it measures**: When the order was created in the system.

**Coverage**: 100% of orders. This is the baseline timestamp — all durations are measured from this point.

---

#### First Payment

**What it measures**: When the first payment was successfully created for this order.

**Coverage**: ~86% of orders

**Typical timing**: Under 1 minute from order placed (payment is near-simultaneous with checkout)

**Why some orders miss this**: Orders abandoned before payment, or orders created by internal tools without payment.

---

#### First Consultation

**What it measures**: When a clinician consultation was first created for this order.

**Coverage**: ~38% of orders overall. Near 100% for Starfish and TreatMyUTI; near 0% for STDcheck and HealthLabs unless a positive test triggers a follow-up.

**Typical timing**: Under 1 minute from order placed for consultation-first brands (created as part of checkout).

**Why some orders miss this**: Test-first brands create consultations only when medically indicated.

---

#### Consultation Prescribed

**What it measures**: When the first consultation for this order resulted in a prescription being written by a clinician.

**Coverage**: ~31% of orders overall. Subset of orders that reached consultation.

**Typical timing**: ~2 hours (median) from consultation created. ~10 hours at the 90th percentile. This reflects clinician review time for async consultations.

**Why some orders miss this**: Not all consultations result in prescriptions — patients may be disqualified, decline treatment, not answer, or have their consultation canceled.

---

#### Requisition Sent

**What it measures**: When the lab requisition was sent for this order, enabling the patient to visit a lab for specimen collection.

**Coverage**: ~41% of orders

**Typical timing**: ~2 minutes from order placed. Requisitions are generated automatically after payment for test-first brands.

**Why some orders miss this**: Consultation-first orders (Starfish, TreatMyUTI) often don't involve lab work. Canceled/unpaid orders never reach requisition.

---

#### Lab Assigned

**What it measures**: When a specific lab location was assigned to this order for specimen collection.

**Coverage**: Lower than requisition — not all requisitioned orders get a lab assigned.

**Notes**: Lab assignment may happen before or after requisition, depending on the order flow.

---

### Derived Dimensions

These are computed from milestone data and available as dimensions for grouping/filtering:

#### Clinical Speed

**What it measures**: How quickly a consultation went from created to prescribed (clinician turnaround).

**Buckets**:

| Bucket | Rule | Typical meaning |
|--------|------|-----------------|
| Under 1 hour | Prescribed within 60 minutes | Fast async review |
| 1–4 hours | Prescribed within 4 hours | Standard async turnaround |
| Same day | Prescribed within 24 hours | End-of-day batch or scheduled appointment |
| Over 1 day | Over 24 hours | Delayed review, weekend/holiday |

**Applies to**: Only orders where a prescription was written.

---

### Event Counts

These are per-order counts of specific event types, useful for understanding order complexity:

| Count | What it measures |
|-------|-----------------|
| Payment count | Number of payment events (1 = single payment, 2+ = upsells or payment retries) |
| Consultation count | Number of consultations created (usually 0 or 1) |
| Address change count | Number of address updates (0 = no changes, 1+ = address corrections) |

---

## 9. Entity Glossary

Core business objects that all metrics are built from.

| Entity | What it represents | Key detail |
|--------|--------------------|------------|
| **Member** | A unique person across all brands and accounts | One member may have multiple accounts across websites |
| **Engagement** | A customer journey from order through all follow-up activities | One engagement = one member + one primary brand |
| **Order Activity** | A payment-level event within an order | One order can have multiple activities (original payment, upsells) |
| **Order Line** | An individual item on an order | A specific test, consultation, product, discount, or fee |
| **Payment** | A payment transaction linked to one order activity | Includes dollar amount, method, and voucher/transfer flag |
| **Refund** | A refund against a specific payment | One payment may have multiple partial refunds |
| **Consultation** | A clinician interaction tied to an order | Tracks type (async/scheduled), status, clinician, and fee |
| **Lab Order** | A lab requisition tied to an order | Contains one or more individual lab tests |
| **Lab Test** | An individual test within a lab order | Has result status (normal/abnormal/pending) and positive/negative classification |
| **Ads (Campaign)** | Daily ad performance for one campaign on one platform | Currently available for Starfish and TreatMyUTI only |

---

## 10. Brand Reference

| Brand | Business Model | Consultations? | Lab Tests? | Ads Data? |
|-------|---------------|----------------|------------|-----------|
| **STDcheck** | Test-first STD screening | Yes (for positive results) | Yes | No |
| **HealthLabs** | Test-first general health | Yes (limited) | Yes | No |
| **Starfish** | Consultation-first STD treatment | Yes (every order) | Yes | Yes |
| **TreatMyUTI** | Consultation-first UTI treatment | Yes (every order) | Yes | Yes |
| **WalkInLab** | Walk-in lab testing | No | Yes | No |
| **PaternityLab** | Paternity testing | No | Yes (different result model) | No |
| **Anonymous** | Anonymous orders | No | No | No |
| **Stallion** | New brand (Feb 2026) | TBD | TBD | No |

---

## What's Not Included Yet

These metrics are **planned but blocked** by missing data sources:

| Metric | What's needed | Status |
|--------|---------------|--------|
| New vs Returning Customers | Member entity needs first_order_date field | Planned |
| Customer Lifetime Value | Member entity needs lifetime_revenue field | Planned |
| Customer Acquisition Cost (all brands) | Google Ads access for STDcheck/HealthLabs | Waiting on access |
| Website Conversion Rate | GA4 pipeline (sessions, users) | Waiting on GA4 export |
| Traffic / Sessions | GA4 pipeline | Waiting on GA4 export |
| Chargeback Rate | Chargeback data not in current pipeline | Not started |
