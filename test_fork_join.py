"""集成测试：fork → code → join 端到端"""
import asyncio, json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.workflow_engine.nodes.base import NodeContext
from app.services.workflow_engine.nodes.fork import ForkNode
from app.services.workflow_engine.nodes.join import JoinNode
from app.services.workflow_engine.nodes.triggers import ManualTriggerNode
from app.services.workflow_engine.nodes.code_node import CodeNode
from app.services.workflow_engine.nodes.output_node import OutputNode

FORK_CFG = {"label": "Fork", "mode": "broadcast", "branchCount": 2}
CODE_A_CFG = {"label": "分支A", "language": "python", "code": "import json\nresult = {'branch': 'A', 'value': 42}\nprint(json.dumps(result))"}
CODE_B_CFG = {"label": "分支B", "language": "python", "code": "import json\nresult = {'branch': 'B', 'value': 99}\nprint(json.dumps(result))"}
JOIN_CFG = {"label": "Join", "mode": "all", "mergeStrategy": "append"}
OUTPUT_CFG = {"label": "输出", "format": "json"}
INPUT = {"message": "test"}
EXID = "test_001"

def ctx(node_id, node_type, config, upstream):
    return NodeContext(node_id=node_id, node_type=node_type, node_config=config,
                       input_data=INPUT, execution_id=EXID, upstream_outputs=upstream)

async def main():
    print("=" * 50)
    print("  Fork/Join 端到端集成测试")
    print("=" * 50)

    # 1. trigger
    print("\n[1] Trigger")
    r = await ManualTriggerNode().execute(ctx("trigger", "manual_trigger", {"label": "T"}, {}))
    assert r.status.value == "success"
    outputs = {"trigger": r.output_data}
    print(f"    ✅ {r.status.value}")

    # 2. fork
    print("[2] Fork (broadcast)")
    r = await ForkNode().execute(ctx("fork1", "fork", FORK_CFG, outputs))
    assert r.status.value == "success"
    outputs["fork1"] = r.output_data
    print(f"    ✅ {r.status.value} → {json.dumps(r.output_data)}")

    # 3. code_a + code_b 并行
    print("[3] Code A+B (parallel)")
    ra, rb = await asyncio.gather(
        CodeNode().execute(ctx("code_a", "code", CODE_A_CFG, outputs)),
        CodeNode().execute(ctx("code_b", "code", CODE_B_CFG, outputs)),
    )
    assert ra.status.value == "success"
    assert rb.status.value == "success"
    outputs["code_a"] = ra.output_data
    outputs["code_b"] = rb.output_data
    print(f"    ✅ A={json.dumps(ra.output_data)}")
    print(f"    ✅ B={json.dumps(rb.output_data)}")

    # 4. join
    print("[4] Join (merge append)")
    r = await JoinNode().execute(ctx("join1", "join", JOIN_CFG, outputs))
    assert r.status.value == "success"
    outputs["join1"] = r.output_data
    print(f"    ✅ {r.status.value}")
    print(f"    合并: {json.dumps(r.output_data, ensure_ascii=False)}")

    # 5. output
    print("[5] Output")
    r = await OutputNode().execute(ctx("output1", "output", OUTPUT_CFG, outputs))
    print(f"    ✅ {r.status.value}")

    # 验证
    print("\n" + "=" * 50)
    errors = []
    a_result = outputs["code_a"]
    if isinstance(a_result, dict):
        if a_result.get("branch") != "A": errors.append(f"code_a 结果错误: {a_result}")
    else:
        errors.append(f"code_a 输出不是dict: {a_result}")

    b_result = outputs["code_b"]
    if isinstance(b_result, dict):
        if b_result.get("branch") != "B": errors.append(f"code_b 结果错误: {b_result}")
    else:
        errors.append(f"code_b 输出不是dict: {b_result}")

    j = outputs["join1"]
    if not (j.get("branch_0") or j.get("branch_1") or j.get("merged")):
        errors.append(f"join 合并结果缺失: {j}")

    if errors:
        print("❌ 失败")
        for e in errors: print(f"   {e}")
    else:
        print("✅ 全部通过")
        print("  Fork 分发 ✅ | 并行执行 ✅ | Join 合并 ✅ | 链路完整 ✅")
    print("=" * 50)

if __name__ == '__main__':
    asyncio.run(main())
