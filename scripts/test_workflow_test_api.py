import asyncio
from voicebot.api.v1.routes import test_workflow

async def run_test():
    mock_workflow_json = {
        "nodes": [
            {"id": "node_input_1", "type": "user-input"},
            {"id": "node_branch_1", "type": "smart-branch"},
            {"id": "node_bot_a", "type": "bot-says", "config": {"message": "You chose Option A."}},
            {"id": "node_bot_b", "type": "bot-says", "config": {"message": "You chose Option B."}}
        ],
        "edges": [
            {"source": "node_input_1", "target": "node_branch_1"},
            {"source": "node_branch_1", "target": "node_bot_a", "label": "Option A"},
            {"source": "node_branch_1", "target": "node_bot_b", "label": "Option B"}
        ]
    }

    payload = {
        "workflow_data": mock_workflow_json,
        "user_input": "I'd like to go with the second option please.",
        "current_node_id": "node_input_1"
    }

    print("Testing /workflows/test endpoint simulation...")
    res = await test_workflow(payload)
    print("Result:", res)
    assert res["status"] == "success"
    assert "Option B" in res["speak_responses"][0]
    print("✅ Endpoint handles ephemeral graphs securely and matches context successfully!")

if __name__ == "__main__":
    asyncio.run(run_test())
