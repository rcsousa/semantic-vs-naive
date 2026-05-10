"""Tests para AuditTrail — serialização e hash de reprodutibilidade."""
import time
from app.governance.trail import AuditTrail


def _make_trail(question: str = "Qual o NPL Ratio?") -> AuditTrail:
    t = AuditTrail(question=question)
    t.add_step("calculate", {"question": question}, {"axiom_id": "AX-NPL-RATIO", "answer": "0.14%"})
    t.add_step("judge", {"axiom_id": "AX-NPL-RATIO"}, {"verdict": "consistent", "confidence": 0.95})
    t.add_step("killswitch", {"judge_verdict": "consistent"}, {"armed": False, "triggers": []})
    t.add_step("respond", {}, {"answer_length": 120})
    return t


# ── trail novo populado corretamente ─────────────────────────────────────────

def test_trail_steps_populated():
    t = _make_trail()
    assert len(t.steps) == 4
    assert t.steps[0].name == "calculate"
    assert t.steps[1].name == "judge"
    assert t.steps[2].name == "killswitch"
    assert t.steps[3].name == "respond"


# ── serialização preserva unicode ────────────────────────────────────────────

def test_trail_serialization_unicode():
    t = AuditTrail(question="Qual a exposição do cliente André Müller?")
    t.add_step("calculate", {"q": "André Müller"}, {"resposta": "exposição R$ 7.000,00"})
    d = t.to_dict()
    assert "André Müller" in d["question"]
    assert "exposição" in d["steps"][0]["outputs"]["resposta"]
    assert isinstance(d["hash"], str) and len(d["hash"]) == 64


# ── hash de reprodutibilidade: mesmos inputs → mesmo hash ────────────────────

def test_same_inputs_same_hash():
    t1 = _make_trail()
    t2 = _make_trail()
    assert t1.reproducibility_hash() == t2.reproducibility_hash()


# ── inputs diferentes → hashes diferentes ────────────────────────────────────

def test_different_inputs_different_hash():
    t1 = _make_trail("Qual o NPL Ratio?")
    t2 = _make_trail("Qual a carteira ativa?")
    assert t1.reproducibility_hash() != t2.reproducibility_hash()


# ── timestamps e durations diferentes NÃO afetam o hash ─────────────────────

def test_timestamps_do_not_affect_hash():
    """O ponto mais importante: dois runs determinísticos produzem o mesmo hash."""
    t1 = AuditTrail(question="Q")
    t1.add_step("calculate", {"q": "Q"}, {"ans": "42"}, duration_ms=100)
    t1.add_step("respond", {}, {}, duration_ms=5)

    time.sleep(0.01)  # garante timestamps diferentes

    t2 = AuditTrail(question="Q")
    t2.add_step("calculate", {"q": "Q"}, {"ans": "42"}, duration_ms=999)
    t2.add_step("respond", {}, {}, duration_ms=1)

    assert t1.reproducibility_hash() == t2.reproducibility_hash()
    # sanidade: request_ids são diferentes
    assert t1.request_id != t2.request_id


# ── hash muda quando outputs mudam (drift detection) ─────────────────────────

def test_hash_changes_on_output_drift():
    t1 = AuditTrail(question="Q")
    t1.add_step("calculate", {"q": "Q"}, {"axiom_id": "AX-NPL-RATIO"})

    t2 = AuditTrail(question="Q")
    t2.add_step("calculate", {"q": "Q"}, {"axiom_id": "AX-DEFAULT-90"})  # axioma diferente

    assert t1.reproducibility_hash() != t2.reproducibility_hash()
