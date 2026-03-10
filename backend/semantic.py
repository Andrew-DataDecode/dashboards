"""
Embedded Semantic Layer — direct BigQuery access via ibis.

Drop-in replacement for mcp_client.py's MCP-over-HTTP pattern.
Connects directly to BigQuery and exposes the same interface:

    MCP_TOOLS  — tool definitions for Claude API
    call_tool(tool_name, tool_input) -> str  — async function

No imports from semantic_layer/, connection.py, or analytics_platform/.
"""

import json
import os
import re
from typing import Optional

import ibis
from boring_semantic_layer import to_semantic_table, time_dimension
from google.oauth2 import service_account

# ---------------------------------------------------------------------------
# Tool definitions for Claude API (identical to mcp_client.py)
# ---------------------------------------------------------------------------

MCP_TOOLS = [
    {
        "name": "list_models",
        "description": "List all available semantic models with their dimensions and measures. Use this first to discover what data is available.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_model",
        "description": "Get detailed information about a specific semantic model including its dimensions and measures.",
        "input_schema": {
            "type": "object",
            "properties": {
                "model_name": {
                    "type": "string",
                    "description": "Name of the model (e.g. 'payment', 'engagement', 'order_activity')",
                },
            },
            "required": ["model_name"],
        },
    },
    {
        "name": "query_model",
        "description": "Query a semantic model and return results as JSON. Use dimensions for grouping, measures for aggregation, filters for WHERE clauses, and time_grain for date bucketing.",
        "input_schema": {
            "type": "object",
            "properties": {
                "model_name": {
                    "type": "string",
                    "description": "Name of the model to query",
                },
                "dimensions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Dimension names to group by",
                },
                "measures": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Measure names to aggregate",
                },
                "filters": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter expressions, e.g. [\"manage_brand = 'STDcheck'\", \"payment_date >= '2026-02-01'\"]",
                },
                "time_grain": {
                    "type": "string",
                    "enum": [
                        "TIME_GRAIN_DAY",
                        "TIME_GRAIN_WEEK",
                        "TIME_GRAIN_MONTH",
                        "TIME_GRAIN_QUARTER",
                        "TIME_GRAIN_YEAR",
                    ],
                    "description": "Time grain for time dimensions",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum rows to return (default 100)",
                    "default": 100,
                },
            },
            "required": ["model_name", "dimensions", "measures"],
        },
    },
]

# ---------------------------------------------------------------------------
# BigQuery connection (ibis, no project-internal imports)
# ---------------------------------------------------------------------------

_conn = None


def _get_connection():
    global _conn
    if _conn is not None:
        return _conn

    # Try centralized env_config first, fall back to env vars for Docker/Cloud Run
    try:
        import sys
        from pathlib import Path

        _project_root = Path(__file__).resolve().parent.parent.parent.parent
        _core_path = str(_project_root / "core")
        if _core_path not in sys.path:
            sys.path.insert(0, _core_path)
        from env_config import get_platform_config

        pc = get_platform_config("analytehealth")
        project = pc.gcp_project
        env = pc.environment
        creds_path = str(pc.credentials_path)
    except (FileNotFoundError, ImportError):
        # Running in Docker/Cloud Run without env.json — use env vars directly
        project = os.environ.get("GCP_PROJECT", "")
        env = os.environ.get("APP_ENV", "dev")
        creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    dataset = f"{env}_entities"

    # Try service account file first (Cloud Run mounts this)
    if creds_path and os.path.exists(creds_path):
        credentials = service_account.Credentials.from_service_account_file(creds_path)
    else:
        from google.auth import default

        credentials, _ = default()

    _conn = ibis.bigquery.connect(
        project_id=project,
        dataset_id=dataset,
        credentials=credentials,
    )
    return _conn


# ---------------------------------------------------------------------------
# Model registry (all 10 models, verbatim from mcp_server.py)
# ---------------------------------------------------------------------------

_models = {}


def _get_models():
    """Lazy-initialize all semantic models using actual BigQuery column names."""
    if _models:
        return _models

    conn = _get_connection()

    # --- member ---
    # Columns: member_id, match_method, match_confidence, order_count, account_count, ...
    _models["member"] = (
        to_semantic_table(conn.table("ent_member"), "member")
        .with_dimensions(
            member_id=lambda t: t.member_id,
            match_method=lambda t: t.match_method,
            match_confidence=lambda t: t.match_confidence,
        )
        .with_measures(
            member_count=lambda t: t.member_id.count(),
            total_orders=lambda t: t.order_count.sum(),
            avg_orders_per_member=lambda t: t.order_count.mean(),
            multi_account_members=lambda t: (t.account_count > 1)
            .cast("int64")
            .sum(),
        )
    )

    # --- engagement ---
    # Columns: engagement_id, member_id, account_id, engagement_brand_name, website_name,
    #          engagement_date, business_account_name, is_multi_brand, ...
    _models["engagement"] = (
        to_semantic_table(conn.table("ent_engagement"), "engagement")
        .with_dimensions(
            engagement_id=lambda t: t.engagement_id,
            member_id=lambda t: t.member_id,
            account_id=lambda t: t.account_id,
            analytics_brand=lambda t: t.engagement_brand_name,
            website_name=lambda t: t.website_name,
            engagement_date=time_dimension(
                lambda t: t.engagement_date,
                smallest_time_grain="TIME_GRAIN_DAY",
            ),
            business_account_name=lambda t: t.business_account_name,
            is_multi_brand=lambda t: t.is_multi_brand,
        )
        .with_measures(
            engagement_count=lambda t: t.engagement_id.count(),
            unique_members=lambda t: t.member_id.nunique(),
            unique_accounts=lambda t: t.account_id.nunique(),
            multi_brand_count=lambda t: t.is_multi_brand.cast("int64").sum(),
        )
    )

    # --- order_activity ---
    # Columns: order_activity_id, engagement_id, order_id, brand_name, order_status,
    #          order_created_at, order_activity_classification, activity_group, ...
    _models["order_activity"] = (
        to_semantic_table(conn.table("ent_order_activity"), "order_activity")
        .with_dimensions(
            order_activity_id=lambda t: t.order_activity_id,
            engagement_id=lambda t: t.engagement_id,
            order_id=lambda t: t.order_id,
            manage_brand=lambda t: t.brand_name,
            order_date=time_dimension(
                lambda t: t.order_created_at.cast("date"),
                smallest_time_grain="TIME_GRAIN_DAY",
            ),
            order_status=lambda t: t.order_status,
            activity_classification=lambda t: t.order_activity_classification,
            activity_group=lambda t: t.activity_group,
            order_agent=lambda t: t.order_agent,
        )
        .with_measures(
            activity_count=lambda t: t.order_activity_id.count(),
            manage_order_count=lambda t: t.order_id.nunique(),
            analytics_order_count=lambda t: t.engagement_id.nunique(),
        )
    )

    # --- payment ---
    # Columns: payment_id, order_activity_id, engagement_id, order_id, activity_type,
    #          payment_status, payment_method, payment_method_category, is_voucher_payment,
    #          is_transferred_payment, commission_name, payment_amount, voucher_amount,
    #          payment_created_at
    # NOTE: No brand columns - brand comes from order_activity join
    _models["payment"] = (
        to_semantic_table(conn.table("ent_payment"), "payment")
        .with_dimensions(
            payment_id=lambda t: t.payment_id,
            order_activity_id=lambda t: t.order_activity_id,
            engagement_id=lambda t: t.engagement_id,
            order_id=lambda t: t.order_id,
            activity_type=lambda t: t.activity_type,
            payment_status=lambda t: t.payment_status,
            payment_method=lambda t: t.payment_method,
            payment_method_category=lambda t: t.payment_method_category,
            is_voucher_payment=lambda t: t.is_voucher_payment,
            is_transferred_payment=lambda t: t.is_transferred_payment,
            commission_name=lambda t: t.commission_name,
            payment_date=time_dimension(
                lambda t: t.payment_created_at.cast("date"),
                smallest_time_grain="TIME_GRAIN_DAY",
            ),
        )
        .with_measures(
            payment_count=lambda t: t.count(),
            gross_order_value=lambda t: t.payment_amount.sum(),
            voucher_revenue=lambda t: t.voucher_amount.sum(),
            net_cash_order_value=lambda t: t.payment_amount.sum()
            - t.voucher_amount.sum(),
            transferred_revenue=lambda t: ibis.ifelse(
                t.is_transferred_payment, t.payment_amount, 0
            ).sum(),
            non_transfer_revenue=lambda t: ibis.ifelse(
                ~t.is_transferred_payment, t.payment_amount, 0
            ).sum(),
            manage_order_count=lambda t: t.order_id.nunique(),
            analytics_order_count=lambda t: t.engagement_id.nunique(),
            avg_payment=lambda t: t.payment_amount.mean(),
        )
    )

    # --- refund ---
    # Columns: refund_id, payment_id, order_activity_id, engagement_id, order_id,
    #          refund_requested_amount, refund_processed_amount, refund_status,
    #          refund_status_category, is_same_week_refund, refund_created_at
    _models["refund"] = (
        to_semantic_table(conn.table("ent_refund"), "refund")
        .with_dimensions(
            refund_id=lambda t: t.refund_id,
            payment_id=lambda t: t.payment_id,
            order_activity_id=lambda t: t.order_activity_id,
            engagement_id=lambda t: t.engagement_id,
            order_id=lambda t: t.order_id,
            refund_status=lambda t: t.refund_status,
            refund_status_category=lambda t: t.refund_status_category,
            is_same_week_refund=lambda t: t.is_same_week_refund,
            refund_date=time_dimension(
                lambda t: t.refund_created_at.cast("date"),
                smallest_time_grain="TIME_GRAIN_DAY",
            ),
        )
        .with_measures(
            refund_count=lambda t: t.count(),
            refund_requested=lambda t: t.refund_requested_amount.sum(),
            refund_processed=lambda t: t.refund_processed_amount.sum(),
            completed_refund_count=lambda t: (t.refund_status == "Refunded")
            .cast("int64")
            .sum(),
            same_week_refund_count=lambda t: t.is_same_week_refund.cast("int64").sum(),
        )
    )

    # --- order_line ---
    # Columns: order_line_id, order_activity_id, engagement_id, order_id,
    #          order_line_name, order_line_type, order_line_price, brand_name,
    #          service_concept, concept_item, is_deleted
    _models["order_line"] = (
        to_semantic_table(conn.table("ent_order_line"), "order_line")
        .with_dimensions(
            order_line_id=lambda t: t.order_line_id,
            order_activity_id=lambda t: t.order_activity_id,
            engagement_id=lambda t: t.engagement_id,
            order_id=lambda t: t.order_id,
            brand_name=lambda t: t.brand_name,
            order_line_name=lambda t: t.order_line_name,
            order_line_type=lambda t: t.order_line_type,
            service_concept=lambda t: t.service_concept,
            is_deleted=lambda t: t.is_deleted,
        )
        .with_measures(
            line_count=lambda t: t.order_line_id.count(),
            active_line_count=lambda t: (~t.is_deleted).cast("int64").sum(),
            line_revenue=lambda t: t.order_line_price.sum(),
        )
    )

    # --- consultation ---
    # Columns: consultation_id, engagement_id, order_id, treatment_type,
    #          treatment_category, consultation_type, consultation_status,
    #          clinician_name, prescription_count, created_at
    _models["consultation"] = (
        to_semantic_table(conn.table("ent_consultation"), "consultation")
        .with_dimensions(
            consultation_id=lambda t: t.consultation_id,
            engagement_id=lambda t: t.engagement_id,
            order_id=lambda t: t.order_id,
            treatment_type=lambda t: t.treatment_type,
            treatment_category=lambda t: t.treatment_category,
            consultation_type=lambda t: t.consultation_type,
            consultation_status=lambda t: t.consultation_status,
            clinician_name=lambda t: t.clinician_name,
            consultation_date=time_dimension(
                lambda t: t.created_at.cast("date"),
                smallest_time_grain="TIME_GRAIN_DAY",
            ),
        )
        .with_measures(
            consultation_count=lambda t: t.consultation_id.count(),
            prescribed_count=lambda t: (t.prescription_count > 0)
            .cast("int64")
            .sum(),
            prescription_rate=lambda t: (t.prescription_count > 0)
            .cast("int64")
            .mean()
            * 100,
            total_prescriptions=lambda t: t.prescription_count.sum(),
        )
    )

    # --- lab_order ---
    # Columns: lab_order_id, engagement_id, order_id, network_name, lab_order_type,
    #          has_requisition, test_count, result_date
    _models["lab_order"] = (
        to_semantic_table(conn.table("ent_lab_order"), "lab_order")
        .with_dimensions(
            lab_order_id=lambda t: t.lab_order_id,
            engagement_id=lambda t: t.engagement_id,
            order_id=lambda t: t.order_id,
            network_name=lambda t: t.network_name,
            lab_order_type=lambda t: t.lab_order_type,
            has_requisition=lambda t: t.has_requisition,
            result_date=time_dimension(
                lambda t: t.result_date,
                smallest_time_grain="TIME_GRAIN_DAY",
            ),
        )
        .with_measures(
            lab_order_count=lambda t: t.lab_order_id.count(),
            total_tests=lambda t: t.test_count.sum(),
        )
    )

    # --- lab_test ---
    # Columns: lab_test_id, lab_order_id, engagement_id, order_id, test_name,
    #          result_category, is_positive, is_abnormal, test_result_status
    _models["lab_test"] = (
        to_semantic_table(conn.table("ent_lab_test"), "lab_test")
        .with_dimensions(
            lab_test_id=lambda t: t.lab_test_id,
            lab_order_id=lambda t: t.lab_order_id,
            engagement_id=lambda t: t.engagement_id,
            order_id=lambda t: t.order_id,
            test_name=lambda t: t.test_name,
            result_category=lambda t: t.result_category,
            is_positive=lambda t: t.is_positive,
            is_abnormal=lambda t: t.is_abnormal,
        )
        .with_measures(
            test_count=lambda t: t.lab_test_id.count(),
            positive_count=lambda t: t.is_positive.cast("int64").sum(),
            positivity_rate=lambda t: t.is_positive.cast("float64").mean() * 100,
            abnormal_count=lambda t: t.is_abnormal.cast("int64").sum(),
        )
    )

    # --- ads ---
    # Columns: date, ad_platform, website_name, campaign_name, spend,
    #          impressions, clicks, conversions, conversion_value, treatment_type
    _models["ads"] = (
        to_semantic_table(conn.table("ent_ads"), "ads")
        .with_dimensions(
            ad_date=time_dimension(
                lambda t: t.date,
                smallest_time_grain="TIME_GRAIN_DAY",
            ),
            ad_platform=lambda t: t.ad_platform,
            website_name=lambda t: t.website_name,
            campaign_name=lambda t: t.campaign_name,
            treatment_type=lambda t: t.treatment_type,
        )
        .with_measures(
            total_spend=lambda t: t.spend.sum(),
            total_impressions=lambda t: t.impressions.sum(),
            total_clicks=lambda t: t.clicks.sum(),
            total_conversions=lambda t: t.conversions.sum(),
            total_conversion_value=lambda t: t.conversion_value.sum(),
            cpc=lambda t: t.spend.sum()
            / ibis.ifelse(t.clicks.sum() == 0, None, t.clicks.sum()),
            cpm=lambda t: t.spend.sum()
            / ibis.ifelse(t.impressions.sum() == 0, None, t.impressions.sum())
            * 1000,
        )
    )

    return _models


# ---------------------------------------------------------------------------
# Helpers (verbatim from mcp_server.py)
# ---------------------------------------------------------------------------


def _model_info(name: str, model) -> dict:
    """Extract dimensions and measures from a model for the LLM."""
    dims = model.get_dimensions()
    measures = model.get_measures()
    return {
        "name": name,
        "dimensions": [
            {
                "name": k,
                "is_time": v.is_time_dimension,
                "smallest_time_grain": v.smallest_time_grain,
            }
            for k, v in dims.items()
        ],
        "measures": [{"name": k} for k, v in measures.items()],
    }


def _parse_filter(filter_str: str, valid_dimensions: set[str] | None = None):
    """Parse a filter string into a lambda for BSL's query(filters=[...]).

    Supports: =, !=, >, <, >=, <=
    Example: "manage_brand = 'STDcheck'" -> lambda t: t.manage_brand == 'STDcheck'
    """
    match = re.match(r"(\w+)\s*(=|!=|>=|<=|>|<)\s*'?([^']*)'?", filter_str.strip())
    if not match:
        return None

    dim_name, op, value = match.groups()

    if valid_dimensions is not None and dim_name not in valid_dimensions:
        raise ValueError(
            f"Unknown dimension '{dim_name}'. Available: {sorted(valid_dimensions)}"
        )

    # Capture in closure to avoid late-binding issues
    def make_filter(d, o, v):
        ops = {
            "=": lambda t: getattr(t, d) == v,
            "!=": lambda t: getattr(t, d) != v,
            ">": lambda t: getattr(t, d) > v,
            "<": lambda t: getattr(t, d) < v,
            ">=": lambda t: getattr(t, d) >= v,
            "<=": lambda t: getattr(t, d) <= v,
        }
        return ops[o]

    return make_filter(dim_name, op, value)


# ---------------------------------------------------------------------------
# Tool functions (same logic as mcp_server.py, no @mcp.tool() decorator)
# ---------------------------------------------------------------------------


def list_models() -> str:
    """List all available semantic models with their dimensions and measures."""
    models = _get_models()
    result = [_model_info(name, model) for name, model in models.items()]
    return json.dumps(result, indent=2)


def get_model(model_name: str) -> str:
    """Get detailed information about a specific semantic model."""
    models = _get_models()
    if model_name not in models:
        return json.dumps(
            {
                "error": f"Model '{model_name}' not found. Available: {list(models.keys())}"
            }
        )
    return json.dumps(_model_info(model_name, models[model_name]), indent=2)


def query_model(
    model_name: str,
    dimensions: list[str],
    measures: list[str],
    filters: Optional[list[str]] = None,
    time_grain: Optional[str] = None,
    limit: int = 100,
) -> str:
    """Query a semantic model and return results as JSON."""
    models = _get_models()
    if model_name not in models:
        return json.dumps(
            {
                "error": f"Model '{model_name}' not found. Available: {list(models.keys())}"
            }
        )

    model = models[model_name]

    # Build query
    query_kwargs = {"dimensions": dimensions, "measures": measures}
    if time_grain:
        query_kwargs["time_grain"] = time_grain

    try:
        # Parse filters into lambdas for BSL
        if filters:
            valid_dims = set(model.get_dimensions().keys())
            parsed = []
            for f in filters:
                p = _parse_filter(f, valid_dimensions=valid_dims)
                if p:
                    parsed.append(p)
            query_kwargs["filters"] = parsed

        q = model.query(**query_kwargs)

        # Execute and convert to JSON-safe format
        df = q.limit(limit).execute()

        # Convert dates/timestamps to strings
        for col in df.columns:
            if hasattr(df[col], "dt"):
                df[col] = df[col].astype(str)

        result = {
            "columns": list(df.columns),
            "rows": df.to_dict(orient="records"),
            "row_count": len(df),
        }
        return json.dumps(result, indent=2, default=str)

    except Exception as e:
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
# call_tool — drop-in replacement for MCPClient.call_tool()
# ---------------------------------------------------------------------------


async def call_tool(tool_name: str, tool_input: dict) -> str:
    """Drop-in replacement for MCPClient.call_tool()."""
    handlers = {
        "list_models": lambda inp: list_models(),
        "get_model": lambda inp: get_model(inp["model_name"]),
        "query_model": lambda inp: query_model(
            model_name=inp["model_name"],
            dimensions=inp.get("dimensions", []),
            measures=inp.get("measures", []),
            filters=inp.get("filters"),
            time_grain=inp.get("time_grain"),
            limit=inp.get("limit", 100),
        ),
    }
    handler = handlers.get(tool_name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    try:
        return handler(tool_input)
    except Exception as e:
        return json.dumps({"error": str(e)})
