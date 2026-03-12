import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_agent():
    """测试创建 Agent"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/agents/", json={
            "name": "test-agent",
            "type": "claude-code",
            "model": "claude-3-opus",
            "timeout": 300,
            "skills": ["python", "react"],
            "capabilities": ["coding", "debugging"]
        })
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["data"]["name"] == "test-agent"


@pytest.mark.asyncio
async def test_get_agents():
    """测试获取 Agent 列表"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/agents/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_agent():
    """测试获取单个 Agent"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 先创建一个 Agent
        create_response = await client.post("/api/agents/", json={
            "name": "test-agent-2",
            "type": "claude-code"
        })
        agent_id = create_response.json()["data"]["id"]

        # 获取该 Agent
        response = await client.get(f"/api/agents/{agent_id}")
        assert response.status_code == 200
        assert response.json()["data"]["id"] == agent_id