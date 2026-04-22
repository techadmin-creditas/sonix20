from typing import List, Dict
from voicebot.core.session_transcript_analysis import make_summariser_llm

async def translate_transcript(log_entries: List[Dict], target_lang: str, bot_config: dict) -> str:
    """
    Translate a conversation transcript into the target language using the bot's configured LLM.
    """
    llm = make_summariser_llm(bot_config)
    
    import json
    
    # Filter entries once
    filtered_entries = [
        e for e in log_entries 
        if e.get('role') in ('user', 'assistant', 'bot')
    ]
    
    if not filtered_entries:
        return "[]"

    prompt = (
        f"Translate each turn of the following conversation into {target_lang}. "
        "Return the result as a raw JSON array of strings, where each string is the translated content of a turn. "
        "IMPORTANT: The number of elements in the array MUST match the number of input turns exactly. "
        "Do not include role prefixes like 'USER:' or 'ASSISTANT:'. "
        "Output ONLY the JSON array, no other text:\n\n"
    )
    for e in filtered_entries:
        prompt += f"- {e.get('content','')}\n"

    translated_raw = ""
    async for chunk in llm.stream_completion(
        system_prompt=f"You are a professional translator expert in {target_lang}. You output ONLY JSON arrays of strings.",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1
    ):
        if chunk.content:
            translated_raw += chunk.content
            
    result = translated_raw.strip()
    if result.startswith("```"):
        import re
        result = re.sub(r"^```(?:json)?\n?|```$", "", result, flags=re.MULTILINE).strip()
    return result
