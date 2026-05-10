"""Tests para Killswitch — lógica pura, sem LLM."""
import pytest
from app.governance.killswitch import Killswitch, KillswitchConfig

# ── fixtures de instâncias ────────────────────────────────────────────────────

# Spreads S14-like (8 contratos ativos, std dev ≈ 17 p.p. — abaixo de 25 p.p.)
INSTANCES_LOW_VARIANCE = [
    {"contract_id": "K001", "spread": "0.075"},
    {"contract_id": "K002", "spread": "0.315"},
    {"contract_id": "K003", "spread": "0.545"},
    {"contract_id": "K004", "spread": "-0.006"},
    {"contract_id": "K005", "spread": "0.115"},
    {"contract_id": "K006", "spread": "0.030"},
    {"contract_id": "K008", "spread": "0.050"},
    {"contract_id": "K009", "spread": "0.105"},
]

# Spreads KV (S15) — std dev ≈ 30.6 p.p. >> 25 p.p. threshold
INSTANCES_KV = [
    {"contract_id": "KV001", "spread": "0.010"},
    {"contract_id": "KV002", "spread": "0.050"},
    {"contract_id": "KV003", "spread": "0.100"},
    {"contract_id": "KV004", "spread": "0.400"},
    {"contract_id": "KV005", "spread": "0.650"},
    {"contract_id": "KV006", "spread": "0.800"},
]

# Instância única — variância não se aplica
INSTANCES_SINGLE = [{"npl_ratio": "0.001356"}]


# ── caminho feliz (zero gatilhos) ─────────────────────────────────────────────

def test_no_triggers_happy_path():
    ks = Killswitch()
    r = ks.evaluate(
        judge_verdict="consistent",
        ragas_score=0.90,
        instances=INSTANCES_LOW_VARIANCE,
    )
    assert not r.armed
    assert r.triggers == []


# ── cada gatilho disparando isoladamente ─────────────────────────────────────

def test_trigger_ragas_only():
    ks = Killswitch()
    r = ks.evaluate(judge_verdict="consistent", ragas_score=0.50)
    assert r.armed
    assert len(r.triggers) == 1
    assert r.triggers[0].code == "ragas_below_floor"
    assert r.triggers[0].observed == pytest.approx(0.50, abs=1e-4)


def test_trigger_judge_inconsistent():
    ks = Killswitch()
    r = ks.evaluate(judge_verdict="inconsistent", ragas_score=0.95)
    assert r.armed
    assert any(t.code == "judge_not_consistent" for t in r.triggers)


def test_trigger_judge_insufficient_evidence():
    ks = Killswitch()
    r = ks.evaluate(judge_verdict="insufficient_evidence", ragas_score=0.95)
    assert r.armed
    assert any(t.code == "judge_not_consistent" for t in r.triggers)


def test_trigger_variance_only_s15():
    """Cenário jewel S15: judge consistent, RAGAS alto, mas variância dispara."""
    ks = Killswitch()
    r = ks.evaluate(
        judge_verdict="consistent",
        ragas_score=0.92,
        instances=INSTANCES_KV,
    )
    assert r.armed
    assert len(r.triggers) == 1
    assert r.triggers[0].code == "high_instance_variance"
    assert r.triggers[0].observed > 25.0


# ── múltiplos gatilhos simultâneos ───────────────────────────────────────────

def test_multiple_triggers_all_three():
    ks = Killswitch()
    r = ks.evaluate(
        judge_verdict="inconsistent",
        ragas_score=0.40,
        instances=INSTANCES_KV,
    )
    assert r.armed
    codes = {t.code for t in r.triggers}
    assert codes == {"ragas_below_floor", "judge_not_consistent", "high_instance_variance"}


# ── configuração customizada ─────────────────────────────────────────────────

def test_custom_config_strict_ragas():
    cfg = KillswitchConfig(ragas_floor=0.85)
    ks = Killswitch(cfg)
    # RAGAS 0.80 passa no default (0.70) mas falha no strict (0.85)
    r = ks.evaluate(judge_verdict="consistent", ragas_score=0.80)
    assert r.armed
    assert r.triggers[0].code == "ragas_below_floor"


def test_custom_config_strict_variance():
    cfg = KillswitchConfig(variance_ceiling_pp=5.0)
    ks = Killswitch(cfg)
    # Com threshold 5 pp, S14-like (17 pp) também dispara
    r = ks.evaluate(
        judge_verdict="consistent",
        ragas_score=0.95,
        instances=INSTANCES_LOW_VARIANCE,
    )
    assert r.armed
    assert r.triggers[0].code == "high_instance_variance"


# ── edge cases ────────────────────────────────────────────────────────────────

def test_ragas_absent_no_trigger():
    ks = Killswitch()
    r = ks.evaluate(judge_verdict="consistent", ragas_score=None)
    assert not r.armed


def test_single_instance_no_variance_trigger():
    """Instância única não dispara variância."""
    ks = Killswitch()
    r = ks.evaluate(
        judge_verdict="consistent",
        ragas_score=0.95,
        instances=INSTANCES_SINGLE,
    )
    assert not r.armed


def test_empty_instances_no_variance_trigger():
    ks = Killswitch()
    r = ks.evaluate(judge_verdict="consistent", ragas_score=0.95, instances=[])
    assert not r.armed


def test_ragas_exactly_at_floor_no_trigger():
    ks = Killswitch()
    r = ks.evaluate(judge_verdict="consistent", ragas_score=0.70)
    # exatamente no piso (< não ≤)
    assert not r.armed


# ── test específico S15: isola gatilho de variância ──────────────────────────

def test_s15_jewel_only_variance_trigger():
    """S15: judge consistent, RAGAS alto, único trigger = high_instance_variance."""
    ks = Killswitch()
    result = ks.evaluate(
        judge_verdict="consistent",    # judge aprova
        ragas_score=0.92,              # RAGAS alto (não dispara gatilho 1)
        instances=INSTANCES_KV,        # spreads 1–80 pp, std dev ≈ 30.6 pp
    )
    assert result.armed, "Killswitch deve disparar para S15"
    assert len(result.triggers) == 1, "Apenas 1 trigger esperado"
    assert result.triggers[0].code == "high_instance_variance"
    assert result.triggers[0].threshold == 25.0
    assert result.triggers[0].observed > 25.0
