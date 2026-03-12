import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_start_agent():
    """Test starting an agent"""
    # First create an agent
    agent_data = {
        "name": "Test Agent for Start",
        "type": "claude-code",
        "model": "claude-3-opus",
        "timeout": 300
    }

    # Create agent
    create_response = client.post("/api/agents/", json=agent_data)
    assert create_response.status_code == 200
    agent_id = create_response.json()["data"]["id"]

    # Start the agent
    start_response = client.post(f"/api/agents/{agent_id}/start")
    assert start_response.status_code == 200
    assert start_response.json()["success"] is True
    assert start_response.json()["data"]["status"] == "running"


def test_stop_agent():
    """Test stopping an agent"""
    # First create and start an agent
    agent_data = {
        "name": "Test Agent for Stop",
        "type": "claude-code",
        "model": "claude-3-opus",
        "timeout": 300
    }

    create_response = client.post("/api/agents/", json=agent_data)
    agent_id = create_response.json()["data"]["id"]

    # Start the agent first
    client.post(f"/api/agents/{agent_id}/start")

    # Stop the agent
    stop_response = client.post(f"/api/agents/{agent_id}/stop")
    assert stop_response.status_code == 200
    assert stop_response.json()["success"] is True
    assert stop_response.json()["data"]["status"] == "offline"


def test_get_agent_stats():
    """Test getting agent statistics"""
    # Create an agent
    agent_data = {
        "name": "Test Agent for Stats",
        "type": "claude-code",
        "model": "claude-3-opus",
        "timeout": 300
    }

    create_response = client.post("/api/agents/", json=agent_data)
    agent_id = create_response.json()["data"]["id"]

    # Get stats
    stats_response = client.get(f"/api/agents/{agent_id}/stats")
    assert stats_response.status_code == 200
    assert stats_response.json()["success"] is True
    stats = stats_response.json()["data"]
    assert "id" in stats
    assert "task_count" in stats
    assert "success_rate" in stats


def test_get_agent_logs():
    """Test getting agent logs"""
    # Create an agent
    agent_data = {
        "name": "Test Agent for Logs",
        "type": "claude-code",
        "model": "claude-3-opus",
        "timeout": 300
    }

    create_response = client.post("/api/agents/", json=agent_data)
    agent_id = create_response.json()["data"]["id"]

    # Get logs (should be empty initially)
    logs_response = client.get(f"/api/agents/{agent_id}/logs")
    assert logs_response.status_code == 200
    assert logs_response.json()["success"] is True
    logs = logs_response.json()["data"]
    assert isinstance(logs, list)


def test_budget_endpoints():
    """Test budget management endpoints"""
    budget_data = {
        "name": "Test Budget",
        "amount": 1000.0,
        "period": "monthly",
        "alert_threshold": 0.8
    }

    # Create budget
    create_response = client.post("/api/cost/budget", json=budget_data)
    assert create_response.status_code == 200
    budget_id = create_response.json()["data"]["id"]

    # Get all budgets
    budgets_response = client.get("/api/cost/budget")
    assert budgets_response.status_code == 200
    assert len(budgets_response.json()) > 0

    # Get specific budget
    get_response = client.get(f"/api/cost/budget/{budget_id}")
    assert get_response.status_code == 200
    assert get_response.json()["success"] is True
    assert get_response.json()["data"]["name"] == "Test Budget"


def test_cost_by_agent():
    """Test getting cost by agent"""
    # First create an agent
    agent_data = {
        "name": "Test Agent for Costs",
        "type": "claude-code",
        "model": "claude-3-opus",
        "timeout": 300
    }

    agent_response = client.post("/api/agents/", json=agent_data)
    agent_id = agent_response.json()["data"]["id"]

    # Get cost by agent
    cost_response = client.get(f"/api/cost/by-agent/{agent_id}")
    assert cost_response.status_code == 200
    assert cost_response.json()["success"] is True
    cost_data = cost_response.json()["data"]
    assert "agent_id" in cost_data
    assert "total_tokens" in cost_data


def test_cost_alerts():
    """Test cost alert endpoints"""
    # Create alert
    alert_response = client.post("/api/cost/alert",
                                params={"agent_id": "test-agent", "tokens_used": 100, "cost": 10.0})
    assert alert_response.status_code == 200

    # Get alerts
    get_alerts_response = client.get("/api/cost/alert")
    assert get_alerts_response.status_code == 200
    assert get_alerts_response.json()["success"] is True


def test_task_assignment():
    """Test task assignment to agent"""
    # Create an agent
    agent_data = {
        "name": "Test Agent for Task",
        "type": "claude-code",
        "model": "claude-3-opus",
        "timeout": 300
    }

    agent_response = client.post("/api/agents/", json=agent_data)
    agent_id = agent_response.json()["data"]["id"]

    # Create a task
    task_data = {
        "title": "Test Task for Assignment",
        "description": "This is a test task",
        "priority": "high"
    }

    task_response = client.post("/api/tasks/", json=task_data)
    task_id = task_response.json()["data"]["id"]

    # Start the agent
    client.post(f"/api/agents/{agent_id}/start")

    # Assign task to agent
    assign_response = client.post(f"/api/tasks/{task_id}/assign",
                                 params={"agent_id": agent_id})
    assert assign_response.status_code == 200
    assert assign_response.json()["success"] is True