import json
import sys
import os

def patch_workflow(json_path):
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    with open(json_path, 'r') as f:
        wf = json.load(f)

    nodes = wf.get("nodes", [])
    edges = wf.get("edges", [])

    # 1. Connect the floating 'Sentiment' node
    # We want: User Input - Intent -> Sentiment -> Logic - Intent
    # First, find and remove the edge: User Input - Intent -> Logic - Intent
    new_edges = []
    has_sentiment = any(n['id'] == "Sentiment" for n in nodes)
    
    if has_sentiment:
        print("Patching 'Sentiment' node connectivity...")
        for edge in edges:
            if edge['source'] == "User Input - Intent" and edge['target'] == "Logic - Intent":
                # Splitting this edge
                new_edges.append({
                    "id": "edge-ui-to-sentiment",
                    "source": "User Input - Intent",
                    "target": "Sentiment"
                })
                new_edges.append({
                    "id": "edge-sentiment-to-logic",
                    "source": "Sentiment",
                    "target": "Logic - Intent"
                })
            else:
                new_edges.append(edge)
        wf["edges"] = new_edges
    else:
        print("Warning: 'Sentiment' node not found in JSON.")

    # 2. Connect the floating 'LLM Fallback' node
    # We'll connect Logic - Intent -> LLM Fallback as a "fallback" label
    if any(n['id'] == "LLM Fallback" for n in nodes):
        print("Patching 'LLM Fallback' node connectivity...")
        # Check if already connected
        is_connected = any(e['target'] == "LLM Fallback" for e in wf["edges"])
        if not is_connected:
            wf["edges"].append({
                "id": "edge-logic-to-fallback",
                "source": "Logic - Intent",
                "target": "LLM Fallback",
                "label": "fallback"
            })

    # Save back
    with open(json_path, 'w') as f:
        json.dump(wf, f, indent=2)
    print(f"Successfully patched {json_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 patch_workflow.py <path_to_workflow_json>")
    else:
        patch_workflow(sys.argv[1])
