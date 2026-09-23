"""
Trstprep Fast Intent & Tool Dispatch Engine powered by Cactus Compute Needle (SAN architecture)
Routes student inputs to native Trstprep features in < 15ms.
"""

import time
import json
import needle

# 1. Define Trstprep native tools with docstrings & type hints
@needle.tool
def start_practice(subject: str, topic: str, question_count: int = 10):
    """
    Start an interactive practice session in Trstprep Practice Lab.
    Args:
        subject: The academic subject (e.g. 'Polity', 'Quantitative Aptitude', 'History')
        topic: The specific syllabus topic (e.g. 'Articles', 'Blood Relations', 'Percentage')
        question_count: Number of practice questions to generate (default 10)
    """
    return {
        "status": "initiated",
        "action": "LAUNCH_PRACTICE_LAB",
        "subject": subject,
        "topic": topic,
        "question_count": question_count
    }

@needle.tool
def search_question_bank(query: str, exam_series: str = "ALL"):
    """
    Search Trstprep's 45,000+ question bank for past-year exam questions (PYQs).
    Args:
        query: Search keywords or concepts
        exam_series: Target exam series (e.g. 'SSC CGL', 'UPSC Prelims', 'ALL')
    """
    return {
        "status": "query_ready",
        "action": "EXECUTE_PGVECTOR_SEARCH",
        "query": query,
        "exam_series": exam_series
    }

@needle.tool
def get_spaced_repetition_queue(student_id: str = "current_user"):
    """
    Retrieve today's spaced repetition revision queue and due flashcards.
    Args:
        student_id: ID of the student or 'current_user'
    """
    return {
        "status": "ready",
        "action": "FETCH_REVISION_QUEUE",
        "student_id": student_id
    }

@needle.tool
def ask_ai_mentor(problem_text: str, subject: str = "General"):
    """
    Escalate a deep conceptual doubt or math derivation to the Socratic AI Mentor.
    Args:
        problem_text: The complete problem or concept the student is confused about
        subject: The subject domain for the tutor persona
    """
    return {
        "status": "escalated",
        "action": "INVOKE_OPENROUTER_SOCRATIC_MENTOR",
        "problem_text": problem_text,
        "subject": subject
    }

def main():
    print("=================================================================")
    print("[Needle] INITIALIZING CACTUS COMPUTE NEEDLE AGENT")
    print("   Architecture: Simple Attention Network (SAN, zero FFN/MLP)")
    print("=================================================================\n")

    t0 = time.perf_counter()
    agent = needle.Needle(tools=[
        start_practice,
        search_question_bank,
        get_spaced_repetition_queue,
        ask_ai_mentor
    ])
    init_ms = (time.perf_counter() - t0) * 1000
    print(f"[Needle] Agent initialized with 4 tools in {init_ms:.2f}ms\n")

    test_queries = [
        "I want to practice 15 questions on Indian Polity Articles",
        "Show me which topics are due for spaced repetition review today",
        "Find questions from SSC CGL regarding the Mauryan Empire",
        "Why is division by zero mathematically undefined? Can you explain the limit derivation?"
    ]

    for i, q in enumerate(test_queries, 1):
        print(f"--- [Query {i}] \"{q}\" ---")
        t_start = time.perf_counter()
        try:
            result = agent.run(q)
            elapsed_ms = (time.perf_counter() - t_start) * 1000
            print(f"[Latency] {elapsed_ms:.2f}ms")
            print(f"[Result] {json.dumps(result, indent=2)}\n")
        except Exception as e:
            print(f"Error: {e}\n")

if __name__ == "__main__":
    main()
